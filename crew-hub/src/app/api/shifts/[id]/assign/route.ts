import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getShift, updateShift } from "@/lib/shift-store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requirePermission("shifts_manage");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const shift = await getShift(id);
  if (!shift) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const updated = await updateShift(id, {
    status: "filled",
    assignedTo: email,
    assignedEmails: [email],
    claims: undefined,
    claim: undefined,
  });

  return NextResponse.json({ shift: updated });
}
