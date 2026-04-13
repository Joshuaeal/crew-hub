import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import {
  deleteInventoryJob,
  getInventoryJob,
  updateInventoryJob,
} from "@/lib/inventory-jobs-store";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["inventory", "inventory_request"]);
  if (!gate.ok) return gate.response;

  const item = await getInventoryJob(ctx.params.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["inventory", "users_manage"]);
  if (!gate.ok) return gate.response;

  let body: { name?: string; notes?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateInventoryJob>[1] = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.notes !== undefined) patch.notes = body.notes === null ? undefined : body.notes;

  const updated = await updateInventoryJob(ctx.params.id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["inventory", "users_manage"]);
  if (!gate.ok) return gate.response;

  const ok = await deleteInventoryJob(ctx.params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
