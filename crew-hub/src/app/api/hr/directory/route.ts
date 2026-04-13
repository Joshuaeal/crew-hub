import { NextResponse } from "next/server";
import { requireHrAccess } from "@/lib/api-auth";
import { readUsers } from "@/lib/users-store";

export async function GET() {
  const gate = await requireHrAccess();
  if (!gate.ok) return gate.response;

  const users = await readUsers();
  const items = users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
  }));

  return NextResponse.json({ users: items });
}
