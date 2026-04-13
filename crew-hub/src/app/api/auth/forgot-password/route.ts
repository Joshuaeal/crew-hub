import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/mail";
import { createPasswordResetToken } from "@/lib/password-reset-store";
import { findUserByEmail } from "@/lib/users-store";

function getPublicOrigin(request: Request): string {
  const env = process.env.NEXT_PUBLIC_CREW_PUBLIC_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a reset link was sent.",
    });
  }

  let token: string;
  try {
    token = await createPasswordResetToken(user.id);
  } catch {
    return NextResponse.json({ error: "Could not create reset token" }, { status: 500 });
  }

  const origin = getPublicOrigin(request);
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email failed";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link was sent.",
  });
}
