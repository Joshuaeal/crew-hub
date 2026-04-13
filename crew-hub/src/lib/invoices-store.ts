import { promises as fs } from "fs";
import path from "path";
import type { InvoiceRecord } from "@/types/invoice";

export type { InvoiceRecord };

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "invoices.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

export async function readInvoices(): Promise<InvoiceRecord[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as InvoiceRecord[]) : [];
  } catch {
    return [];
  }
}

export async function appendInvoice(
  input: Omit<InvoiceRecord, "id" | "submittedAt">
): Promise<InvoiceRecord> {
  await ensureDataFile();
  const all = await readInvoices();
  const row: InvoiceRecord = {
    ...input,
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
  };
  all.unshift(row);
  await fs.writeFile(file, JSON.stringify(all, null, 2), "utf-8");
  return row;
}

export async function getInvoiceById(id: string): Promise<InvoiceRecord | undefined> {
  const all = await readInvoices();
  return all.find((x) => x.id === id);
}

export async function updateInvoiceById(
  id: string,
  patch: Partial<Pick<InvoiceRecord, "attachmentFilename" | "attachmentRelativePath" | "payableId">>
): Promise<InvoiceRecord | null> {
  const all = await readInvoices();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i], ...patch };
  await fs.writeFile(file, JSON.stringify(all, null, 2), "utf-8");
  return all[i];
}

export async function listInvoicesForEmail(email: string): Promise<InvoiceRecord[]> {
  const all = await readInvoices();
  return all.filter((i) => i.subcontractorEmail.toLowerCase() === email.toLowerCase());
}
