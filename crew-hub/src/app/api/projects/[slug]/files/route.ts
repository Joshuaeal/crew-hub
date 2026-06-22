import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { getProjectBySlug } from "@/lib/projects-store";
import {
  assertAllowedUpload,
  listProjectFiles,
  saveProjectFileMeta,
  writeProjectFile,
} from "@/lib/project-files-store";
import type { ProjectFile } from "@/types/projects";

type Ctx = { params: { slug: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;
  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const files = await listProjectFiles(project.id);
  return NextResponse.json({ files });
}

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
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
    else if (lower.endsWith(".docx"))
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (!mimeType) mimeType = "application/octet-stream";

  try {
    assertAllowedUpload(mimeType, buf.length);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload rejected" }, { status: 400 });
  }

  const docId = crypto.randomUUID();
  const { storedRelative } = await writeProjectFile(project.id, buf, file.name, docId);

  const meta: ProjectFile = {
    id: docId,
    projectId: project.id,
    filename: file.name,
    storedRelative,
    mimeType,
    sizeBytes: buf.length,
    uploadedByEmail: gate.session.email,
    uploadedAt: new Date().toISOString(),
  };

  await saveProjectFileMeta(meta);
  return NextResponse.json({ file: meta });
}
