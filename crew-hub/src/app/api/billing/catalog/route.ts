import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { createCatalogItem, readBillingCatalog } from "@/lib/billing-catalog-store";
import { resolveSkuInput } from "@/lib/resolve-sku-input";

export async function GET() {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;
  const items = await readBillingCatalog();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  let body: {
    name?: string;
    unitPrice?: string;
    unitPriceLow?: string;
    unitPriceMid?: string;
    unitPriceHigh?: string;
    defaultGstExempt?: boolean;
    sku?: string;
    skuCat?: string;
    skuSub?: string;
    skuItem?: string;
    skuOwner?: string;
    inventoryItemId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const resolved = await resolveSkuInput({
    sku: body.sku,
    skuCat: body.skuCat,
    skuSub: body.skuSub,
    skuItem: body.skuItem,
    skuOwner: body.skuOwner,
  });
  if (resolved.error) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const row = await createCatalogItem({
    name,
    unitPrice: typeof body.unitPrice === "string" ? body.unitPrice : "0",
    unitPriceLow: typeof body.unitPriceLow === "string" ? body.unitPriceLow : undefined,
    unitPriceMid: typeof body.unitPriceMid === "string" ? body.unitPriceMid : undefined,
    unitPriceHigh: typeof body.unitPriceHigh === "string" ? body.unitPriceHigh : undefined,
    defaultGstExempt: body.defaultGstExempt === true,
    sku: resolved.sku,
    inventoryItemId: typeof body.inventoryItemId === "string" ? body.inventoryItemId : undefined,
  });

  return NextResponse.json({ item: row });
}
