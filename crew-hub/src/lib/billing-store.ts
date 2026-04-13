import { promises as fs } from "fs";
import path from "path";
import type {
  BillingDocument,
  BillingDocumentKind,
  BillingLineItem,
  BillingStatus,
  PriceTier,
} from "@/types/billing";
import { BILLING_CURRENCY } from "@/types/billing";
import { readBillingSettings } from "@/lib/billing-settings-store";
import { readInstanceSettings } from "@/lib/instance-settings-store";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "billing-invoices.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

function defaultLine(): BillingLineItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: "0", gstExempt: false };
}

/** Parse line array; returns [] if input empty. */
function parseLineItemsArray(raw: unknown): BillingLineItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BillingLineItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const description = typeof o.description === "string" ? o.description.trim() : "";
    const quantity = typeof o.quantity === "number" ? o.quantity : Number(o.quantity);
    const unitPrice = typeof o.unitPrice === "string" ? o.unitPrice.trim() : String(o.unitPrice ?? "0");
    const gstExempt = o.gstExempt === true;
    if (!description) continue;
    const hrUserId = typeof o.hrUserId === "string" && o.hrUserId.trim() ? o.hrUserId.trim() : undefined;
    out.push({
      id: typeof o.id === "string" ? o.id : crypto.randomUUID(),
      description,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unitPrice: unitPrice || "0",
      gstExempt,
      ...(hrUserId ? { hrUserId } : {}),
    });
  }
  return out;
}

function normalizeLineItems(raw: unknown): BillingLineItem[] {
  const parsed = parseLineItemsArray(raw);
  return parsed.length > 0
    ? parsed
    : [
        {
          id: crypto.randomUUID(),
          description: "Line item",
          quantity: 1,
          unitPrice: "0",
          gstExempt: false,
        },
      ];
}

function normalizePriceTier(raw: unknown): PriceTier | undefined {
  if (raw === "low" || raw === "mid" || raw === "high") return raw;
  return undefined;
}

function migrateRow(raw: unknown): BillingDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const number = typeof o.number === "string" ? o.number : "";
  if (!id || !number) return null;
  const kind: BillingDocumentKind = o.kind === "quote" ? "quote" : "invoice";
  const status = o.status;
  let st: BillingStatus = "draft";
  if (status === "sent" || status === "paid" || status === "void") st = status;
  else if (status === "accepted" || status === "declined") st = status;
  else if (status === "draft") st = "draft";

  const followUpStage =
    typeof o.followUpStage === "number" && o.followUpStage >= 0 ? o.followUpStage : 0;

  const legacyLineItems = Array.isArray(o.lineItems) ? o.lineItems : undefined;
  const hasGear = Array.isArray(o.gearLineItems);
  const hasLabour = Array.isArray(o.labourLineItems);

  let gearLineItems: BillingLineItem[];
  let labourLineItems: BillingLineItem[];
  let includeGear: boolean;
  let includeLabour: boolean;

  if (hasGear || hasLabour) {
    gearLineItems = hasGear ? normalizeLineItems(o.gearLineItems) : normalizeLineItems(legacyLineItems);
    labourLineItems = hasLabour ? parseLineItemsArray(o.labourLineItems) : [];
    includeGear = o.includeGear !== false;
    includeLabour = o.includeLabour !== false;
  } else {
    gearLineItems = legacyLineItems ? normalizeLineItems(legacyLineItems) : normalizeLineItems([]);
    labourLineItems = [];
    includeGear = true;
    includeLabour = false;
  }

  const documentTitle = typeof o.documentTitle === "string" ? o.documentTitle : undefined;
  const brief = typeof o.brief === "string" ? o.brief : undefined;
  const priceTier = normalizePriceTier(o.priceTier);
  const invoiceDate = typeof o.invoiceDate === "string" ? o.invoiceDate : undefined;
  const referenceNo = typeof o.referenceNo === "string" ? o.referenceNo : undefined;
  const headerText = typeof o.headerText === "string" ? o.headerText : undefined;

  return {
    id,
    kind,
    number,
    invoiceDate,
    referenceNo,
    headerText,
    currency: BILLING_CURRENCY,
    clientId: typeof o.clientId === "string" ? o.clientId : undefined,
    customerName: typeof o.customerName === "string" ? o.customerName : "Customer",
    customerEmail: typeof o.customerEmail === "string" ? o.customerEmail : undefined,
    documentTitle,
    brief,
    includeGear,
    includeLabour,
    priceTier,
    gearLineItems,
    labourLineItems,
    status: st,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    termsText: typeof o.termsText === "string" ? o.termsText : undefined,
    sendFromEmail: typeof o.sendFromEmail === "string" ? o.sendFromEmail : undefined,
    followUpEnabled: typeof o.followUpEnabled === "boolean" ? o.followUpEnabled : false,
    followUpIntervalDays: Array.isArray(o.followUpIntervalDays)
      ? (o.followUpIntervalDays as unknown[]).filter((x): x is number => typeof x === "number" && x > 0)
      : undefined,
    nextFollowUpAt: typeof o.nextFollowUpAt === "string" ? o.nextFollowUpAt : undefined,
    lastFollowUpAt: typeof o.lastFollowUpAt === "string" ? o.lastFollowUpAt : undefined,
    followUpStage,
    sentAt: typeof o.sentAt === "string" ? o.sentAt : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
    createdByEmail: typeof o.createdByEmail === "string" ? o.createdByEmail : "system",
  };
}

