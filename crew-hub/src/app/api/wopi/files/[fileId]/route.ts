import { NextResponse } from "next/server";
import { verifyWopiToken } from "@/lib/wopi-token";
import { getProjectFile } from "@/lib/project-files-store";

export const dynamic = "force-dynamic";

type Ctx = { params: { fileId: string } };

// WOPI CheckFileInfo
export async function GET(req: Request, ctx: Ctx) {
  const url = new URL(req.url);
  const token = url.searchParams.get("access_token") ?? "";
  const claimedFileId = await verifyWopiToken(token);
  if (!claimedFileId || claimedFileId !== ctx.params.fileId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const meta = await getProjectFile(ctx.params.fileId);
  if (!meta) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({
    BaseFileName: meta.filename,
    Size: meta.sizeBytes,
    OwnerId: meta.uploadedByEmail,
    UserId: meta.uploadedByEmail,
    UserFriendlyName: meta.uploadedByEmail,
    UserCanWrite: true,
    UserCanRename: false,
    SupportsUpdate: true,
    SupportsLocks: false,
  });
}
