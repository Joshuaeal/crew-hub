import { promises as fs } from "fs";
import path from "path";
import type { BillingCatalogItem } from "@/types/billing";
import type { InventoryItem } from "@/types/inventory";
import { seedBillingCatalogFromInventoryIfEmpty } from "@/lib/raconteur-equipment-seed";

const dataDir = path.join(process.cwd(), ".data");
const file = path.join(dataDir, "billing-catalog.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf-8");
  }
}

function now() {
  return new Date().toISOString();
}

function migrateCatalogRow(row: BillingCatalogItem): BillingCatalogItem {
  const mid = (row.unitPriceMid ?? row.unitPrice ?? "").trim() || "0";
  const low = (row.unitPriceLow ?? "").trim();
  const high = (row.unitPriceHigh ?? "").trim();
  return {
    ...row,
    unitPrice: mid,
    unitPriceMid: row.unitPriceMid ?? mid,
    unitPriceLow: low || mid,
    unitPriceHigh: high || mid,
  };
}

export async function readBillingCatalog(): Promise<BillingCatalogItem[]> {
  await ensureFile();
  try {
    const raw = await fs.readFile(file, "utf-8");
    const p = JSON.parse(raw) as unknown;
    let rows = Array.isArray(p) ? (p as BillingCatalogItem[]).map(migrateCatalogRow) : [];
    if (rows.length === 0) {
      await seedBillingCatalogFromInventoryIfEmpty();
      const raw2 = await fs.readFile(file, "utf-8");
      const p2 = JSON.parse(raw2) as unknown;
      rows = Array.isArray(p2) ? (p2 as BillingCatalogItem[]).map(migrateCatalogRow) : [];
    }
    return rows;
  } catch {
    return [];
  }
}

async function writeAll(rows: BillingCatalogItem[]) {
  await ensureFile();
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
}

export async function getCatalogItem(id: string): Promise<BillingCatalogItem | undefined> {
  const all = await readBillingCatalog();
  return all.find((r) => r.id === id);
}

export async function findCatalogItemByInventoryItemId(
  inventoryItemId: string
): Promise<BillingCatalogItem | undefined> {
  const all = await readBillingCatalog();
  return all.find((r) => r.inventoryItemId === inventoryItemId);
}

export async function findCatalogItemBySku(sku: string): Promise<BillingCatalogItem | undefined> {
  const s = sku.trim().toLowerCase();
  if (!s) return undefined;
  const all = await readBillingCatalog();
  return all.find((r) => r.sku && r.sku.trim().toLowerCase() === s);
}

export async function createCatalogItem(input: {
  name: string;
  unitPrice: string;
  unitPriceLow?: string;
  unitPriceMid?: string;
  unitPriceHigh?: string;
  defaultGstExempt: boolean;
  sku?: string;
  inventoryItemId?: string;
}): Promise<BillingCatalogItem> {
  const all = await readBillingCatalog();
  const t = now();
  const mid = (input.unitPriceMid ?? input.unitPrice).trim() || "0";
  const low = (input.unitPriceLow ?? "").trim() || mid;
  const high = (input.unitPriceHigh ?? "").trim() || mid;
  const row: BillingCatalogItem = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    unitPrice: mid,
    unitPriceMid: mid,
    unitPriceLow: low,
    unitPriceHigh: high,
    defaultGstExempt: input.defaultGstExempt,
    sku: input.sku?.trim() || undefined,
    inventoryItemId: input.inventoryItemId,
    createdAt: t,
    updatedAt: t,
  };
  all.unshift(row);
  await writeAll(all);
  return row;
}

export async function updateCatalogItem(
  id: string,
  patch: Partial<{
    name: string;
    unitPrice: string;
    unitPriceLow: string;
    unitPriceMid: string;
    unitPriceHigh: string;
    defaultGstExempt: boolean;
    sku: string | undefined;
    inventoryItemId: string | undefined;
  }>
): Promise<BillingCatalogItem | null> {
  const all = await readBillingCatalog();
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const u = migrateCatalogRow(all[i]);
  const nextMid =
    patch.unitPriceMid !== undefined
      ? patch.unitPriceMid.trim()
      : patch.unitPrice !== undefined
        ? patch.unitPrice.trim()
        : u.unitPriceMid ?? u.unitPrice;
  const mid = nextMid || "0";
  const nextLow = patch.unitPriceLow !== undefined ? patch.unitPriceLow.trim() : u.unitPriceLow;
  const nextHigh = patch.unitPriceHigh !== undefined ? patch.unitPriceHigh.trim() : u.unitPriceHigh;
  all[i] = {
    ...u,
    name: patch.name !== undefined ? patch.name.trim() : u.name,
    unitPrice: mid,
    unitPriceMid: mid,
    unitPriceLow: nextLow !== undefined ? nextLow || mid : u.unitPriceLow ?? mid,
    unitPriceHigh: nextHigh !== undefined ? nextHigh || mid : u.unitPriceHigh ?? mid,
    defaultGstExempt:
      patch.defaultGstExempt !== undefined ? patch.defaultGstExempt : u.defaultGstExempt,
    sku: patch.sku !== undefined ? patch.sku?.trim() || undefined : u.sku,
    inventoryItemId: patch.inventoryItemId !== undefined ? patch.inventoryItemId : u.inventoryItemId,
    updatedAt: now(),
  };
  await writeAll(all);
  return all[i];
}

/** Push hire rates from an inventory item into the linked catalog row, if any. */
export async function syncCatalogPricesFromInventoryItem(inv: InventoryItem): Promise<void> {
  const cat = await findCatalogItemByInventoryItemId(inv.id);
  if (!cat) return;
  const mid =
    inv.hireMidAud !== undefined && Number.isFinite(inv.hireMidAud)
      ? String(inv.hireMidAud)
      : cat.unitPriceMid ?? cat.unitPrice;
  const low =
    inv.hireLowAud !== undefined && Number.isFinite(inv.hireLowAud)
      ? String(inv.hireLowAud)
      : mid;
  const high =
    inv.hireHighAud !== undefined && Number.isFinite(inv.hireHighAud)
      ? String(inv.hireHighAud)
      : mid;
  await updateCatalogItem(cat.id, {
    name: inv.name.trim(),
    unitPrice: mid,
    unitPriceLow: low,
    unitPriceMid: mid,
    unitPriceHigh: high,
    sku: inv.sku,
  });
}

export async function deleteCatalogItem(id: string): Promise<boolean> {
  const all = await readBillingCatalog();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
