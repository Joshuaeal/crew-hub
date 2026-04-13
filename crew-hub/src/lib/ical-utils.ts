/** Shared iCalendar (RFC 5545) helpers for shifts and crew calendar feeds. */

export function escapeIcalText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function toIcalUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "19700101T000000Z";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const sec = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${sec}Z`;
}

export function nowIcalUtc(): string {
  return toIcalUtc(new Date().toISOString());
}

export function uidDomain(): string {
  const d = process.env.CREW_ICAL_UID_DOMAIN?.trim();
  if (d) return d.replace(/[^a-zA-Z0-9.-]/g, "") || "crew-hub.local";
  return "crew-hub.local";
}

/** RFC 5545: fold content lines longer than 75 octets (ASCII-safe). */
export function foldLine(line: string): string[] {
  if (line.length <= 75) return [line];
  const out: string[] = [];
  let i = 0;
  out.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    out.push(` ${line.slice(i, i + 74)}`);
    i += 74;
  }
  return out;
}

export function pushField(lines: string[], name: string, value: string) {
  const raw = `${name}:${value}`;
  lines.push(...foldLine(raw));
}

/** All-day event: YYYYMMDD in UTC calendar date. */
export function toIcalDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "19700101";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
