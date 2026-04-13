import { findCatalogItemBySku } from "@/lib/billing-catalog-store";
import { findInventoryItemBySku } from "@/lib/inventory-store";
import { collectAllSkuStrings } from "@/lib/sku-collect";
import {
  allocateRaconteurSku,
  isSkuCategoryCode,
  isValidSubForCategory,
  normalizeSkuItem,
  normalizeSkuOwnerCode,
  validateSkuItem,
  validateSkuOwner,
  type SkuCategoryCode,
} from "@/lib/sku-protocol";

export type SkuBody = {
  sku?: string;
  skuCat?: string;
  skuSub?: string;
  skuItem?: string;
  skuOwner?: string;
};

/**
 * Resolve final SKU from explicit string and/or protocol fields.
 * When explicit sku is set, checks global uniqueness (inventory + catalog).
 * When sku is empty, allocates from protocol parts if all parts are present and valid.
 */
export async function resolveSkuInput(
  body: SkuBody,
  opts?: { excludeInventoryId?: string; excludeCatalogId?: string; excludeSkusForSequence?: string[] }
): Promise<{ sku: string | undefined; error?: string }> {
  const trimmed = typeof body.sku === "string" ? body.sku.trim() : "";
  if (trimmed) {
    const inv = await findInventoryItemBySku(trimmed);
    if (inv && inv.id !== opts?.excludeInventoryId) {
      return { sku: undefined, error: "SKU already in use" };
    }
    const row = await findCatalogItemBySku(trimmed);
    if (row && row.id !== opts?.excludeCatalogId) {
      const linked =
        opts?.excludeInventoryId &&
        row.inventoryItemId === opts.excludeInventoryId;
      if (!linked) {
        return { sku: undefined, error: "SKU already in use" };
      }
    }
    return { sku: trimmed };
  }

  const cat = typeof body.skuCat === "string" ? body.skuCat.trim() : "";
  const sub = typeof body.skuSub === "string" ? body.skuSub.trim() : "";
  const item = typeof body.skuItem === "string" ? body.skuItem.trim() : "";
  const owner = typeof body.skuOwner === "string" ? body.skuOwner.trim() : "";

  const itemN = normalizeSkuItem(item);
  const ownerN = normalizeSkuOwnerCode(owner);

  const canAllocate =
    validateSkuItem(itemN) &&
    validateSkuOwner(ownerN) &&
    isSkuCategoryCode(cat) &&
    isValidSubForCategory(cat, sub);

  if (canAllocate) {
    const existing = await collectAllSkuStrings();
    const allocated = allocateRaconteurSku(
      existing,
      cat as SkuCategoryCode,
      sub,
      itemN,
      ownerN,
      opts?.excludeSkusForSequence
    );
    if (!allocated) {
      return { sku: undefined, error: "Could not allocate SKU" };
    }
    return { sku: allocated };
  }

  const userStartedProtocol = !!(item.trim() || owner.trim());
  if (userStartedProtocol) {
    if (!isSkuCategoryCode(cat)) {
      return { sku: undefined, error: "Invalid SKU category" };
    }
    if (!isValidSubForCategory(cat, sub)) {
      return { sku: undefined, error: "Invalid SKU subcategory for category" };
    }
    if (!validateSkuItem(itemN)) {
      return { sku: undefined, error: "Item code must be 4–6 letters or numbers" };
    }
    if (!validateSkuOwner(ownerN)) {
      return { sku: undefined, error: "Owner code must be 2–3 letters" };
    }
  }

  return { sku: undefined };
}
