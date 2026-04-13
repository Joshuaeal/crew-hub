import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getShift, updateShift } from "@/lib/shift-store";
import { getShiftClaims, getSlotsTotal } from "@/lib/shift-utils";

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
    return NextResponse.json({ error: "No pending claim to approve" }, { status: 409 });
  }

  const want =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : pending[0].email.toLowerCase();

  const target = pending.find((c) => c.email.toLowerCase() === want);
  if (!target) {
    return NextResponse.json({ error: "No pending claim for that email" }, { status: 409 });
  }

  const nextClaims = claims.map((c) =>
    c.email.toLowerCase() === target.email.toLowerCase() && c.status === "pending"
      ? { ...c, status: "approved" as const }
      : c
  );

  const approved = nextClaims.filter((c) => c.status === "approved");
  const stillPending = nextClaims.filter((c) => c.status === "pending");
  const slots = getSlotsTotal(shift);

  let status: "open" | "pending" | "filled";
  let assignedTo: string | undefined;
  let assignedEmails: string[] | undefined;

  if (approved.length >= slots) {
    status = "filled";
    assignedEmails = approved.map((c) => c.email);
    assignedTo = assignedEmails[0];
  } else if (stillPending.length > 0) {
    status = "pending";
  } else {
    status = "open";
  }

  const updated = await updateShift(id, {
    status,
    claims: nextClaims,
    claim: undefined,
    assignedTo,
    assignedEmails,
  });

  return NextResponse.json({ shift: updated });
}
