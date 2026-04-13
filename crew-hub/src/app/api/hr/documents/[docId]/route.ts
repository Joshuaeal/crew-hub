import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { findDocumentById, getHrDocumentsRootAbs } from "@/lib/hr-profile-store";

type Ctx = { params: Promise<{ docId: string }> };

function contentDisposition(originalName: string): string {
  const safe = originalName.replace(/[^\x20-\x7E]/g, "_").slice(0, 120);
  return `attachment; filename="${safe}"`;
}

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { docId } = await ctx.params;
  if (!docId || !/^[a-f0-9-]{36}$/i.test(docId)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  const found = await findDocumentById(docId);
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = found.userId === session.userId;
  const isHr =
    hasPermission(session.permissions, "hr_manage") ||
    hasPermission(session.permissions, "users_manage");
  if (!isOwner && !isHr) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const root = getHrDocumentsRootAbs();
  const abs = path.join(root, found.meta.storedRelative.replace(/^[/\\]+/, ""));
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(path.resolve(root))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(resolved);
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": found.meta.mimeType || "application/octet-stream",
      "Content-Disposition": contentDisposition(found.meta.originalName),
    },
  });
}
