import type { CrewCalendarEvent } from "@/types/calendar-event";
import {
  escapeIcalText,
  nowIcalUtc,
  pushField,
  toIcalDate,
  toIcalUtc,
  uidDomain,
} from "@/lib/ical-utils";

function calendarName(): string {
  return process.env.CREW_CALENDAR_ICAL_NAME?.trim() || "Crew Schedule";
}

function descriptionFor(e: CrewCalendarEvent): string {
  const parts: string[] = [];
  if (e.description) parts.push(e.description);
  parts.push(`Updated: ${e.updatedAt}`);
  parts.push(`Created by: ${e.createdByEmail}`);
  return parts.join("\n");
}

/**
 * iCal for native crew calendar events (subscribe in Google Calendar, etc.).
 */
export function buildCalendarEventsIcs(events: CrewCalendarEvent[]): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Crew Hub//Schedule//EN");
  lines.push("CALSCALE:GREGORIAN");
  pushField(lines, "X-WR-CALNAME", escapeIcalText(calendarName()));
  lines.push("METHOD:PUBLISH");
  lines.push("X-PUBLISHED-TTL:PT1H");

  const stamp = nowIcalUtc();
  const domain = uidDomain();

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    pushField(lines, "UID", `crew-cal-${e.id}@${domain}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`LAST-MODIFIED:${toIcalUtc(e.updatedAt)}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${toIcalDate(e.startAt)}`);
      lines.push(`DTEND;VALUE=DATE:${toIcalDate(e.endAt)}`);
    } else {
      lines.push(`DTSTART:${toIcalUtc(e.startAt)}`);
      lines.push(`DTEND:${toIcalUtc(e.endAt)}`);
    }
    pushField(lines, "SUMMARY", escapeIcalText(e.title));
    pushField(lines, "DESCRIPTION", escapeIcalText(descriptionFor(e)));
    if (e.location?.trim()) {
      pushField(lines, "LOCATION", escapeIcalText(e.location.trim()));
    }
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
