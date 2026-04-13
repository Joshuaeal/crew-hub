import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { createPayable, readPayables } from "@/lib/payables-store";
import type { PayableStatus } from "@/types/payables";

export async function GET() {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;
  const items = await readPayables();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  let body: {
    title?: string;
    vendor?: string;
    amountAudIncGst?: number;
    category?: string;
    status?: PayableStatus;
    dueDate?: string;
    linkedBillingDocumentId?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const amount =
    typeof body.amountAudIncGst === "number" && Number.isFinite(body.amountAudIncGst)
      ? body.amountAudIncGst
      : Number(body.amountAudIncGst);
  if (!title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amountAudIncGst must be a non-negative number" }, { status: 400 });
  }

  const email = gate.session.email ?? "";

  const row = await createPayable({
    title,
    vendor: typeof body.vendor === "string" ? body.vendor : undefined,
    amountAudIncGst: amount,
    category: typeof body.category === "string" ? body.category : undefined,
    status: body.status,
    dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
    linkedBillingDocumentId:
      typeof body.linkedBillingDocumentId === "string" ? body.linkedBillingDocumentId : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    createdByEmail: email,
  });

  return NextResponse.json({ item: row });
}
