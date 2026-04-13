import { NextResponse } from "next/server";
import { requireAnyPermission, requirePermission } from "@/lib/api-auth";
import {
  deleteInventoryItem,
  getInventoryItem,
  updateInventoryItem,
} from "@/lib/inventory-store";
import { syncCatalogPricesFromInventoryItem } from "@/lib/billing-catalog-store";
import { resolveSkuInput, type SkuBody } from "@/lib/resolve-sku-input";
import { categoryLabelForCode, isSkuCategoryCode, normalizeSkuOwnerCode, parseRaconteurSku } from "@/lib/sku-protocol";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["inventory", "inventory_request"]);
  if (!gate.ok) return gate.response;

  const item = await getInventoryItem(ctx.params.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requirePermission("inventory");
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = await getInventoryItem(ctx.params.id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = current.sku ? parseRaconteurSku(current.sku) : null;
  const mergedSku: SkuBody = {
    sku:
      body.sku !== undefined
        ? body.sku === null
          ? ""
          : String(body.sku)
        : (current.sku ?? ""),
    skuCat:
      body.skuCat !== undefined
        ? String(body.skuCat)
        : parsed
          ? parsed.cat
          : "",
    skuSub:
      body.skuSub !== undefined
        ? String(body.skuSub)
        : parsed
          ? parsed.sub
          : "",
    skuItem:
      body.skuItem !== undefined
        ? String(body.skuItem)
        : parsed
          ? parsed.item
          : "",
    skuOwner:
      body.skuOwner !== undefined
        ? String(body.skuOwner)
        : parsed
          ? parsed.owner
          : "",
  };

  const resolved = await resolveSkuInput(mergedSku, {
    excludeInventoryId: current.id,
    excludeSkusForSequence: current.sku ? [current.sku] : undefined,
  });
  if (resolved.error) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const patch: Parameters<typeof updateInventoryItem>[1] = {};
  if (body.name !== undefined) patch.name = String(body.name);
  patch.sku = resolved.sku;
  if (body.quantity !== undefined) {
    patch.quantity = typeof body.quantity === "number" ? body.quantity : Number(body.quantity);
  }
  if (body.location !== undefined) patch.location = body.location === null ? undefined : String(body.location);
  if (body.category !== undefined) {
    patch.category = body.category === null ? undefined : String(body.category);
  } else if (body.skuCat !== undefined) {
    const c = String(body.skuCat).trim();
    if (isSkuCategoryCode(c)) {
      patch.category = categoryLabelForCode(c) ?? undefined;
    }
  }
  if (body.notes !== undefined) patch.notes = body.notes === null ? undefined : String(body.notes);
  if (body.skuOwner !== undefined) {
    const o = normalizeSkuOwnerCode(String(body.skuOwner));
    patch.owner = o.length >= 2 ? o : undefined;
  } else if (body.owner !== undefined) {
    patch.owner = body.owner === null ? undefined : String(body.owner);
  }
  if (body.midValueAud !== undefined) {
    patch.midValueAud =
      body.midValueAud === null
        ? undefined
        : typeof body.midValueAud === "number"
          ? body.midValueAud
          : Number(body.midValueAud);
  }
  if (body.hireLowAud !== undefined) {
    patch.hireLowAud =
      body.hireLowAud === null
        ? undefined
        : typeof body.hireLowAud === "number"
          ? body.hireLowAud
          : Number(body.hireLowAud);
  }
  if (body.hireMidAud !== undefined) {
    patch.hireMidAud =
      body.hireMidAud === null
        ? undefined
        : typeof body.hireMidAud === "number"
          ? body.hireMidAud
          : Number(body.hireMidAud);
  }
  if (body.hireHighAud !== undefined) {
    patch.hireHighAud =
      body.hireHighAud === null
        ? undefined
        : typeof body.hireHighAud === "number"
          ? body.hireHighAud
          : Number(body.hireHighAud);
  }
  if (body.minQuantity !== undefined) {
    patch.minQuantity =
      body.minQuantity === null
        ? undefined
        : typeof body.minQuantity === "number"
          ? body.minQuantity
          : Number(body.minQuantity);
  }

  const updated = await updateInventoryItem(ctx.params.id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await syncCatalogPricesFromInventoryItem(updated);
  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("inventory");
  if (!gate.ok) return gate.response;

  const ok = await deleteInventoryItem(ctx.params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
