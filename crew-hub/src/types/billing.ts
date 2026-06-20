export type BillingDocumentKind = "invoice" | "quote";

/** Invoice: draft → sent → paid | void. Quote: draft → sent → accepted | declined | void. */
export type BillingStatus =
  | "draft"
  | "sent"
  | "paid"
  | "void"
  | "accepted"
  | "declined";

/** All amounts are AUD. Unit price is excluding GST unless gstExempt is true (then no GST applies). */
export type BillingLineItem = {
  id: string;
  description: string;
  quantity: number;
  /** Unit price ex GST (AUD), decimal string e.g. "100.00" */
  unitPrice: string;
  /** When true, line has no GST (GST-free / input taxed / out of scope as you define). */
  gstExempt: boolean;
  /** When set, labour line was tied to a hub user (HR crew on-hands rate). */
  hrUserId?: string;
  /** Whether the unit price is per hour or per day. Defaults to hourly. */
  rateUnit?: "hourly" | "daily";
};

export const BILLING_CURRENCY = "AUD" as const;
export const GST_RATE = 0.1;

/** Gear hire rate tier for the whole document; gear lines use matching catalog prices when available. */
export type PriceTier = "low" | "mid" | "high";

/** A single tier/option within a packaged quote. */
export type QuotePackage = {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  lineItems: BillingLineItem[];
};

export type BillingDocument = {
  id: string;
  kind: BillingDocumentKind;
  /** Human-readable number e.g. INV-2026-0001 or QUO-2026-0001 */
  number: string;
  /** Issue date/time (ISO). When unset, UI falls back to createdAt. */
  invoiceDate?: string;
  /** Optional customer reference / PO / job reference. */
  referenceNo?: string;
  /** Optional freeform header note shown near the top (not in Notes/Terms). */
  headerText?: string;
  /** Always AUD */
  currency: typeof BILLING_CURRENCY;
  clientId?: string;
  customerName: string;
  customerEmail?: string;
  /** Shown as main heading (falls back to number in print). */
  documentTitle?: string;
  /** Short summary shown under customer block. */
  brief?: string;
  /** Include gear/equipment section in totals and PDF. */
  includeGear: boolean;
  /** Include labour section in totals and PDF. */
  includeLabour: boolean;
  /** Applied to gear lines when resolving prices from the line-item library (default mid). */
  priceTier?: PriceTier;
  gearLineItems: BillingLineItem[];
  labourLineItems: BillingLineItem[];
  status: BillingStatus;
  notes?: string;
  termsText?: string;
  sendFromEmail?: string;
  followUpEnabled: boolean;
  followUpIntervalDays?: number[];
  nextFollowUpAt?: string;
  lastFollowUpAt?: string;
  followUpStage: number;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
  /** Project slug this document was created from, if any. */
  projectSlug?: string;
  /** When true (quotes only), document is structured as tiered packages instead of a flat line-item list. */
  usePackages?: boolean;
  /** Package tiers (quotes only, when usePackages is true). */
  packages?: QuotePackage[];
};

/** @deprecated use BillingDocument */
export type BillingInvoice = BillingDocument;

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Lines that count toward GST and totals (respects section toggles). */
export function activeBillingLines(doc: BillingDocument): BillingLineItem[] {
  const out: BillingLineItem[] = [];
  if (doc.includeGear !== false) {
    const g = doc.gearLineItems?.length ? doc.gearLineItems : [];
    for (const line of g) {
      if (line.description?.trim()) out.push(line);
    }
  }
  if (doc.includeLabour !== false) {
    for (const line of doc.labourLineItems ?? []) {
      if (line.description?.trim()) out.push(line);
    }
  }
  return out;
}

