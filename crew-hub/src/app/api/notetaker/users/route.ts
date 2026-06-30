import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { readUsers } from "@/lib/users-store";

export async function GET() {
  const gate = await requirePermission("notetaker");
  if (!gate.ok) return gate.response;

  const users = await readUsers();
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName ?? u.username,
    })),
  });
}
