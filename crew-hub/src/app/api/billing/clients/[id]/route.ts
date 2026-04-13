import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import {
  deleteBillingClient,
  getBillingClient,
  updateBillingClient,
} from "@/lib/billing-clients-store";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  const item = await getBillingClient(ctx.params.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  let body: {
    name?: string;
    email?: string;
    company?: string;
    address?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateBillingClient>[1] = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.email !== undefined) patch.email = body.email;
  if (body.company !== undefined) patch.company = body.company;
  if (body.address !== undefined) patch.address = body.address;
  if (body.notes !== undefined) patch.notes = body.notes;

  const updated = await updateBillingClient(ctx.params.id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  const ok = await deleteBillingClient(ctx.params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
