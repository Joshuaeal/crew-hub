import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { getShift } from "@/lib/shift-store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["shifts_view", "shifts_manage", "shifts_claim"]);
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const shift = await getShift(id);
  if (!shift) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ shift });
}
