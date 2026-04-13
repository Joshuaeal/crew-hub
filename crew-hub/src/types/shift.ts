export type ShiftClaimStatus = "pending" | "approved" | "rejected";

export type ShiftClaimEntry = {
  email: string;
  status: ShiftClaimStatus;
  requestedAt: string;
};

/** open = members can claim up to slotsTotal; assigned = admin-set crew only (no claims). */
export type ShiftCrewing = "open" | "assigned";

export type Shift = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  postedBy: string;
  /** open = taking claims; pending = at least one claim awaits admin; filled = crew complete */
  status: "open" | "pending" | "filled";
  /** How crew is filled (default open). assigned = created with fixed crew, no member claims. */
  crewing?: ShiftCrewing;
  /** Positions when crewing is open (default 1, max 50). */
  slotsTotal?: number;
  /** Member claims / approvals (replaces legacy single `claim`). */
  claims?: ShiftClaimEntry[];
  /** @deprecated — use `claims`; still merged on read for old data */
  claim?: ShiftClaimEntry;
  /** Set when admin assigns without going through claim, or mirrors first assignee */
  assignedTo?: string;
  /** Full crew when assigned at creation or when all claim slots are approved */
  assignedEmails?: string[];
};
