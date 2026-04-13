import { NextResponse } from "next/server";
import { requireHrAccess } from "@/lib/api-auth";
import { hasPermission } from "@/types/permissions";
import {
  assertAllowedUpload,
  deleteStoredFileIfExists,
  findDocumentById,
  getHrProfile,
  setProfileDocument,
  setQualifications,
  writeUserDocumentFile,
} from "@/lib/hr-profile-store";
import type { HrDocumentMeta, HrQualificationDoc } from "@/types/hr-profile";

export async function POST(request: Request) {
  const gate = await requireHrAccess();
  if (!gate.ok) return gate.response;

  const form = await request.formData();
  const file = form.get("file");
  const category = form.get("category");
  const labelRaw = form.get("label");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (category !== "wwcc" && category !== "police_check" && category !== "qualification") {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let mimeType = file.type || "";
  if (!mimeType || mimeType === "application/octet-stream") {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) mimeType = "application/pdf";
    else if (lower.endsWith(".png")) mimeType = "image/png";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mimeType = "image/jpeg";
    else if (lower.endsWith(".webp")) mimeType = "image/webp";
    else if (lower.endsWith(".heic")) mimeType = "image/heic";
    else if (lower.endsWith(".doc")) mimeType = "application/msword";
    else if (lower.endsWith(".docx")) {
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
  }
  if (!mimeType) mimeType = "application/octet-stream";
  assertAllowedUpload(mimeType, buf.length);

  const userId = gate.session.userId;
  const docId = crypto.randomUUID();
  const { storedRelative } = await writeUserDocumentFile(userId, buf, file.name, docId);

  const meta: HrDocumentMeta = {
    id: docId,
    originalName: file.name,
    storedRelative,
    uploadedAt: new Date().toISOString(),
    mimeType,
    sizeBytes: buf.length,
  };

  try {
    if (category === "wwcc") {
      const prev = await getHrProfile(userId);
      if (prev.wwcc) await deleteStoredFileIfExists(prev.wwcc.storedRelative);
      const profile = await setProfileDocument(userId, "wwcc", meta);
      return NextResponse.json({ profile });
    }
    if (category === "police_check") {
      const prev = await getHrProfile(userId);
      if (prev.policeCheck) await deleteStoredFileIfExists(prev.policeCheck.storedRelative);
      const profile = await setProfileDocument(userId, "policeCheck", meta);
      return NextResponse.json({ profile });
    }

    const label =
      typeof labelRaw === "string" && labelRaw.trim()
        ? labelRaw.trim().slice(0, 120)
        : "Qualification";
    const qual: HrQualificationDoc = { ...meta, label };
    const profile = await getHrProfile(userId);
    const nextQuals = [...profile.qualifications, qual];
    const saved = await setQualifications(userId, nextQuals);
    return NextResponse.json({ profile: saved });
  } catch (e) {
    await deleteStoredFileIfExists(meta.storedRelative);
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireHrAccess();
  if (!gate.ok) return gate.response;

  let body: { docId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const docId = typeof body.docId === "string" ? body.docId.trim() : "";
  if (!docId) {
    return NextResponse.json({ error: "docId required" }, { status: 400 });
  }

  const found = await findDocumentById(docId);
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = found.userId === gate.session.userId;
  const isHr =
    hasPermission(gate.session.permissions, "hr_manage") ||
    hasPermission(gate.session.permissions, "users_manage");
  if (!isOwner && !isHr) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteStoredFileIfExists(found.meta.storedRelative);

  if (found.kind === "wwcc") {
    const profile = await setProfileDocument(found.userId, "wwcc", null);
    return NextResponse.json({ profile });
  }
  if (found.kind === "policeCheck") {
    const profile = await setProfileDocument(found.userId, "policeCheck", null);
    return NextResponse.json({ profile });
  }

  const profile = await getHrProfile(found.userId);
  const nextQuals = profile.qualifications.filter((q) => q.id !== docId);
  const saved = await setQualifications(found.userId, nextQuals);
  return NextResponse.json({ profile: saved });
}
