import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import {
  deleteBillingInvoice,
  getBillingInvoice,
  updateBillingInvoice,
} from "@/lib/billing-store";
import type { BillingDocumentKind, BillingStatus, PriceTier } from "@/types/billing";

function isStatus(v: string, kind: BillingDocumentKind): v is BillingStatus {
  const invoice: BillingStatus[] = ["draft", "sent", "paid", "void"];
  const quote: BillingStatus[] = ["draft", "sent", "accepted", "declined", "void"];
  const allowed = kind === "quote" ? quote : invoice;
  return allowed.includes(v as BillingStatus);
}

type Ctx = { params: { id: string } };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  const item = await getBillingInvoice(ctx.params.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  const existing = await getBillingInvoice(ctx.params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    customerName?: string;
    customerEmail?: string;
    clientId?: string;
    invoiceDate?: string;
    referenceNo?: string;
    headerText?: string;
    documentTitle?: string;
    brief?: string;
    includeGear?: boolean;
    includeLabour?: boolean;
    priceTier?: string;
    gearLineItems?: unknown;
    labourLineItems?: unknown;
    notes?: string;
    termsText?: string;
    sendFromEmail?: string;
    status?: string;
    followUpEnabled?: boolean;
    followUpIntervalDays?: number[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = existing.kind;
  const patch: Parameters<typeof updateBillingInvoice>[1] = {};
  if (body.customerName !== undefined) patch.customerName = body.customerName;
  if (body.customerEmail !== undefined) patch.customerEmail = body.customerEmail;
  if (body.clientId !== undefined) patch.clientId = body.clientId || undefined;
  if (body.invoiceDate !== undefined) patch.invoiceDate = body.invoiceDate || undefined;
  if (body.referenceNo !== undefined) patch.referenceNo = body.referenceNo || undefined;
  if (body.headerText !== undefined) patch.headerText = body.headerText || undefined;
  if (body.documentTitle !== undefined) patch.documentTitle = body.documentTitle;
  if (body.brief !== undefined) patch.brief = body.brief;
  if (body.includeGear !== undefined) patch.includeGear = body.includeGear;
  if (body.includeLabour !== undefined) patch.includeLabour = body.includeLabour;
  if (body.priceTier === "low" || body.priceTier === "mid" || body.priceTier === "high") {
    patch.priceTier = body.priceTier as PriceTier;
  }
  if (body.gearLineItems !== undefined) patch.gearLineItems = body.gearLineItems;
  if (body.labourLineItems !== undefined) patch.labourLineItems = body.labourLineItems;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.termsText !== undefined) patch.termsText = body.termsText;
  if (body.sendFromEmail !== undefined) patch.sendFromEmail = body.sendFromEmail;
  if (body.followUpEnabled !== undefined) patch.followUpEnabled = body.followUpEnabled;
  if (body.followUpIntervalDays !== undefined) {
    patch.followUpIntervalDays =
      body.followUpIntervalDays.length > 0 ? body.followUpIntervalDays : undefined;
  }
  if (body.status !== undefined) {
    if (!isStatus(body.status, kind)) {
      return NextResponse.json({ error: "Invalid status for document kind" }, { status: 400 });
    }
    patch.status = body.status;
  }

  const updated = await updateBillingInvoice(ctx.params.id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  const ok = await deleteBillingInvoice(ctx.params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
