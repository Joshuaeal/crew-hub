import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRecord } from "@/lib/users-store";
import type { CrewRole } from "@/types/crew-role";
import { isCrewRole } from "@/types/crew-role";

export const COOKIE_NAME = "crew_session";

/** Secure session cookie flags — use the incoming request so HTTP deployments work when not using TLS. */
export function getSessionCookieOptions(
  request?: Request,
  opts?: { maxAge?: number }
): { httpOnly: true; sameSite: "lax"; secure: boolean; path: string; maxAge: number } {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(request),
    path: "/",
    maxAge: opts?.maxAge ?? 60 * 60 * 24 * 7,
  };
}

function sessionCookieSecure(request?: Request): boolean {
  if (process.env.CREW_SESSION_COOKIE_SECURE === "0") return false;
  if (process.env.CREW_SESSION_COOKIE_SECURE === "1") return true;
  const proto = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  // Only mark Secure when the incoming request is explicitly HTTPS (e.g. TLS terminator sets
  // x-forwarded-proto). If proto is missing — typical for http://127.0.0.1:38471 in production
  // Docker — Secure cookies are rejected by the browser and sign-in loops on /login?next=...
  return proto === "https";
}

export type CrewSession = {
  userId: string;
  email: string;
  username: string;
  role: CrewRole;
  permissions: string[];
};

function getSecretBytes(): Uint8Array | null {
  const s = process.env.CREW_SESSION_SECRET;
  if (!s || s.length < 16) return null;
  return new TextEncoder().encode(s);
}

export async function createSessionToken(user: UserRecord) {
  const bytes = getSecretBytes();
  if (!bytes) {
    throw new Error("CREW_SESSION_SECRET must be set (min 16 characters)");
  }
  return new SignJWT({
    sub: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    permissions: user.permissions,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(bytes);
}

export async function verifySessionToken(token: string): Promise<CrewSession | null> {
  const bytes = getSecretBytes();
  if (!bytes) {
    throw new Error("CREW_SESSION_SECRET must be set (min 16 characters)");
  }
  const { payload } = await jwtVerify(token, bytes);
  const role = payload.role;
  const sub = payload.sub;
  const email = payload.email;
  const username = payload.username;
  const permissions = payload.permissions;

  if (typeof sub !== "string" || !isCrewRole(role)) return null;
  if (typeof email !== "string" || typeof username !== "string") return null;
  if (!Array.isArray(permissions) || !permissions.every((p) => typeof p === "string")) {
    return null;
  }

  return {
    userId: sub,
    email,
    username,
    role,
    permissions,
  };
}

export async function getSession(): Promise<CrewSession | null> {
  const bytes = getSecretBytes();
  if (!bytes) return null;
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
