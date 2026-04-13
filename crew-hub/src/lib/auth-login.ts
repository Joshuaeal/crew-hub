import { NextResponse } from "next/server";
import { COOKIE_NAME, createSessionToken, getSessionCookieOptions } from "@/lib/session";
import { findUserByIdentifier, verifyUserPassword } from "@/lib/users-store";

export async function loginWithCredentials(identifier: string, password: string, request?: Request) {
  const user = await findUserByIdentifier(identifier);
  if (!user || !(await verifyUserPassword(user, password))) {
    return NextResponse.json({ error: "Invalid username/email or password" }, { status: 401 });
  }
  try {
    const token = await createSessionToken(user);
    const res = NextResponse.json({
      ok: true,
      role: user.role,
      permissions: user.permissions,
      username: user.username,
      email: user.email,
    });
    res.cookies.set(COOKIE_NAME, token, getSessionCookieOptions(request));
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Session error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
