import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { createBillingInvoice, readBillingInvoices } from "@/lib/billing-store";
import type { BillingDocumentKind, BillingStatus, PriceTier } from "@/types/billing";

function isStatus(v: string, kind: BillingDocumentKind): v is BillingStatus {
  const invoice: BillingStatus[] = ["draft", "sent", "paid", "void"];
  const quote: BillingStatus[] = ["draft", "sent", "accepted", "declined", "void"];
  const allowed = kind === "quote" ? quote : invoice;
  return allowed.includes(v as BillingStatus);
}

export async function GET() {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;
  const items = await readBillingInvoices();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  let body: {
    kind?: string;
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
    usePackages?: boolean;
    packages?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const customerName = typeof body.customerName === "string" ? body.customerName : "";
  if (!customerName.trim()) {
    return NextResponse.json({ error: "customerName is required" }, { status: 400 });
  }

  const kind: BillingDocumentKind = body.kind === "quote" ? "quote" : "invoice";
  const status =
    typeof body.status === "string" && isStatus(body.status, kind) ? body.status : undefined;

  const followUpIntervalDays = Array.isArray(body.followUpIntervalDays)
    ? body.followUpIntervalDays.filter((n): n is number => typeof n === "number" && n > 0)
    : undefined;

  const priceTier: PriceTier | undefined =
    body.priceTier === "low" || body.priceTier === "mid" || body.priceTier === "high"
      ? body.priceTier
      : undefined;

  const row = await createBillingInvoice({
    kind,
    customerName,
    customerEmail: typeof body.customerEmail === "string" ? body.customerEmail : undefined,
    clientId: typeof body.clientId === "string" ? body.clientId : undefined,
    invoiceDate: typeof body.invoiceDate === "string" ? body.invoiceDate : undefined,
    referenceNo: typeof body.referenceNo === "string" ? body.referenceNo : undefined,
    headerText: typeof body.headerText === "string" ? body.headerText : undefined,
    documentTitle: typeof body.documentTitle === "string" ? body.documentTitle : undefined,
    brief: typeof body.brief === "string" ? body.brief : undefined,
    includeGear: typeof body.includeGear === "boolean" ? body.includeGear : undefined,
    includeLabour: typeof body.includeLabour === "boolean" ? body.includeLabour : undefined,
    priceTier,
    gearLineItems: body.gearLineItems,
    labourLineItems: body.labourLineItems,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    termsText: typeof body.termsText === "string" ? body.termsText : undefined,
    sendFromEmail: typeof body.sendFromEmail === "string" ? body.sendFromEmail : undefined,
    status,
    followUpEnabled: typeof body.followUpEnabled === "boolean" ? body.followUpEnabled : undefined,
    followUpIntervalDays,
    createdByEmail: gate.session.email,
    usePackages: typeof body.usePackages === "boolean" ? body.usePackages : undefined,
    packages: body.packages,
  });

  return NextResponse.json({ item: row });
}
