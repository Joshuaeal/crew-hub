import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { InventoryItem } from "@/types/inventory";
import type { BillingCatalogItem } from "@/types/billing";
import {
  allocateRaconteurSku,
  categoryLabelForCode,
  inferSkuSubcategoryForEquipment,
  migrationDeriveItemCode,
  migrationDeriveOwnerCode,
  resolveSkuCategoryForEquipmentRow,
  type SkuCategoryCode,
} from "@/lib/sku-protocol";

const dataDir = path.join(process.cwd(), ".data");
const inventoryFile = path.join(dataDir, "inventory-items.json");
const catalogFile = path.join(dataDir, "billing-catalog.json");
const csvPath = path.join(process.cwd(), "data", "seed", "raconteur_equipment_register.csv");

function parseCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.trim());
}

/** Parse equipment CSV and build inventory rows with protocol SKUs (does not write files). */
export function buildInventoryRowsFromCsvContent(csvRaw: string): InventoryItem[] {
  const lines = csvRaw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const iCat = idx("category");
  const iItem = idx("item");
  const iOwner = idx("owner");
  const iMid = idx("mid_value_aud");
  const iLow = idx("hire_low");
  const iMidH = idx("hire_mid");
  const iHigh = idx("hire_high");

  if (iItem < 0) return [];

  const now = new Date().toISOString();
  const rows: InventoryItem[] = [];
  const existingSkus: string[] = [];

  for (let n = 1; n < lines.length; n++) {
    const cells = parseCsvLine(lines[n]);
    if (cells.length < 2) continue;
    const category = iCat >= 0 ? cells[iCat] : "";
    const itemName = cells[iItem] || "";
    if (!itemName.trim()) continue;
    const owner = iOwner >= 0 ? cells[iOwner] : undefined;
    const midVal = iMid >= 0 ? parseFloat(cells[iMid]) : NaN;
    const low = iLow >= 0 ? parseFloat(cells[iLow]) : NaN;
    const mid = iMidH >= 0 ? parseFloat(cells[iMidH]) : NaN;
    const high = iHigh >= 0 ? parseFloat(cells[iHigh]) : NaN;

    const id = randomUUID();
    const cat: SkuCategoryCode = resolveSkuCategoryForEquipmentRow(
      category?.trim() ?? "",
      itemName.trim()
    );
    const sub = inferSkuSubcategoryForEquipment(cat, itemName.trim());
    const itemCode = migrationDeriveItemCode(itemName.trim(), id);
    const ownerCode = migrationDeriveOwnerCode(owner);
    const sku = allocateRaconteurSku(existingSkus, cat, sub, itemCode, ownerCode);
    if (!sku) {
      throw new Error(`Could not allocate protocol SKU for row: ${itemName.trim()}`);
    }
    existingSkus.push(sku);
    const catLabel = categoryLabelForCode(cat);

    rows.push({
      id,
      name: itemName.trim(),
      sku,
      quantity: 1,
      category: catLabel ?? (category?.trim() || undefined),
      owner: owner?.trim() || undefined,
      midValueAud: Number.isFinite(midVal) ? midVal : undefined,
      hireLowAud: Number.isFinite(low) ? low : undefined,
      hireMidAud: Number.isFinite(mid) ? mid : undefined,
      hireHighAud: Number.isFinite(high) ? high : undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  return rows;
}

function buildBillingCatalogFromInventory(items: InventoryItem[]): BillingCatalogItem[] {
  const now = new Date().toISOString();
  const catalog: BillingCatalogItem[] = [];

  for (const i of items) {
    if (!i.name?.trim()) continue;
    const mid = i.hireMidAud;
    const low = i.hireLowAud;
    const high = i.hireHighAud;
    const midStr =
      mid !== undefined && Number.isFinite(mid)
        ? String(mid)
        : low !== undefined && Number.isFinite(low)
          ? String(low)
          : "0";
    catalog.push({
      id: randomUUID(),
      name: i.name.trim(),
      unitPrice: midStr,
      unitPriceMid: midStr,
      unitPriceLow: low !== undefined && Number.isFinite(low) ? String(low) : midStr,
      unitPriceHigh: high !== undefined && Number.isFinite(high) ? String(high) : midStr,
      defaultGstExempt: false,
      sku: i.sku,
      inventoryItemId: i.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  return catalog;
}

/**
 * Replace `.data/inventory-items.json` and `.data/billing-catalog.json` from a CSV file.
 * Deletes previous inventory/catalog rows.
 */
export async function replaceInventoryAndCatalogFromCsv(csvPath: string): Promise<{
  inventory: number;
  catalog: number;
}> {
  await fs.mkdir(dataDir, { recursive: true });
  const csvRaw = await fs.readFile(csvPath, "utf-8");
  const rows = buildInventoryRowsFromCsvContent(csvRaw);
  const catalog = buildBillingCatalogFromInventory(rows);

  await fs.writeFile(inventoryFile, JSON.stringify(rows, null, 2), "utf-8");
  await fs.writeFile(catalogFile, JSON.stringify(catalog, null, 2), "utf-8");

  return { inventory: rows.length, catalog: catalog.length };
}

/** Seed inventory from bundled CSV when the inventory file is empty. Returns rows created. */
export async function seedInventoryFromCsvIfEmpty(): Promise<number> {
  await fs.mkdir(dataDir, { recursive: true });
  let existing: unknown;
  try {
    existing = JSON.parse(await fs.readFile(inventoryFile, "utf-8"));
  } catch {
    existing = [];
  }
  if (Array.isArray(existing) && existing.length > 0) return 0;

  let csvRaw: string;
  try {
    csvRaw = await fs.readFile(csvPath, "utf-8");
  } catch {
    return 0;
  }

  const rows = buildInventoryRowsFromCsvContent(csvRaw);
  if (rows.length === 0) return 0;
  await fs.writeFile(inventoryFile, JSON.stringify(rows, null, 2), "utf-8");
  return rows.length;
}

/** When billing catalog is empty, create catalog rows from inventory hire rates (reads inventory JSON). */
export async function seedBillingCatalogFromInventoryIfEmpty(): Promise<number> {
  await fs.mkdir(dataDir, { recursive: true });
  let catExisting: unknown;
  try {
    catExisting = JSON.parse(await fs.readFile(catalogFile, "utf-8"));
  } catch {
    catExisting = [];
  }
  if (Array.isArray(catExisting) && catExisting.length > 0) return 0;

  let invRaw: string;
  try {
    invRaw = await fs.readFile(inventoryFile, "utf-8");
  } catch {
    return 0;
  }
  let items: InventoryItem[];
  try {
    items = JSON.parse(invRaw) as InventoryItem[];
  } catch {
    return 0;
  }
  if (!Array.isArray(items) || items.length === 0) return 0;

  const catalog = buildBillingCatalogFromInventory(items);
  if (catalog.length === 0) return 0;
  await fs.writeFile(catalogFile, JSON.stringify(catalog, null, 2), "utf-8");
  return catalog.length;
}
