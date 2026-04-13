import { promises as fs } from "fs";
import path from "path";
import type { InventoryItem } from "@/types/inventory";
import { seedInventoryFromCsvIfEmpty } from "@/lib/raconteur-equipment-seed";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "inventory-items.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

export async function readInventoryItems(): Promise<InventoryItem[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    let rows = Array.isArray(parsed) ? (parsed as InventoryItem[]) : [];
    if (rows.length === 0) {
      await seedInventoryFromCsvIfEmpty();
      const raw2 = await fs.readFile(file, "utf-8");
      const parsed2 = JSON.parse(raw2) as unknown;
      rows = Array.isArray(parsed2) ? (parsed2 as InventoryItem[]) : [];
    }
    return rows;
  } catch {
    return [];
  }
}

async function writeAll(rows: InventoryItem[]) {
  await ensureDataFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

export async function getInventoryItem(id: string): Promise<InventoryItem | undefined> {
  const all = await readInventoryItems();
  return all.find((r) => r.id === id);
}

export async function findInventoryItemBySku(sku: string): Promise<InventoryItem | undefined> {
  const s = sku.trim().toLowerCase();
  if (!s) return undefined;
  const all = await readInventoryItems();
  return all.find((r) => r.sku && r.sku.trim().toLowerCase() === s);
}

function numOrUndef(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function createInventoryItem(input: {
  name: string;
  sku?: string;
  quantity: number;
  location?: string;
  category?: string;
  owner?: string;
  midValueAud?: number;
  hireLowAud?: number;
  hireMidAud?: number;
  hireHighAud?: number;
  notes?: string;
  minQuantity?: number;
}): Promise<InventoryItem> {
  const all = await readInventoryItems();
  const now = new Date().toISOString();
  const row: InventoryItem = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    sku: input.sku?.trim() || undefined,
    quantity: Number.isFinite(input.quantity) ? input.quantity : 0,
    location: input.location?.trim() || undefined,
    category: input.category?.trim() || undefined,
    owner: input.owner?.trim() || undefined,
    midValueAud: numOrUndef(input.midValueAud),
    hireLowAud: numOrUndef(input.hireLowAud),
    hireMidAud: numOrUndef(input.hireMidAud),
    hireHighAud: numOrUndef(input.hireHighAud),
    notes: input.notes?.trim() || undefined,
    minQuantity:
      input.minQuantity !== undefined && Number.isFinite(input.minQuantity)
        ? input.minQuantity
        : undefined,
    createdAt: now,
    updatedAt: now,
  };
  all.unshift(row);
  await writeAll(all);
  return row;
}

export async function updateInventoryItem(
  id: string,
  patch: Partial<Omit<InventoryItem, "id" | "createdAt">>
): Promise<InventoryItem | null> {
  const all = await readInventoryItems();
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const cur = all[i];
  const now = new Date().toISOString();
  all[i] = {
    ...cur,
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : cur.name,
    sku: patch.sku !== undefined ? patch.sku?.trim() || undefined : cur.sku,
    quantity: patch.quantity !== undefined ? patch.quantity : cur.quantity,
    location: patch.location !== undefined ? patch.location?.trim() || undefined : cur.location,
    category: patch.category !== undefined ? patch.category?.trim() || undefined : cur.category,
    notes: patch.notes !== undefined ? patch.notes?.trim() || undefined : cur.notes,
    owner: patch.owner !== undefined ? patch.owner?.trim() || undefined : cur.owner,
    midValueAud: patch.midValueAud !== undefined ? numOrUndef(patch.midValueAud) : cur.midValueAud,
    hireLowAud: patch.hireLowAud !== undefined ? numOrUndef(patch.hireLowAud) : cur.hireLowAud,
    hireMidAud: patch.hireMidAud !== undefined ? numOrUndef(patch.hireMidAud) : cur.hireMidAud,
    hireHighAud: patch.hireHighAud !== undefined ? numOrUndef(patch.hireHighAud) : cur.hireHighAud,
    minQuantity:
      patch.minQuantity !== undefined
        ? Number.isFinite(patch.minQuantity)
          ? patch.minQuantity
          : undefined
        : cur.minQuantity,
    updatedAt: now,
  };
  await writeAll(all);
  return all[i];
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  const all = await readInventoryItems();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