let migrationChecked = false;

export async function readBillingInvoices(): Promise<BillingDocument[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const arr = Array.isArray(parsed) ? parsed : [];
    const rows = arr.map(migrateRow).filter((x): x is BillingDocument => x !== null);

    if (!migrationChecked) {
      migrationChecked = true;
      const needsWrite = arr.some((r) => {
        if (!r || typeof r !== "object") return false;
        const o = r as Record<string, unknown>;
        if (o.currency && o.currency !== "AUD") return true;
        const lines = o.lineItems;
        if (Array.isArray(lines)) {
          const badGst = lines.some(
            (line) =>
              line &&
              typeof line === "object" &&
              !("gstExempt" in (line as object))
          );
          if (badGst) return true;
        }
        if (!("kind" in o)) return true;
        if ("lineItems" in o && !("gearLineItems" in o)) return true;
        if ("customCss" in o) return true;
        return false;
      });
      if (needsWrite) {
        await writeAll(rows);
      }
    }
    return rows;
  } catch {
    return [];
  }
}

async function writeAll(rows: BillingDocument[]) {
  await ensureDataFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

export async function getBillingInvoice(id: string): Promise<BillingDocument | undefined> {
  const all = await readBillingInvoices();
  return all.find((r) => r.id === id);
}

async function nextNumber(kind: BillingDocumentKind): Promise<string> {
  const all = await readBillingInvoices();
  const year = new Date().getFullYear();
  const kindCode = kind === "quote" ? "QUO" : "INV";
  const defaultFormat = `${kindCode}-{YYYY}-{SEQ:4}`;
  const inst = await readInstanceSettings().catch(() => null);
  const format =
    kind === "invoice" ? inst?.invoiceNumberFormat?.trim() || defaultFormat : defaultFormat;

  const yy = String(year).slice(-2);

  // Determine seq padding from {SEQ:4} (defaults to 4 when unspecified).
  const mPad = /\{SEQ:(\d+)\}/.exec(format);
  const pad = mPad ? Math.min(10, Math.max(1, parseInt(mPad[1] || "4", 10) || 4)) : 4;

  // Build a regex that matches the *current year* for {YYYY}/{YY} and captures the sequence.
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRe = /\{KIND\}|\{YYYY\}|\{YY\}|\{SEQ(?::\d+)?\}/g;
  let rx = "";
  let last = 0;
  for (;;) {
    const m = tokenRe.exec(format);
    if (!m) break;
    const start = m.index;
    const tok = m[0] || "";
    rx += esc(format.slice(last, start));
    if (tok === "{KIND}") rx += esc(kindCode);
    else if (tok === "{YYYY}") rx += esc(String(year));
    else if (tok === "{YY}") rx += esc(yy);
    else rx += "(\\d{1,10})";
    last = start + tok.length;
  }
  rx += esc(format.slice(last));
  const re = new RegExp(`^${rx}$`);

  let max = 0;
  let any = false;
  for (const inv of all) {
    if (inv.kind !== kind) continue;
    const mm = re.exec(inv.number);
    if (!mm) continue;
    const n = parseInt(mm[1] || "", 10);
    if (!Number.isNaN(n)) {
      any = true;
      max = Math.max(max, n);
    }
  }
  if (!any) {
    const start = inst?.invoiceSequenceStart;
    if (typeof start === "number" && Number.isFinite(start) && start >= 0) {
      max = Math.max(max, start);
    }
  }
  const nextSeq = max + 1;

  const seqRaw = String(nextSeq).padStart(pad, "0");
  return format
    .replaceAll("{KIND}", kindCode)
    .replaceAll("{YYYY}", String(year))
    .replaceAll("{YY}", yy)
    .replaceAll(/\{SEQ(?::\d+)?\}/g, seqRaw);
}

function computeNextFollowUp(base: Date, stage: number, intervals: number[]): string | undefined {
  if (intervals.length === 0 || stage >= intervals.length) return undefined;
  const days = intervals[stage];
  const t = new Date(base);
  t.setDate(t.getDate() + days);
  return t.toISOString();
}

function activeIntervals(doc: BillingDocument, settingsIntervals: number[]): number[] {
  if (doc.followUpIntervalDays && doc.followUpIntervalDays.length > 0) return doc.followUpIntervalDays;
  return settingsIntervals;
}

export async function createBillingInvoice(input: {
  kind?: BillingDocumentKind;
  customerName: string;
  customerEmail?: string;
  clientId?: string;
  invoiceDate?: string;
  referenceNo?: string;
  headerText?: string;
  gearLineItems?: unknown;
  labourLineItems?: unknown;
  documentTitle?: string;
  brief?: string;
  includeGear?: boolean;
  includeLabour?: boolean;
  priceTier?: PriceTier;
  notes?: string;
  termsText?: string;
  sendFromEmail?: string;
  status?: BillingStatus;
  followUpEnabled?: boolean;
  followUpIntervalDays?: number[];
  createdByEmail: string;
}): Promise<BillingDocument> {
  const settings = await readBillingSettings();
  const all = await readBillingInvoices();
  const now = new Date().toISOString();
  const kind = input.kind ?? "invoice";
  const number = await nextNumber(kind);
  const followUpEnabled = input.followUpEnabled ?? false;
  const status = input.status ?? "draft";
  const includeGear = input.includeGear !== false;
  const includeLabour = input.includeLabour !== false;

  const gearPersist = includeGear ? normalizeLineItems(input.gearLineItems) : [];
  const labourParsed = parseLineItemsArray(input.labourLineItems);
  const labourPersist = includeLabour
    ? labourParsed.length === 0
      ? [defaultLine()]
      : labourParsed
    : [];

  const row: BillingDocument = {
    id: crypto.randomUUID(),
    kind,
    number,
    invoiceDate: input.invoiceDate?.trim() || undefined,
    referenceNo: input.referenceNo?.trim() || undefined,
    headerText: input.headerText?.trim() || undefined,
    currency: BILLING_CURRENCY,
    clientId: input.clientId?.trim() || undefined,
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail?.trim() || undefined,
    documentTitle: input.documentTitle?.trim() || undefined,
    brief: input.brief?.trim() || undefined,
    includeGear,
    includeLabour,
    priceTier: input.priceTier === "low" || input.priceTier === "high" ? input.priceTier : "mid",
    gearLineItems: gearPersist,
    labourLineItems: labourPersist,
    status,
    notes: input.notes?.trim() || undefined,
    termsText: input.termsText?.trim() || undefined,
    sendFromEmail: input.sendFromEmail?.trim() || undefined,
    followUpEnabled,
    followUpIntervalDays:
      input.followUpIntervalDays && input.followUpIntervalDays.length > 0
        ? input.followUpIntervalDays
        : undefined,
    followUpStage: 0,
    createdAt: now,
    updatedAt: now,
    createdByEmail: input.createdByEmail,
  };

  if (status === "sent" && followUpEnabled) {
    row.sentAt = now;
    const iv = activeIntervals(row, settings.followUpIntervalDays);
    row.nextFollowUpAt = computeNextFollowUp(new Date(), 0, iv);
  }

  all.unshift(row);
  await writeAll(all);
  return row;
}

export async function updateBillingInvoice(
  id: string,
  patch: Partial<{
    kind: BillingDocumentKind;
    customerName: string;
    clientId: string | undefined;
    customerEmail: string | undefined;
    invoiceDate: string | undefined;
    referenceNo: string | undefined;
    headerText: string | undefined;
    documentTitle: string | undefined;
    brief: string | undefined;
    includeGear: boolean;
    includeLabour: boolean;
    priceTier: PriceTier;
    gearLineItems: unknown;
    labourLineItems: unknown;
    notes: string | undefined;
    termsText: string | undefined;
    sendFromEmail: string | undefined;
    status: BillingStatus;
    followUpEnabled: boolean;
    followUpIntervalDays: number[] | undefined;
    nextFollowUpAt: string | undefined;
    lastFollowUpAt: string | undefined;
    followUpStage: number;
    sentAt: string | undefined;
  }>
): Promise<BillingDocument | null> {
  const settings = await readBillingSettings();
  const all = await readBillingInvoices();
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const cur = all[i];
  const now = new Date().toISOString();

  const newStatus = patch.status !== undefined ? patch.status : cur.status;
  const newFollow = patch.followUpEnabled !== undefined ? patch.followUpEnabled : cur.followUpEnabled;

  const sentAt = patch.sentAt !== undefined ? patch.sentAt : cur.sentAt;
  const followUpStage = patch.followUpStage !== undefined ? patch.followUpStage : cur.followUpStage;
  const lastFollowUpAt = patch.lastFollowUpAt !== undefined ? patch.lastFollowUpAt : cur.lastFollowUpAt;
  const nextFollowUpAt = patch.nextFollowUpAt !== undefined ? patch.nextFollowUpAt : cur.nextFollowUpAt;

  const nextIncludeGear = patch.includeGear !== undefined ? patch.includeGear : cur.includeGear;
  const nextIncludeLabour = patch.includeLabour !== undefined ? patch.includeLabour : cur.includeLabour;

  let gearLineItems = cur.gearLineItems;
  if (!nextIncludeGear) {
    gearLineItems = [];
  } else if (patch.gearLineItems !== undefined) {
    gearLineItems = normalizeLineItems(patch.gearLineItems);
  }
  let labourLineItems = cur.labourLineItems;
  if (!nextIncludeLabour) {
    labourLineItems = [];
  } else if (patch.labourLineItems !== undefined) {
    const parsed = parseLineItemsArray(patch.labourLineItems);
    labourLineItems = parsed.length === 0 ? [defaultLine()] : parsed;
  }

  const merged: BillingDocument = {
    ...cur,
    kind: patch.kind !== undefined ? patch.kind : cur.kind,
    invoiceDate: patch.invoiceDate !== undefined ? patch.invoiceDate?.trim() || undefined : cur.invoiceDate,
    referenceNo: patch.referenceNo !== undefined ? patch.referenceNo?.trim() || undefined : cur.referenceNo,
    headerText: patch.headerText !== undefined ? patch.headerText?.trim() || undefined : cur.headerText,
    customerName: patch.customerName !== undefined ? patch.customerName.trim() : cur.customerName,
    clientId: patch.clientId !== undefined ? patch.clientId?.trim() || undefined : cur.clientId,
    customerEmail:
      patch.customerEmail !== undefined ? patch.customerEmail?.trim() || undefined : cur.customerEmail,
    documentTitle:
      patch.documentTitle !== undefined ? patch.documentTitle?.trim() || undefined : cur.documentTitle,
    brief: patch.brief !== undefined ? patch.brief?.trim() || undefined : cur.brief,
    includeGear: nextIncludeGear,
    includeLabour: nextIncludeLabour,
    priceTier:
      patch.priceTier !== undefined
        ? patch.priceTier
        : cur.priceTier !== undefined
          ? cur.priceTier
          : "mid",
    currency: BILLING_CURRENCY,
    gearLineItems,
    labourLineItems,
    notes: patch.notes !== undefined ? patch.notes?.trim() || undefined : cur.notes,
    termsText: patch.termsText !== undefined ? patch.termsText?.trim() || undefined : cur.termsText,
    sendFromEmail:
      patch.sendFromEmail !== undefined ? patch.sendFromEmail?.trim() || undefined : cur.sendFromEmail,
    status: newStatus,
    followUpEnabled: newFollow,
    followUpIntervalDays:
      patch.followUpIntervalDays !== undefined ? patch.followUpIntervalDays : cur.followUpIntervalDays,
    followUpStage,
    lastFollowUpAt,
    nextFollowUpAt,
    sentAt,
    updatedAt: now,
    createdByEmail: cur.createdByEmail,
  };

  const becameSent = newStatus === "sent" && cur.status !== "sent";
  if (becameSent && newFollow) {
    merged.sentAt = now;
    merged.followUpStage = 0;
    const iv = activeIntervals(merged, settings.followUpIntervalDays);
    merged.nextFollowUpAt = computeNextFollowUp(new Date(), 0, iv);
  }

  if (newStatus !== "sent") {
    merged.nextFollowUpAt = undefined;
  }

  all[i] = merged;
  await writeAll(all);
  return merged;
}

export async function advanceFollowUp(doc: BillingDocument): Promise<BillingDocument | null> {
  const settings = await readBillingSettings();
  const intervals = activeIntervals(doc, settings.followUpIntervalDays);
  const nextStage = doc.followUpStage + 1;
  const last = new Date();
  const next =
    nextStage < intervals.length
      ? computeNextFollowUp(last, nextStage, intervals)
      : undefined;
  return updateBillingInvoice(doc.id, {
    followUpStage: nextStage,
    lastFollowUpAt: last.toISOString(),
    nextFollowUpAt: next,
  });
}

export async function deleteBillingInvoice(id: string): Promise<boolean> {
  const all = await readBillingInvoices();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
