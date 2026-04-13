import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { createInventoryJob, readInventoryJobs } from "@/lib/inventory-jobs-store";

export async function GET() {
  const gate = await requireAnyPermission(["inventory", "inventory_request"]);
  if (!gate.ok) return gate.response;
  const items = await readInventoryJobs();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const gate = await requireAnyPermission(["inventory", "users_manage"]);
  if (!gate.ok) return gate.response;

  let body: { name?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const row = await createInventoryJob({
    name,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    createdByEmail: gate.session.email,
  });

  return NextResponse.json({ item: row });
}
