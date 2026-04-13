import { NextResponse } from "next/server";
import { requireHrLeaveApproval } from "@/lib/api-auth";
import { readLeaveRequests, updateLeaveRequestStatus } from "@/lib/leave-request-store";

type Ctx = { params: { id: string } };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireHrLeaveApproval();
  if (!gate.ok) return gate.response;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status === "approved" || body.status === "rejected" ? body.status : null;
  if (!status) {
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 });
  }

  const all = await readLeaveRequests();
  const existing = all.find((r) => r.id === ctx.params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Request already decided" }, { status: 400 });
  }

  const updated = await updateLeaveRequestStatus(ctx.params.id, status, gate.session.email);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}
