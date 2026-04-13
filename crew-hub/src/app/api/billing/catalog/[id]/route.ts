import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import {
  deleteCatalogItem,
  getCatalogItem,
  updateCatalogItem,
} from "@/lib/billing-catalog-store";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  const item = await getCatalogItem(ctx.params.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, ctx: Ctx) {
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
    inventoryItemId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateCatalogItem>[1] = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.unitPrice !== undefined) patch.unitPrice = body.unitPrice;
  if (body.unitPriceLow !== undefined) patch.unitPriceLow = body.unitPriceLow;
  if (body.unitPriceMid !== undefined) patch.unitPriceMid = body.unitPriceMid;
  if (body.unitPriceHigh !== undefined) patch.unitPriceHigh = body.unitPriceHigh;
  if (body.defaultGstExempt !== undefined) patch.defaultGstExempt = body.defaultGstExempt;
  if (body.sku !== undefined) patch.sku = body.sku;
  if (body.inventoryItemId !== undefined) {
    patch.inventoryItemId = body.inventoryItemId === null ? undefined : body.inventoryItemId;
  }

  const updated = await updateCatalogItem(ctx.params.id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  const ok = await deleteCatalogItem(ctx.params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
