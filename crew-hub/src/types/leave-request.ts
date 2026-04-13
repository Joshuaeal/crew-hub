export type LeaveKind = "annual" | "sick" | "personal" | "other";

export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export type LeaveRequest = {
  id: string;
  createdAt: string;
  updatedAt: string;
  requestedByEmail: string;
  requestedByUsername: string;
  startAt: string;
  endAt: string;
  kind: LeaveKind;
  note?: string;
  status: LeaveRequestStatus;
  decidedByEmail?: string;
  decidedAt?: string;
};
