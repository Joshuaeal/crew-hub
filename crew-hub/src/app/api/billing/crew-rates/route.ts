import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { readUsers } from "@/lib/users-store";

/** Crew directory for labour invoice lines (billing permission). */
export async function GET() {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  const users = await readUsers();
  const items = users.map((u) => {
    const label = (u.displayName?.trim() || u.username).trim();
    return {
      id: u.id,
      username: u.username,
      label,
      crewHandsRateAudExGst: u.crewHandsRateAudExGst ?? null,
    };
  });
  items.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  return NextResponse.json({ items });
}
