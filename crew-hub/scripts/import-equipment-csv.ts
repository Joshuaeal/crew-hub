/**
 * Replace inventory + billing catalog from an equipment register CSV.
 *
 *   npx tsx scripts/import-equipment-csv.ts /path/to/raconteur_equipment_register.csv
 *
 * Columns: Category, Item, Owner, Mid_Value_AUD, Hire_Low, Hire_Mid, Hire_High
 */

import path from "path";
import { replaceInventoryAndCatalogFromCsv } from "../src/lib/raconteur-equipment-seed";

async function main() {
  const p = process.argv[2]?.trim() || process.env.RACONTEUR_EQUIPMENT_CSV?.trim();
  if (!p) {
    console.error("Usage: npx tsx scripts/import-equipment-csv.ts <path-to.csv>");
    process.exit(1);
  }
  const abs = path.resolve(p);
  const { inventory, catalog } = await replaceInventoryAndCatalogFromCsv(abs);
  console.log(`Replaced inventory (${inventory} rows) and billing catalog (${catalog} rows).`);
  console.log(`Data written to .data/inventory-items.json and .data/billing-catalog.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
