import { NextResponse } from "next/server";
import { loginWithCredentials } from "@/lib/auth-login";

export async function POST(request: Request) {
  let body: { identifier?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const identifier =
    (typeof body.identifier === "string" && body.identifier.trim()) ||
    (typeof body.email === "string" && body.email.trim()) ||
    "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "Username or email and password are required" },
      { status: 400 }
    );
  }

  return loginWithCredentials(identifier, password, request);
}
