import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { deletePayable, updatePayable } from "@/lib/payables-store";
import type { PayableStatus } from "@/types/payables";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: {
    title?: string;
    vendor?: string | null;
    amountAudIncGst?: number;
    category?: string | null;
    status?: PayableStatus;
    dueDate?: string | null;
    paidAt?: string | null;
    linkedBillingDocumentId?: string | null;
    notes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updated = await updatePayable(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const ok = await deletePayable(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
