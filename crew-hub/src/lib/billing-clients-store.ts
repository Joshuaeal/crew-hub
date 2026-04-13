import { promises as fs } from "fs";
import path from "path";
import type { BillingClient } from "@/types/billing";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "billing-clients.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

export async function readBillingClients(): Promise<BillingClient[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as BillingClient[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: BillingClient[]) {
  await ensureFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

function now() {
  return new Date().toISOString();
}

export async function getBillingClient(id: string): Promise<BillingClient | undefined> {
  const all = await readBillingClients();
  return all.find((c) => c.id === id);
}

export async function createBillingClient(input: {
  name: string;
  email?: string;
  company?: string;
  address?: string;
  notes?: string;
}): Promise<BillingClient> {
  const all = await readBillingClients();
  const t = now();
  const row: BillingClient = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email: input.email?.trim() || undefined,
    company: input.company?.trim() || undefined,
    address: input.address?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: t,
    updatedAt: t,
  };
  all.unshift(row);
  await writeAll(all);
  return row;
}

export async function updateBillingClient(
  id: string,
  patch: Partial<{
    name: string;
    email: string | undefined;
    company: string | undefined;
    address: string | undefined;
    notes: string | undefined;
  }>
): Promise<BillingClient | null> {
  const all = await readBillingClients();
  const i = all.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const u = all[i];
  all[i] = {
    ...u,
    name: patch.name !== undefined ? patch.name.trim() : u.name,
    email: patch.email !== undefined ? patch.email?.trim() || undefined : u.email,
    company: patch.company !== undefined ? patch.company?.trim() || undefined : u.company,
    address: patch.address !== undefined ? patch.address?.trim() || undefined : u.address,
    notes: patch.notes !== undefined ? patch.notes?.trim() || undefined : u.notes,
    updatedAt: now(),
  };
  await writeAll(all);
  return all[i];
}

export async function deleteBillingClient(id: string): Promise<boolean> {
  const all = await readBillingClients();
  const next = all.filter((c) => c.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
