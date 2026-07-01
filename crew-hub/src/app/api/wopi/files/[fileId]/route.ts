import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { getProjectFile } from "@/lib/project-files-store";

export const dynamic = "force-dynamic";

const WOPI_SECRET = new TextEncoder().encode(
  process.env.CREW_SESSION_SECRET ?? "crew-hub-wopi-secret-change-me"
);

export async function verifyWopiToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, WOPI_SECRET);
    return typeof payload.fileId === "string" ? payload.fileId : null;
  } catch {
    return null;
  }
}

export async function createWopiToken(fileId: string): Promise<string> {
  return new SignJWT({ fileId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(WOPI_SECRET);
}

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
