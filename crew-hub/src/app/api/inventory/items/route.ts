import { NextResponse } from "next/server";
import { requireAnyPermission, requirePermission } from "@/lib/api-auth";
import { createInventoryItem, readInventoryItems } from "@/lib/inventory-store";
import { resolveSkuInput } from "@/lib/resolve-sku-input";
import { categoryLabelForCode, isSkuCategoryCode, normalizeSkuOwnerCode } from "@/lib/sku-protocol";

export async function GET() {
  const gate = await requireAnyPermission(["inventory", "inventory_request"]);
  if (!gate.ok) return gate.response;
  const items = await readInventoryItems();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const gate = await requirePermission("inventory");
  if (!gate.ok) return gate.response;

  let body: {
    name?: string;
    sku?: string;
    skuCat?: string;
    skuSub?: string;
    skuItem?: string;
    skuOwner?: string;
    quantity?: number;
    location?: string;
    category?: string;
    owner?: string;
    midValueAud?: number;
    hireLowAud?: number;
    hireMidAud?: number;
    hireHighAud?: number;
    notes?: string;
    minQuantity?: number;
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

  const quantity = typeof body.quantity === "number" ? body.quantity : Number(body.quantity ?? 0);

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

  let category = typeof body.category === "string" ? body.category.trim() : "";
  const skuCatRaw = typeof body.skuCat === "string" ? body.skuCat.trim() : "";
  if (!category && isSkuCategoryCode(skuCatRaw)) {
    category = categoryLabelForCode(skuCatRaw) ?? "";
  }

  const ownerFromProtocol =
    typeof body.skuOwner === "string" && body.skuOwner.trim()
      ? normalizeSkuOwnerCode(body.skuOwner)
      : "";
  const owner =
    ownerFromProtocol.length >= 2
      ? ownerFromProtocol
      : typeof body.owner === "string" && body.owner.trim()
        ? body.owner.trim()
        : undefined;

  const row = await createInventoryItem({
    name,
    sku: resolved.sku,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    location: typeof body.location === "string" ? body.location : undefined,
    category: category || undefined,
    owner,
    midValueAud: typeof body.midValueAud === "number" ? body.midValueAud : undefined,
    hireLowAud: typeof body.hireLowAud === "number" ? body.hireLowAud : undefined,
    hireMidAud: typeof body.hireMidAud === "number" ? body.hireMidAud : undefined,
    hireHighAud: typeof body.hireHighAud === "number" ? body.hireHighAud : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    minQuantity:
      body.minQuantity !== undefined
        ? typeof body.minQuantity === "number"
          ? body.minQuantity
          : Number(body.minQuantity)
        : undefined,
  });

  return NextResponse.json({ item: row });
}
