import { timingSafeEqual } from "crypto";

/** Constant-time compare for CREW_ICAL_TOKEN query param. */
export function verifyIcalToken(queryToken: string, secret: string): boolean {
  const a = Buffer.from(queryToken, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
