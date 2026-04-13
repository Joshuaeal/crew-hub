import { NextResponse } from "next/server";
import { takeResetToken } from "@/lib/password-reset-store";
import { updateUser } from "@/lib/users-store";

export async function POST(request: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Valid token and password (8+ characters) are required" },
      { status: 400 }
    );
  }

  const userIdFromToken = await takeResetToken(token);
  if (!userIdFromToken) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const updated = await updateUser(userIdFromToken, { password });
  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
