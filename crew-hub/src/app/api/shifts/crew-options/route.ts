import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { readUsers } from "@/lib/users-store";

/** Emails for assigning crew when posting a shift (shifts_manage). */
export async function GET() {
  const gate = await requirePermission("shifts_manage");
  if (!gate.ok) return gate.response;

  const users = await readUsers();
  const items = users.map((u) => ({
    email: u.email.toLowerCase(),
    username: u.username,
    displayName: u.displayName?.trim() || u.username,
  }));
  items.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));

  return NextResponse.json({ users: items });
}
