"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Shift } from "@/types/shift";
import {
  canMemberClaim,
  getAssignedEmails,
  getCrewing,
  getShiftClaims,
  getSlotsTotal,
} from "@/lib/shift-utils";
import { CalendarClock, Loader2 } from "lucide-react";

type Props = {
  shiftId: string;
  email: string;
  canClaim: boolean;
};

export function ShiftDetailClient({ shiftId, email, canClaim }: Props) {
  const [shift, setShift] = useState<Shift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalizedEmail = email.toLowerCase();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load shift");
        setShift(null);
        return;
      }
      setShift(data.shift as Shift);
    } catch {
      setError("Failed to load shift");
      setShift(null);
    }
  }, [shiftId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/claim`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not claim");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  function statusLabel(s: Shift) {
    if (s.status === "filled") {
      const emails = getAssignedEmails(s);
      if (emails.some((x) => x.toLowerCase() === normalizedEmail)) return "Assigned to you";
      return "Filled";
    }
    if (s.status === "pending") {
      const mine = getShiftClaims(s).find((c) => c.email.toLowerCase() === normalizedEmail);
      if (mine?.status === "pending") return "Your claim — pending approval";
      return "Pending approval";
    }
    const n = getShiftClaims(s).filter((c) => c.status === "pending" || c.status === "approved").length;
    const cap = getSlotsTotal(s);
    return `Open · ${n}/${cap} slots`;
  }

  if (shift === null && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading shift…
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-100">{error ?? "Shift not found."}</p>
        <Link href="/shifts" className="text-sm text-brand/90 hover:text-brand/80">
          ← Back to Shifts
        </Link>
      </div>
    );
  }

  const claims = getShiftClaims(shift);
  const assigned = getAssignedEmails(shift);
  const showClaim =
    canClaim && shift && canMemberClaim(shift, normalizedEmail);

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand/80" aria-hidden />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-white">{shift.title}</h1>
            <span className="mt-2 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
              {statusLabel(shift)}
            </span>
            {getCrewing(shift) === "assigned" && (
              <p className="mt-2 text-xs text-slate-500">This shift was assigned by an admin (not open for claims).</p>
            )}
            {shift.description && (
              <p className="mt-4 text-sm leading-relaxed text-slate-300">{shift.description}</p>
            )}
            <p className="mt-4 text-sm text-slate-400">
              <span className="text-slate-500">Starts</span>{" "}
              {new Date(shift.startAt).toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              <span className="text-slate-500">Ends</span>{" "}
              {new Date(shift.endAt).toLocaleString()}
            </p>
            {shift.status === "filled" && assigned.length > 0 ? (
              <p className="mt-3 text-xs text-emerald-200/80">
                Crew: <span className="text-emerald-100">{assigned.join(", ")}</span>
              </p>
            ) : claims.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-amber-200/80">
                {claims.map((c) => (
                  <li key={`${c.email}-${c.requestedAt}`}>
                    {c.email} — <span className="text-amber-100">{c.status}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {showClaim && (
          <div className="mt-6 border-t border-white/10 pt-6">
            <button
              type="button"
              disabled={busy}
              onClick={() => void claim()}
              className="rounded-lg bg-brand/25 px-5 py-2.5 text-sm font-medium text-brand/95 ring-1 ring-brand/40 hover:bg-brand/35 disabled:opacity-50"
            >
              {busy ? "…" : "Claim this shift"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
