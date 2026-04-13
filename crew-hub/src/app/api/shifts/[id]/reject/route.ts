import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getShift, updateShift } from "@/lib/shift-store";
import { activeClaimCount, getShiftClaims, getSlotsTotal } from "@/lib/shift-utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requirePermission("shifts_manage");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const shift = await getShift(id);
  if (!shift) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { email?: string } = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as { email?: string };
  } catch {
    body = {};
  }

  const claims = getShiftClaims(shift);
  const pending = claims.filter((c) => c.status === "pending");
  if (pending.length === 0) {
    return NextResponse.json({ error: "No pending claim to reject" }, { status: 409 });
  }

  const want =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : pending.length === 1
        ? pending[0].email.toLowerCase()
        : "";

  if (!want) {
    return NextResponse.json(
      { error: "Multiple pending claims — pass { email } for which to reject" },
      { status: 400 }
    );
  }

  const nextClaims = claims.filter((c) => !(c.email.toLowerCase() === want && c.status === "pending"));

  const stillPending = nextClaims.filter((c) => c.status === "pending");
  const approved = nextClaims.filter((c) => c.status === "approved");
  const slots = getSlotsTotal(shift);
  const active = activeClaimCount(nextClaims);

  let status: "open" | "pending" | "filled";
  if (approved.length >= slots) {
    status = "filled";
  } else if (stillPending.length > 0) {
    status = "pending";
  } else if (active < slots) {
    status = "open";
  } else {
    status = "open";
  }

  const updated = await updateShift(id, {
    status,
    claims: nextClaims,
    claim: undefined,
    assignedTo: undefined,
    assignedEmails: undefined,
  });

  return NextResponse.json({ shift: updated });
}
