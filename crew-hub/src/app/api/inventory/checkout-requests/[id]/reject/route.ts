import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getCheckoutRequest, updateCheckoutRequest } from "@/lib/inventory-checkout-store";

type Ctx = { params: { id: string } };

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requirePermission("users_manage");
  if (!gate.ok) return gate.response;

  let body: { reason?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }

  const req = await getCheckoutRequest(ctx.params.id);
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (req.status !== "pending") {
    return NextResponse.json({ error: "Request is not pending" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updated = await updateCheckoutRequest(req.id, {
    status: "rejected",
    reviewedByEmail: gate.session.email,
    reviewedAt: now,
    rejectReason: typeof body.reason === "string" ? body.reason : undefined,
  });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}
