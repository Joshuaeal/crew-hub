import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
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
import { collectAllSkuStrings } from "@/lib/sku-collect";

export async function GET(request: Request) {
  const gate = await requireAnyPermission(["inventory", "billing"]);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const cat = searchParams.get("cat")?.trim() ?? "";
  const sub = searchParams.get("sub")?.trim() ?? "";
  const item = searchParams.get("item")?.trim() ?? "";
  const owner = searchParams.get("owner")?.trim() ?? "";
  const excludeSku = searchParams.get("excludeSku")?.trim() ?? "";

  if (!isSkuCategoryCode(cat)) {
    return NextResponse.json({ error: "Invalid cat" }, { status: 400 });
  }
  if (!isValidSubForCategory(cat, sub)) {
    return NextResponse.json({ error: "Invalid sub for category" }, { status: 400 });
  }
  const itemN = normalizeSkuItem(item);
  const ownerN = normalizeSkuOwnerCode(owner);
  if (!validateSkuItem(itemN)) {
    return NextResponse.json(
      { error: "Item code must be 4–6 letters/numbers (A–Z / 0–9)" },
      { status: 400 }
    );
  }
  if (!validateSkuOwner(ownerN)) {
    return NextResponse.json(
      { error: "Owner code must be 2–3 letters (initials)" },
      { status: 400 }
    );
  }

  const existing = await collectAllSkuStrings();
  const sku = allocateRaconteurSku(
    existing,
    cat as SkuCategoryCode,
    sub,
    itemN,
    ownerN,
    excludeSku ? [excludeSku] : undefined
  );
  if (!sku) {
    return NextResponse.json({ error: "Could not allocate SKU" }, { status: 400 });
  }
  return NextResponse.json({ sku });
}
