import { readBillingCatalog } from "@/lib/billing-catalog-store";
import { readInventoryItems } from "@/lib/inventory-store";

/** All SKU strings in inventory + billing catalog (for uniqueness). */
export async function collectAllSkuStrings(): Promise<string[]> {
  const inv = await readInventoryItems();
  const cat = await readBillingCatalog();
  const out: string[] = [];
  for (const i of inv) {
    if (i.sku?.trim()) out.push(i.sku.trim());
  }
  for (const c of cat) {
    if (c.sku?.trim()) out.push(c.sku.trim());
  }
  return out;
}
