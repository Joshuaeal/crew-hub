import { promises as fs } from "fs";
import path from "path";
import type { Payable, PayableStatus } from "@/types/payables";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "billing-payables.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

function normalizeStatus(raw: unknown): PayableStatus {
  if (
    raw === "draft" ||
    raw === "pending_approval" ||
    raw === "approved" ||
    raw === "paid" ||
    raw === "void"
  ) {
    return raw;
  }
  return "draft";
}

function parseRow(raw: unknown): Payable | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!id || !title) return null;
  const amount =
    typeof o.amountAudIncGst === "number" && Number.isFinite(o.amountAudIncGst)
      ? o.amountAudIncGst
      : Number(o.amountAudIncGst);
  if (!Number.isFinite(amount) || amount < 0) return null;

  return {
    id,
    title,
    vendor: typeof o.vendor === "string" ? o.vendor.trim() || undefined : undefined,
    amountAudIncGst: Math.round(amount * 100) / 100,
    category: typeof o.category === "string" ? o.category.trim() || undefined : undefined,
    status: normalizeStatus(o.status),
    dueDate: typeof o.dueDate === "string" ? o.dueDate : undefined,
    paidAt: typeof o.paidAt === "string" ? o.paidAt : undefined,
    linkedBillingDocumentId:
      typeof o.linkedBillingDocumentId === "string" ? o.linkedBillingDocumentId.trim() || undefined : undefined,
    linkedSubcontractorInvoiceId:
      typeof o.linkedSubcontractorInvoiceId === "string" ? o.linkedSubcontractorInvoiceId.trim() || undefined : undefined,
    attachmentFilename:
      typeof o.attachmentFilename === "string" ? o.attachmentFilename.trim() || undefined : undefined,
    attachmentRelativePath:
      typeof o.attachmentRelativePath === "string" ? o.attachmentRelativePath.trim() || undefined : undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
    createdByEmail: typeof o.createdByEmail === "string" ? o.createdByEmail : "",
  };
}

export async function readPayables(): Promise<Payable[]> {
  await ensureFile();
  const raw = await fs.readFile(file, "utf-8");
  let p: unknown;
  try {
    p = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(p)) return [];
  const out: Payable[] = [];
  for (const x of p) {
    const row = parseRow(x);
    if (row) out.push(row);
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function writePayables(rows: Payable[]) {
  await ensureFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

export async function createPayable(input: {
  title: string;
  vendor?: string;
  amountAudIncGst: number;
  category?: string;
  status?: PayableStatus;
  dueDate?: string;
  linkedBillingDocumentId?: string;
  linkedSubcontractorInvoiceId?: string;
  attachmentFilename?: string;
  attachmentRelativePath?: string;
  notes?: string;
  createdByEmail: string;
}): Promise<Payable> {
  const rows = await readPayables();
  const t = new Date().toISOString();
  const amount = Math.round(Math.max(0, input.amountAudIncGst) * 100) / 100;
  const row: Payable = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    vendor: input.vendor?.trim() || undefined,
    amountAudIncGst: amount,
    category: input.category?.trim() || undefined,
    status: input.status ?? "draft",
    dueDate: input.dueDate?.trim() || undefined,
    paidAt: undefined,
    linkedBillingDocumentId: input.linkedBillingDocumentId?.trim() || undefined,
    linkedSubcontractorInvoiceId: input.linkedSubcontractorInvoiceId?.trim() || undefined,
    attachmentFilename: input.attachmentFilename?.trim() || undefined,
    attachmentRelativePath: input.attachmentRelativePath?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: t,
    updatedAt: t,
    createdByEmail: input.createdByEmail,
  };
  rows.unshift(row);
  await writePayables(rows);
  return row;
}

export async function updatePayable(
  id: string,
  patch: Partial<{
    title: string;
    vendor: string | null;
    amountAudIncGst: number;
    category: string | null;
    status: PayableStatus;
    dueDate: string | null;
    paidAt: string | null;
    linkedBillingDocumentId: string | null;
    notes: string | null;
  }>
): Promise<Payable | null> {
  const rows = await readPayables();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const cur = rows[i];
  const t = new Date().toISOString();
  const next: Payable = { ...cur, updatedAt: t };

  if (patch.title !== undefined) next.title = patch.title.trim();
  if (patch.vendor !== undefined) next.vendor = patch.vendor?.trim() || undefined;
  if (patch.amountAudIncGst !== undefined) {
    const a = Math.round(Math.max(0, patch.amountAudIncGst) * 100) / 100;
    next.amountAudIncGst = a;
  }
  if (patch.category !== undefined) next.category = patch.category?.trim() || undefined;
  if (patch.status !== undefined) {
    next.status = patch.status;
    if (patch.status === "paid" && !next.paidAt) {
      next.paidAt = t;
    }
    if (patch.status !== "paid") {
      next.paidAt = undefined;
    }
  }
  if (patch.dueDate !== undefined) next.dueDate = patch.dueDate?.trim() || undefined;
  if (patch.paidAt !== undefined) next.paidAt = patch.paidAt?.trim() || undefined;
  if (patch.linkedBillingDocumentId !== undefined) {
    next.linkedBillingDocumentId = patch.linkedBillingDocumentId?.trim() || undefined;
  }
  if (patch.notes !== undefined) next.notes = patch.notes?.trim() || undefined;

  rows[i] = next;
  await writePayables(rows);
  return next;
}

export async function deletePayable(id: string): Promise<boolean> {
  const rows = await readPayables();
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return false;
  await writePayables(next);
  return true;
}