/** Per-line ex-GST, GST (10% of ex-GST line), and total inc-GST. */
export function computeBillingTotals(lineItems: BillingLineItem[]): {
  subtotalExGst: number;
  gstAmount: number;
  totalIncGst: number;
} {
  let sub = 0;
  let gst = 0;
  for (const line of lineItems) {
    const q = Number(line.quantity) || 0;
    const p = parseFloat(line.unitPrice) || 0;
    const lineEx = roundMoney2(q * p);
    sub = roundMoney2(sub + lineEx);
    if (!line.gstExempt) {
      gst = roundMoney2(gst + roundMoney2(lineEx * GST_RATE));
    }
  }
  const totalIncGst = roundMoney2(sub + gst);
  return { subtotalExGst: sub, gstAmount: gst, totalIncGst };
}

/** Totals for a single quote package. */
export function packageTotals(pkg: QuotePackage) {
  return computeBillingTotals(pkg.lineItems.filter((l) => l.description?.trim()));
}

/** Total range for a packaged quote — null when not packaged. */
export function packagedQuoteTotalRange(doc: BillingDocument): { min: number; max: number } | null {
  if (!doc.usePackages || !doc.packages?.length) return null;
  const tots = doc.packages.map((p) => packageTotals(p).totalIncGst);
  return { min: Math.min(...tots), max: Math.max(...tots) };
}

/** Total inc-GST for a document (gear + labour per toggles). For packaged quotes returns the lowest package total. */
export function billingDocumentTotal(doc: BillingDocument): number {
  const range = packagedQuoteTotalRange(doc);
  if (range) return range.min;
  return computeBillingTotals(activeBillingLines(doc)).totalIncGst;
}

/** Human-readable total label: range string for packaged quotes, fixed amount otherwise. */
export function billingDocumentTotalLabel(doc: BillingDocument): string {
  const range = packagedQuoteTotalRange(doc);
  if (range) {
    if (range.min === range.max) return `${range.min.toFixed(2)}`;
    return `${range.min.toFixed(2)} – ${range.max.toFixed(2)}`;
  }
  return billingDocumentTotal(doc).toFixed(2);
}

/** @deprecated use billingDocumentTotal(doc) */
export function sumInvoiceTotal(lineItems: BillingLineItem[]): number {
  return computeBillingTotals(lineItems).totalIncGst;
}

export function defaultStatusesForKind(kind: BillingDocumentKind): BillingStatus[] {
  if (kind === "quote") return ["draft", "sent", "accepted", "declined", "void"];
  return ["draft", "sent", "paid", "void"];
}

export type BillingClient = {
  id: string;
  name: string;
  email?: string;
  company?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/** Saved line presets (Odoo-style product/service catalog). */
export type BillingCatalogItem = {
  id: string;
  name: string;
  /** Default unit price ex GST, AUD — same as mid tier for gear hire presets */
  unitPrice: string;
  /** Low / mid / high hire rates (AUD ex GST); when missing, `unitPrice` is used for that tier */
  unitPriceLow?: string;
  unitPriceMid?: string;
  unitPriceHigh?: string;
  defaultGstExempt: boolean;
  sku?: string;
  /** When set, catalog row is synced from this inventory item */
  inventoryItemId?: string;
  createdAt: string;
  updatedAt: string;
};

export function catalogUnitPriceForTier(c: BillingCatalogItem, tier: PriceTier): string {
  const mid = (c.unitPriceMid ?? c.unitPrice ?? "").trim() || "0";
  const low = (c.unitPriceLow ?? "").trim();
  const high = (c.unitPriceHigh ?? "").trim();
  if (tier === "low" && low) return low;
  if (tier === "high" && high) return high;
  return mid;
}

export type BillingSettings = {
  defaultTerms: string;
  defaultFromEmail: string;
  followUpIntervalDays: number[];
  globalInvoiceCss: string;
};

export const defaultBillingSettings = (): BillingSettings => ({
  defaultTerms:
    "Prices are in AUD. Taxable supplies include GST of 10%. Payment due as agreed.",
  defaultFromEmail: "",
  followUpIntervalDays: [7, 14, 30],
  globalInvoiceCss: "",
});
