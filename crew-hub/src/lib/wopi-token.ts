import { SignJWT, jwtVerify } from "jose";

const WOPI_SECRET = new TextEncoder().encode(
  process.env.CREW_SESSION_SECRET ?? "crew-hub-wopi-secret-change-me"
);

export async function createWopiToken(fileId: string): Promise<string> {
  return new SignJWT({ fileId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(WOPI_SECRET);
}

export async function verifyWopiToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, WOPI_SECRET);
    return typeof payload.fileId === "string" ? payload.fileId : null;
  } catch {
    return null;
  }
}
