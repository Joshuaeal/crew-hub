import { NextResponse } from "next/server";
import { matrixProvisioningEnabled, upsertMatrixUser } from "@/lib/matrix-provision";
import { COOKIE_NAME, createSessionToken, getSessionCookieOptions } from "@/lib/session";
import { createUser, readUsers } from "@/lib/users-store";

const MIN_PASSWORD = 10;

export async function POST(request: Request) {
  const secret = process.env.CREW_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { error: "Server not configured: set CREW_SESSION_SECRET (16+ chars)" },
      { status: 503 }
    );
  }

  let body: {
    username?: string;
    email?: string;
    password?: string;
    passwordConfirm?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const users = await readUsers();
  if (users.length > 0) {
    return NextResponse.json({ error: "An account already exists. Sign in instead." }, { status: 403 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

  if (!username.trim() || !email.trim() || !password) {
    return NextResponse.json(
      { error: "Username, email, and password are required" },
      { status: 400 }
    );
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD} characters` },
      { status: 400 }
    );
  }

  let user;
  try {
    user = await createUser({
      username,
      email,
      password,
      role: "admin",
      permissions: ["*"],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create account";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  let matrixSyncError: string | undefined;
  if (matrixProvisioningEnabled()) {
    try {
      await upsertMatrixUser({
        localpart: user.username,
        password,
        displayName: undefined,
        logoutDevices: false,
      });
    } catch (e) {
      matrixSyncError = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    const token = await createSessionToken(user);
    const res = NextResponse.json({
      ok: true,
      role: user.role,
      permissions: user.permissions,
      username: user.username,
      email: user.email,
      ...(matrixProvisioningEnabled()
        ? matrixSyncError
          ? {
              matrixSyncFailed: true,
              matrixSyncError,
            }
          : { matrixSynced: true }
        : {}),
    });
    res.cookies.set(COOKIE_NAME, token, getSessionCookieOptions(request));
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Session error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
