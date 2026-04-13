import type { Shift } from "@/types/shift";
import { getAssignedEmails, getShiftClaims } from "@/lib/shift-utils";
import {
  escapeIcalText,
  nowIcalUtc,
  pushField,
  toIcalUtc,
  uidDomain,
} from "@/lib/ical-utils";

function calendarName(): string {
  return process.env.CREW_ICAL_NAME?.trim() || "Crew Shifts";
}

function statusLabel(s: Shift): string {
  if (s.status === "filled") return "Filled";
  if (s.status === "pending") return "Pending approval";
  return "Open";
}

function summaryFor(s: Shift): string {
  const p =
    s.status === "filled" ? "[Filled] " : s.status === "pending" ? "[Pending] " : "[Open] ";
  return `${p}${s.title}`;
}

function descriptionFor(s: Shift): string {
  const parts: string[] = [];
  if (s.description) parts.push(s.description);
  parts.push(`Status: ${statusLabel(s)}`);
  if (s.status === "filled") {
    const crew = getAssignedEmails(s);
    if (crew.length) parts.push(`Crew: ${crew.join(", ")}`);
    else if (s.assignedTo) parts.push(`Assigned: ${s.assignedTo}`);
  } else {
    const claims = getShiftClaims(s);
    if (claims.length) {
      parts.push(
        `Claims: ${claims.map((c) => `${c.email} (${c.status})`).join(", ")}`
      );
    }
  }
  parts.push(`Posted by: ${s.postedBy}`);
  return parts.join("\n");
}

/**
 * Build an iCalendar document for all shifts (Google Calendar “From URL”, Apple Cal, etc.).
 */
export function buildShiftsIcs(shifts: Shift[]): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Crew Hub//Shifts//EN");
  lines.push("CALSCALE:GREGORIAN");
  pushField(lines, "X-WR-CALNAME", escapeIcalText(calendarName()));
  lines.push("METHOD:PUBLISH");
  lines.push("X-PUBLISHED-TTL:PT1H");

  const stamp = nowIcalUtc();
  const domain = uidDomain();

  for (const s of shifts) {
    lines.push("BEGIN:VEVENT");
    pushField(lines, "UID", `shift-${s.id}@${domain}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${toIcalUtc(s.startAt)}`);
    lines.push(`DTEND:${toIcalUtc(s.endAt)}`);
    pushField(lines, "SUMMARY", escapeIcalText(summaryFor(s)));
    pushField(lines, "DESCRIPTION", escapeIcalText(descriptionFor(s)));
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
