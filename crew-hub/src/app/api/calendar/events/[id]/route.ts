import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { SCHEDULE_ACCESS_PERMISSIONS } from "@/types/permissions";
import {
  deleteCalendarEvent,
  getCalendarEvent,
  updateCalendarEvent,
} from "@/lib/calendar-events-store";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission([...SCHEDULE_ACCESS_PERMISSIONS]);
  if (!gate.ok) return gate.response;

  const item = await getCalendarEvent(ctx.params.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission([...SCHEDULE_ACCESS_PERMISSIONS]);
  if (!gate.ok) return gate.response;

  let body: {
    title?: string;
    description?: string;
    location?: string;
    startAt?: string;
    endAt?: string;
    allDay?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await getCalendarEvent(ctx.params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Parameters<typeof updateCalendarEvent>[1] = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.location !== undefined) patch.location = body.location;
  if (body.startAt !== undefined) patch.startAt = body.startAt;
  if (body.endAt !== undefined) patch.endAt = body.endAt;
  if (body.allDay !== undefined) patch.allDay = body.allDay;

  const nextStart = patch.startAt !== undefined ? patch.startAt : existing.startAt;
  const nextEnd = patch.endAt !== undefined ? patch.endAt : existing.endAt;
  const start = new Date(nextStart);
  const end = new Date(nextEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "Invalid start/end times" }, { status: 400 });
  }

  const updated = await updateCalendarEvent(ctx.params.id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission([...SCHEDULE_ACCESS_PERMISSIONS]);
  if (!gate.ok) return gate.response;

  const ok = await deleteCalendarEvent(ctx.params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
