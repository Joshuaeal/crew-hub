import { NextResponse } from "next/server";
import { verifyIcalToken } from "@/lib/ical-auth";
import { buildCalendarEventsIcs } from "@/lib/calendar-events-ical";
import { readCalendarEvents } from "@/lib/calendar-events-store";

/**
 * Private iCal feed for native crew schedule events only.
 * Query: ?token=CREW_ICAL_TOKEN (same secret as shifts / combined).
 */
export async function GET(request: Request) {
  const secret = process.env.CREW_ICAL_TOKEN?.trim();
  if (!secret) {
    return new NextResponse(
      "Calendar feed is not configured. Set CREW_ICAL_TOKEN in the server environment.\r\n",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!verifyIcalToken(token, secret)) {
    return new NextResponse("Unauthorized\r\n", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const events = await readCalendarEvents();
  const ics = buildCalendarEventsIcs(events);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="crew-schedule.ics"',
      "Cache-Control": "private, no-cache, must-revalidate, max-age=0",
    },
  });
}
