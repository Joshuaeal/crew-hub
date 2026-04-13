import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { getInventoryItem } from "@/lib/inventory-store";
import { getInventoryJob } from "@/lib/inventory-jobs-store";
import { createCheckoutRequest, readCheckoutRequests } from "@/lib/inventory-checkout-store";
import { hasPermission } from "@/types/permissions";

export async function GET(request: Request) {
  const gate = await requireAnyPermission(["inventory_request", "users_manage", "inventory"]);
  if (!gate.ok) return gate.response;

  const all = await readCheckoutRequests();
  const url = new URL(request.url);
  const mineOnly = url.searchParams.get("mine") === "1";

  const seeAll =
    !mineOnly &&
    (hasPermission(gate.session.permissions, "users_manage") ||
      hasPermission(gate.session.permissions, "inventory"));

  const items = seeAll
    ? all
    : all.filter((r) => r.requestedByUserId === gate.session.userId);

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const gate = await requireAnyPermission(["inventory_request", "inventory"]);
  if (!gate.ok) return gate.response;

  let body: {
    itemId?: string;
    jobId?: string;
    quantity?: number;
    note?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const qty = typeof body.quantity === "number" ? body.quantity : Number(body.quantity ?? 0);

  if (!itemId.trim() || !jobId.trim()) {
    return NextResponse.json({ error: "itemId and jobId are required" }, { status: 400 });
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
  }

  const item = await getInventoryItem(itemId);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const job = await getInventoryJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (item.quantity < qty) {
    return NextResponse.json(
      { error: `Insufficient stock (available: ${item.quantity})` },
      { status: 400 }
    );
  }

  const row = await createCheckoutRequest({
    itemId,
    jobId,
    quantity: qty,
    note: typeof body.note === "string" ? body.note : undefined,
    requestedByUserId: gate.session.userId,
    requestedByEmail: gate.session.email,
  });

  return NextResponse.json({ item: row });
}
