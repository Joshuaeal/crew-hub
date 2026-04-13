import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getCheckoutRequest, updateCheckoutRequest } from "@/lib/inventory-checkout-store";
import { getInventoryItem, updateInventoryItem } from "@/lib/inventory-store";

type Ctx = { params: { id: string } };

export async function POST(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("users_manage");
  if (!gate.ok) return gate.response;

  const req = await getCheckoutRequest(ctx.params.id);
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (req.status !== "pending") {
    return NextResponse.json({ error: "Request is not pending" }, { status: 400 });
  }

  const item = await getInventoryItem(req.itemId);
  if (!item) {
    return NextResponse.json({ error: "Inventory item no longer exists" }, { status: 400 });
  }

  if (item.quantity < req.quantity) {
    return NextResponse.json(
      { error: `Insufficient stock (available: ${item.quantity})` },
      { status: 400 }
    );
  }

  const nextQty = item.quantity - req.quantity;
  const updatedItem = await updateInventoryItem(req.itemId, { quantity: nextQty });
  if (!updatedItem) {
    return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const updated = await updateCheckoutRequest(req.id, {
    status: "approved",
    reviewedByEmail: gate.session.email,
    reviewedAt: now,
    rejectReason: undefined,
  });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated, inventoryItem: updatedItem });
}
