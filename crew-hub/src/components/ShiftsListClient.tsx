"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Shift } from "@/types/shift";
import { ShiftsCalendarView } from "@/components/ShiftsCalendarView";
import {
  getAssignedEmails,
  getCrewing,
  getShiftClaims,
  getSlotsTotal,
} from "@/lib/shift-utils";
import { CalendarClock, CalendarDays, LayoutList, Loader2 } from "lucide-react";

type Props = {
  email: string;
};

export function ShiftsListClient({ email }: Props) {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "calendar">("calendar");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/shifts");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load shifts");
        return;
      }
      setShifts(Array.isArray(data.shifts) ? data.shifts : []);
    } catch {
      setError("Failed to load shifts");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedEmail = email.toLowerCase();

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
    if (getCrewing(s) === "assigned") return "Assigned";
    return `Open · ${n}/${cap}`;
  }

  if (shifts === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading shifts…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      {shifts.length > 0 && (
        <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              view === "calendar"
                ? "bg-brand/20 text-brand/95 ring-1 ring-brand/35"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              view === "list"
                ? "bg-brand/20 text-brand/95 ring-1 ring-brand/35"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <LayoutList className="h-4 w-4" aria-hidden />
            List
          </button>
        </div>
      )}

      {shifts.length === 0 ? (
        <p className="text-sm text-slate-500">No shifts posted yet. Admins can add shifts from Manage.</p>
      ) : view === "calendar" ? (
        <ShiftsCalendarView shifts={shifts} statusLabel={statusLabel} />
      ) : (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
          {shifts.map((s) => (
            <li key={s.id}>
              <Link
                href={`/shifts/${s.id}`}
                className="flex flex-col gap-3 p-4 transition hover:bg-white/[0.03] sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarClock className="h-4 w-4 shrink-0 text-brand/80" aria-hidden />
                    <h2 className="font-medium text-white">{s.title}</h2>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                      {statusLabel(s)}
                    </span>
                  </div>
                  {s.description && <p className="mt-1 text-sm text-slate-400">{s.description}</p>}
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(s.startAt).toLocaleString()} → {new Date(s.endAt).toLocaleString()}
                  </p>
                  {s.status === "filled" && getAssignedEmails(s).length > 0 ? (
                    <p className="mt-1 text-xs text-emerald-200/80">
                      Crew: <span className="text-emerald-100">{getAssignedEmails(s).join(", ")}</span>
                    </p>
                  ) : getShiftClaims(s).length > 0 ? (
                    <p className="mt-1 text-xs text-amber-200/80">
                      Claims:{" "}
                      <span className="text-amber-100">
                        {getShiftClaims(s)
                          .map((c) => `${c.email} (${c.status})`)
                          .join(", ")}
                      </span>
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 self-start text-sm font-medium text-brand/90 sm:mt-0.5">
                  View
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
