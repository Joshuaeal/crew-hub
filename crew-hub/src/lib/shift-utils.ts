import type { Shift, ShiftClaimEntry } from "@/types/shift";

export function getShiftClaims(s: Shift): ShiftClaimEntry[] {
  if (Array.isArray(s.claims) && s.claims.length > 0) return s.claims;
  if (s.claim) return [s.claim];
  return [];
}

export function getSlotsTotal(s: Shift): number {
  const n = s.slotsTotal ?? 1;
  return Math.max(1, Math.min(50, n));
}

export function getCrewing(s: Shift): "open" | "assigned" {
  return s.crewing ?? "open";
}

export function activeClaimCount(claims: ShiftClaimEntry[]): number {
  return claims.filter((c) => c.status === "pending" || c.status === "approved").length;
}

export function userHasClaim(s: Shift, email: string): boolean {
  const e = email.toLowerCase();
  return getShiftClaims(s).some((c) => c.email.toLowerCase() === e);
}

/** Member can request a slot (open crewing, capacity, not already on the shift). */
export function canMemberClaim(s: Shift, email: string): boolean {
  if (getCrewing(s) === "assigned") return false;
  if (s.status === "filled") return false;
  if (userHasClaim(s, email)) return false;
  return activeClaimCount(getShiftClaims(s)) < getSlotsTotal(s);
}

export function getAssignedEmails(s: Shift): string[] {
  if (s.assignedEmails?.length) return s.assignedEmails;
  const approved = getShiftClaims(s).filter((c) => c.status === "approved");
  if (approved.length) return approved.map((c) => c.email);
  if (s.assignedTo) return [s.assignedTo];
  return [];
}

export function normalizeShift(s: Shift): Shift {
  const claims = getShiftClaims(s);
  return {
    ...s,
    claims,
    slotsTotal: getSlotsTotal(s),
    crewing: getCrewing(s),
    claim: undefined,
  };
}

/** Persist without legacy `claim` key when `claims` is present. */
export function forStorage(s: Shift): Shift {
  const n = normalizeShift(s);
  const out: Shift = {
    ...n,
    claim: undefined,
  };
  if (!out.claims?.length) delete out.claims;
  return out;
}
