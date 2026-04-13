import { headers } from "next/headers";
import { CalendarScheduleClient } from "@/components/CalendarScheduleClient";
import { readCalendarEvents } from "@/lib/calendar-events-store";

export const dynamic = "force-dynamic";

function buildIcalUrl(path: string): string | null {
  const token = process.env.CREW_ICAL_TOKEN?.trim();
  if (!token) return null;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base =
    host && host.length > 0
      ? `${proto}://${host}`
      : (process.env.NEXT_PUBLIC_CREW_PUBLIC_URL?.trim() || "http://127.0.0.1:38471");
  return `${base.replace(/\/$/, "")}/api/ical/${path}?token=${encodeURIComponent(token)}`;
}

export default async function CalendarPage() {
  const items = await readCalendarEvents();
  const combinedFeedUrl = buildIcalUrl("combined");
  const scheduleFeedUrl = buildIcalUrl("calendar");
  const shiftsFeedUrl = buildIcalUrl("shifts");

  return (
    <CalendarScheduleClient
      initialItems={items}
      combinedFeedUrl={combinedFeedUrl}
      scheduleFeedUrl={scheduleFeedUrl}
      shiftsFeedUrl={shiftsFeedUrl}
    />
  );
}
