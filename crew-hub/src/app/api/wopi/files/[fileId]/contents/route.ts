import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { getProjectFile, getProjectFileAbsPath, updateProjectFileMeta } from "@/lib/project-files-store";
import { verifyWopiToken } from "@/lib/wopi-token";

export const dynamic = "force-dynamic";

type Ctx = { params: { fileId: string } };

// WOPI GetFile
export async function GET(req: Request, ctx: Ctx) {
  const url = new URL(req.url);
  const token = url.searchParams.get("access_token") ?? "";
  const claimedFileId = await verifyWopiToken(token);
  if (!claimedFileId || claimedFileId !== ctx.params.fileId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const meta = await getProjectFile(ctx.params.fileId);
  if (!meta) return new NextResponse("Not found", { status: 404 });

  const abs = getProjectFileAbsPath(meta.storedRelative);
  let buf: Buffer;
  try {
    buf = await fs.readFile(abs);
  } catch {
    return new NextResponse("File not found on disk", { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": meta.mimeType,
      "Content-Length": String(buf.length),
    },
  });
}

// WOPI PutFile — Collabora posts the full updated file here on save
export async function POST(req: Request, ctx: Ctx) {
  const url = new URL(req.url);
  const token = url.searchParams.get("access_token") ?? "";
  const claimedFileId = await verifyWopiToken(token);
  if (!claimedFileId || claimedFileId !== ctx.params.fileId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const meta = await getProjectFile(ctx.params.fileId);
  if (!meta) return new NextResponse("Not found", { status: 404 });

  const body = await req.arrayBuffer();
  const buf = Buffer.from(body);

  const abs = getProjectFileAbsPath(meta.storedRelative);
  await fs.writeFile(abs, buf);

  await updateProjectFileMeta({ ...meta, sizeBytes: buf.length });

  return new NextResponse(null, { status: 200 });
}
