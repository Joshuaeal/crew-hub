import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { SCHEDULE_ACCESS_PERMISSIONS } from "@/types/permissions";
import { createCalendarEvent, readCalendarEvents } from "@/lib/calendar-events-store";

export async function GET() {
  const gate = await requireAnyPermission([...SCHEDULE_ACCESS_PERMISSIONS]);
  if (!gate.ok) return gate.response;
  const items = await readCalendarEvents();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
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

  const title = typeof body.title === "string" ? body.title : "";
  const startAt = typeof body.startAt === "string" ? body.startAt : "";
  const endAt = typeof body.endAt === "string" ? body.endAt : "";
  if (!title.trim() || !startAt || !endAt) {
    return NextResponse.json({ error: "title, startAt, and endAt are required" }, { status: 400 });
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "Invalid start/end times" }, { status: 400 });
  }

  const row = await createCalendarEvent({
    title,
    description: typeof body.description === "string" ? body.description : undefined,
    location: typeof body.location === "string" ? body.location : undefined,
    startAt,
    endAt,
    allDay: body.allDay === true,
    createdByEmail: gate.session.email,
  });

  return NextResponse.json({ item: row });
}
