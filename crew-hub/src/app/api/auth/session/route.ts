import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      authenticated: false,
      userId: null,
      username: null,
      email: null,
      role: null,
      permissions: [],
    });
  }
  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    username: session.username,
    email: session.email,
    role: session.role,
    permissions: session.permissions,
  });
}
