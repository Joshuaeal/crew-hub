import { NextResponse } from "next/server";
import { requireHrAccess } from "@/lib/api-auth";
import { createLeaveRequest, readLeaveRequests } from "@/lib/leave-request-store";
import { canManageHrLeave } from "@/types/permissions";
import type { LeaveKind } from "@/types/leave-request";

const KINDS: LeaveKind[] = ["annual", "sick", "personal", "other"];

export async function GET() {
  const gate = await requireHrAccess();
  if (!gate.ok) return gate.response;

  const all = await readLeaveRequests();
  const showAll = canManageHrLeave(gate.session.permissions);
  const items = showAll
    ? all
    : all.filter((r) => r.requestedByEmail === gate.session.email);

  return NextResponse.json({
    items,
    canApprove: showAll,
  });
}

export async function POST(request: Request) {
  const gate = await requireHrAccess();
  if (!gate.ok) return gate.response;

  let body: {
    startAt?: string;
    endAt?: string;
    kind?: string;
    note?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const startAt = typeof body.startAt === "string" ? body.startAt : "";
  const endAt = typeof body.endAt === "string" ? body.endAt : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!startAt || !endAt || !KINDS.includes(kind as LeaveKind)) {
    return NextResponse.json({ error: "startAt, endAt, and kind are required" }, { status: 400 });
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const row = await createLeaveRequest({
    requestedByEmail: gate.session.email,
    requestedByUsername: gate.session.username,
    startAt,
    endAt,
    kind: kind as LeaveKind,
    note: typeof body.note === "string" ? body.note : undefined,
  });

  return NextResponse.json({ item: row });
}
