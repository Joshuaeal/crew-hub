import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getShift, updateShift } from "@/lib/shift-store";
import {
  activeClaimCount,
  getCrewing,
  getShiftClaims,
  getSlotsTotal,
  userHasClaim,
} from "@/lib/shift-utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("shifts_claim");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const shift = await getShift(id);
  if (!shift) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (getCrewing(shift) === "assigned") {
    return NextResponse.json(
      { error: "This shift was assigned by an admin and is not open for claims" },
      { status: 409 }
    );
  }

  if (shift.status === "filled") {
    return NextResponse.json({ error: "This shift is already fully crewed" }, { status: 409 });
  }

  const email = gate.session.email.toLowerCase();
  const claims = getShiftClaims(shift);

  if (userHasClaim(shift, email)) {
    return NextResponse.json({ error: "You already have a claim on this shift" }, { status: 409 });
  }

  if (activeClaimCount(claims) >= getSlotsTotal(shift)) {
    return NextResponse.json({ error: "All crew slots are currently taken" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const nextClaims = [
    ...claims,
    {
      email,
      status: "pending" as const,
      requestedAt: now,
    },
  ];

  const updated = await updateShift(id, {
    status: "pending",
    claims: nextClaims,
    claim: undefined,
  });

  return NextResponse.json({ shift: updated });
}
