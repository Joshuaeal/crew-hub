/**
 * One-time: rewrite all inventory + billing catalog SKUs to [CAT]-[SUB]-[ITEM]-[OWNER]-[###].
 *
 * Run from crew-hub/ (same cwd as Next — uses .data/):
 *   npx tsx scripts/migrate-skus-to-protocol.ts
 *
 * Dry run (no writes, prints planned SKUs):
 *   DRY_RUN=1 npx tsx scripts/migrate-skus-to-protocol.ts
 */

import { copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { BillingCatalogItem } from "../src/types/billing";
import type { InventoryItem } from "../src/types/inventory";
import {
  allocateRaconteurSku,
  categoryLabelForCode,
  guessSkuCategoryFromCategoryLabel,
  migrationDeriveItemCode,
  migrationDeriveOwnerCode,
  MIGRATION_DEFAULT_SUB,
  type SkuCategoryCode,
} from "../src/lib/sku-protocol";

const dataDir = path.join(process.cwd(), ".data");
const inventoryFile = path.join(dataDir, "inventory-items.json");
const catalogFile = path.join(dataDir, "billing-catalog.json");

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const dry = process.env.DRY_RUN === "1";
  await mkdir(dataDir, { recursive: true });

  let inventory: InventoryItem[] = [];
  try {
    const raw = await readFile(inventoryFile, "utf-8");
    const p = JSON.parse(raw) as unknown;
    if (Array.isArray(p)) inventory = p as InventoryItem[];
  } catch {
    console.log("No inventory file or empty — nothing to migrate.");
  }

  let catalog: BillingCatalogItem[] = [];
  try {
    const raw = await readFile(catalogFile, "utf-8");
    const p = JSON.parse(raw) as unknown;
    if (Array.isArray(p)) catalog = p as BillingCatalogItem[];
  } catch {
    /* optional */
  }

  const existingSkus: string[] = [];
  const inventoryIdToSku = new Map<string, string>();

  const sortedInv = [...inventory].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  console.log(`Inventory rows: ${sortedInv.length}`);
  for (const row of sortedInv) {
    const cat: SkuCategoryCode =
      guessSkuCategoryFromCategoryLabel(row.category ?? "") ?? "CAM";
    const itemCode = migrationDeriveItemCode(row.name, row.id);
    const ownerCode = migrationDeriveOwnerCode(row.owner);
    const sku = allocateRaconteurSku(
      existingSkus,
      cat,
      MIGRATION_DEFAULT_SUB,
      itemCode,
      ownerCode
    );
    if (!sku) {
      console.error("Failed to allocate SKU for inventory", row.id, row.name);
      process.exit(1);
    }
    existingSkus.push(sku);
    inventoryIdToSku.set(row.id, sku);
    const label = categoryLabelForCode(cat);
    console.log(`  ${row.sku ?? "(none)"} → ${sku}  (${row.name.slice(0, 48)})`);
    if (!dry) {
      row.sku = sku;
      if (label) row.category = label;
      row.updatedAt = nowIso();
    }
  }

  console.log(`Billing catalog rows: ${catalog.length}`);
  for (const row of catalog) {
    let sku: string | null = null;
    if (row.inventoryItemId && inventoryIdToSku.has(row.inventoryItemId)) {
      sku = inventoryIdToSku.get(row.inventoryItemId)!;
    } else {
      const cat: SkuCategoryCode =
        guessSkuCategoryFromCategoryLabel(row.name ?? "") ?? "CAM";
      const itemCode = migrationDeriveItemCode(row.name, row.id);
      const ownerCode = migrationDeriveOwnerCode(undefined);
      sku = allocateRaconteurSku(existingSkus, cat, MIGRATION_DEFAULT_SUB, itemCode, ownerCode);
      if (!sku) {
        console.error("Failed to allocate SKU for catalog", row.id);
        process.exit(1);
      }
      existingSkus.push(sku);
    }
    console.log(`  ${row.sku ?? "(none)"} → ${sku}  (${row.name.slice(0, 48)})`);
    if (!dry) {
      row.sku = sku;
      row.updatedAt = nowIso();
    }
  }

  if (dry) {
    console.log("\nDRY_RUN=1 — no files written. Unset DRY_RUN to apply.");
    return;
  }

  if (inventory.length > 0) {
    await copyFile(inventoryFile, `${inventoryFile}.bak-${Date.now()}`);
    await writeFile(inventoryFile, JSON.stringify(inventory, null, 2), "utf-8");
    console.log(`\nWrote ${inventoryFile} (backup .bak-* created)`);
  }
  if (catalog.length > 0) {
    await copyFile(catalogFile, `${catalogFile}.bak-${Date.now()}`);
    await writeFile(catalogFile, JSON.stringify(catalog, null, 2), "utf-8");
    console.log(`Wrote ${catalogFile} (backup .bak-* created)`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
