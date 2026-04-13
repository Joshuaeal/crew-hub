import { promises as fs } from "fs";
import path from "path";
import type { InventoryCheckoutRequest, InventoryCheckoutStatus } from "@/types/inventory";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "inventory-checkout-requests.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

export async function readCheckoutRequests(): Promise<InventoryCheckoutRequest[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as InventoryCheckoutRequest[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: InventoryCheckoutRequest[]) {
  await ensureDataFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

export async function getCheckoutRequest(id: string): Promise<InventoryCheckoutRequest | undefined> {
  const all = await readCheckoutRequests();
  return all.find((r) => r.id === id);
}

export async function createCheckoutRequest(input: {
  itemId: string;
  jobId: string;
  quantity: number;
  note?: string;
  requestedByUserId: string;
  requestedByEmail: string;
}): Promise<InventoryCheckoutRequest> {
  const all = await readCheckoutRequests();
  const now = new Date().toISOString();
  const row: InventoryCheckoutRequest = {
    id: crypto.randomUUID(),
    itemId: input.itemId,
    jobId: input.jobId,
    quantity: input.quantity,
    status: "pending",
    note: input.note?.trim() || undefined,
    requestedByUserId: input.requestedByUserId,
    requestedByEmail: input.requestedByEmail,
    createdAt: now,
    updatedAt: now,
  };
  all.unshift(row);
  await writeAll(all);
  return row;
}

export async function updateCheckoutRequest(
  id: string,
  patch: Partial<{
    status: InventoryCheckoutStatus;
    reviewedByEmail: string | undefined;
    reviewedAt: string | undefined;
    rejectReason: string | undefined;
  }>
): Promise<InventoryCheckoutRequest | null> {
  const all = await readCheckoutRequests();
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const cur = all[i];
  const now = new Date().toISOString();
  all[i] = {
    ...cur,
    status: patch.status !== undefined ? patch.status : cur.status,
    reviewedByEmail:
      patch.reviewedByEmail !== undefined ? patch.reviewedByEmail : cur.reviewedByEmail,
    reviewedAt: patch.reviewedAt !== undefined ? patch.reviewedAt : cur.reviewedAt,
    rejectReason:
      patch.rejectReason !== undefined ? patch.rejectReason?.trim() || undefined : cur.rejectReason,
    updatedAt: now,
  };
  await writeAll(all);
  return all[i];
}
