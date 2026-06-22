import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { requireAnyPermission } from "@/lib/api-auth";
import { getProjectBySlug } from "@/lib/projects-store";
import {
  deleteProjectFile,
  getProjectFile,
  getProjectFileAbsPath,
} from "@/lib/project-files-store";

type Ctx = { params: { slug: string; fileId: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_view", "projects_manage"]);
  if (!gate.ok) return gate.response;

  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = await getProjectFile(ctx.params.fileId);
  if (!meta || meta.projectId !== project.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const abs = getProjectFileAbsPath(meta.storedRelative);
  let buf: Buffer;
  try {
    buf = await fs.readFile(abs);
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": meta.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(meta.filename)}"`,
      "Content-Length": String(meta.sizeBytes),
    },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = await getProjectFile(ctx.params.fileId);
  if (!meta || meta.projectId !== project.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteProjectFile(ctx.params.fileId);
  return NextResponse.json({ ok: true });
}
