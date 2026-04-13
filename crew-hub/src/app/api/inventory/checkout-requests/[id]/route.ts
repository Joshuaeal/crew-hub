import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { getCheckoutRequest, updateCheckoutRequest } from "@/lib/inventory-checkout-store";

type Ctx = { params: { id: string } };

/** Cancel own pending request */
export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["inventory_request", "inventory"]);
  if (!gate.ok) return gate.response;

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "cancel") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const cur = await getCheckoutRequest(ctx.params.id);
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (cur.requestedByUserId !== gate.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (cur.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be cancelled" }, { status: 400 });
  }

  const updated = await updateCheckoutRequest(ctx.params.id, { status: "cancelled" });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}
