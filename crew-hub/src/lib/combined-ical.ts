import type { CrewCalendarEvent } from "@/types/calendar-event";
import type { Shift } from "@/types/shift";
import { getAssignedEmails, getShiftClaims } from "@/lib/shift-utils";
import {
  escapeIcalText,
  nowIcalUtc,
  pushField,
  toIcalDate,
  toIcalUtc,
  uidDomain,
} from "@/lib/ical-utils";

function calendarName(): string {
  return process.env.CREW_COMBINED_ICAL_NAME?.trim() || "Crew Hub";
}

/** Single VCALENDAR containing shift postings + crew schedule events (one Google Calendar subscription). */
export function buildCombinedIcs(shifts: Shift[], events: CrewCalendarEvent[]): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Crew Hub//Combined//EN");
  lines.push("CALSCALE:GREGORIAN");
  pushField(lines, "X-WR-CALNAME", escapeIcalText(calendarName()));
  lines.push("METHOD:PUBLISH");
  lines.push("X-PUBLISHED-TTL:PT1H");

  const stamp = nowIcalUtc();
  const domain = uidDomain();

  for (const s of shifts) {
    const status =
      s.status === "filled" ? "[Filled] " : s.status === "pending" ? "[Pending] " : "[Open] ";
    const summary = `${status}${s.title}`;
    const descParts: string[] = [];
    if (s.description) descParts.push(s.description);
    descParts.push(`Type: Shift`);
    if (s.status === "filled") {
      const crew = getAssignedEmails(s);
      if (crew.length) descParts.push(`Crew: ${crew.join(", ")}`);
      else if (s.assignedTo) descParts.push(`Assigned: ${s.assignedTo}`);
    } else {
      const claims = getShiftClaims(s);
      if (claims.length) {
        descParts.push(`Claims: ${claims.map((c) => `${c.email} (${c.status})`).join(", ")}`);
      }
    }
    descParts.push(`Posted by: ${s.postedBy}`);

    lines.push("BEGIN:VEVENT");
    pushField(lines, "UID", `shift-${s.id}@${domain}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`LAST-MODIFIED:${toIcalUtc(s.updatedAt ?? s.startAt)}`);
    lines.push(`DTSTART:${toIcalUtc(s.startAt)}`);
    lines.push(`DTEND:${toIcalUtc(s.endAt)}`);
    pushField(lines, "SUMMARY", escapeIcalText(summary));
    pushField(lines, "DESCRIPTION", escapeIcalText(descParts.join("\n")));
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }

  for (const e of events) {
    const descParts: string[] = [];
    if (e.description) descParts.push(e.description);
    descParts.push(`Type: Schedule`);
    descParts.push(`Updated: ${e.updatedAt}`);
    descParts.push(`By: ${e.createdByEmail}`);

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
    pushField(lines, "DESCRIPTION", escapeIcalText(descParts.join("\n")));
    if (e.location?.trim()) {
      pushField(lines, "LOCATION", escapeIcalText(e.location.trim()));
    }
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
