"use client";

import { useCallback, useEffect, useState } from "react";
import type { Shift } from "@/types/shift";
import { ShiftsCalendarView } from "@/components/ShiftsCalendarView";
import {
  getAssignedEmails,
  getCrewing,
  getShiftClaims,
  getSlotsTotal,
} from "@/lib/shift-utils";
import { CalendarDays, LayoutList, Loader2 } from "lucide-react";

type CrewOption = { email: string; username: string; displayName: string };

function manageCalendarStatusLabel(s: Shift): string {
  if (getCrewing(s) === "assigned") {
    const n = getAssignedEmails(s).length;
    return n ? `Assigned · ${n}` : "Assigned";
  }
  if (s.status === "filled") {
    const emails = getAssignedEmails(s);
    return emails.length ? `Filled · ${emails.length}` : s.assignedTo ? `Filled · ${s.assignedTo}` : "Filled";
  }
  if (s.status === "pending") {
    const pend = getShiftClaims(s).filter((c) => c.status === "pending");
    return pend.length ? `Pending · ${pend.length}` : "Pending";
  }
  const n = getShiftClaims(s).filter((c) => c.status === "pending" || c.status === "approved").length;
  const cap = getSlotsTotal(s);
  return `${n}/${cap} slots`;
}

export function ShiftManageClient() {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [createPending, setCreatePending] = useState(false);

  const [crewingMode, setCrewingMode] = useState<"open" | "assigned">("open");
  const [slotsTotal, setSlotsTotal] = useState(1);
  const [crewOptions, setCrewOptions] = useState<CrewOption[] | null>(null);
  const [assignSelected, setAssignSelected] = useState<Record<string, boolean>>({});

  const [assignEmail, setAssignEmail] = useState<Record<string, string>>({});
  const [allShiftsView, setAllShiftsView] = useState<"list" | "calendar">("calendar");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/shifts");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load");
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/shifts/crew-options");
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        if (Array.isArray(data.users)) {
          setCrewOptions(data.users as CrewOption[]);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleAssign(email: string) {
    setAssignSelected((prev) => ({ ...prev, [email]: !prev[email] }));
  }

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    if (crewingMode === "assigned") {
      const emails = Object.entries(assignSelected)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (emails.length === 0) {
        setError("Select at least one crew member to assign.");
        return;
      }
    }
    setCreatePending(true);
    setError(null);
    try {
      const assignedEmails =
        crewingMode === "assigned"
          ? Object.entries(assignSelected)
              .filter(([, v]) => v)
              .map(([k]) => k)
          : undefined;
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          crewing: crewingMode,
          slotsTotal: crewingMode === "open" ? slotsTotal : undefined,
          assignedEmails,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Create failed");
        return;
      }
      setTitle("");
      setDescription("");
      setStartAt("");
      setEndAt("");
      setCrewingMode("open");
      setSlotsTotal(1);
      setAssignSelected({});
      await load();
    } finally {
      setCreatePending(false);
    }
  }

  async function approve(id: string, email?: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email ? { email } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Approve failed");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string, email?: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email ? { email } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Reject failed");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function assign(id: string) {
    const email = assignEmail[id]?.trim();
    if (!email) {
      setError("Enter an email to assign");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Assign failed");
        return;
      }
      setAssignEmail((prev) => ({ ...prev, [id]: "" }));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-10">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Post a shift</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose <strong className="text-slate-400">Open</strong> so crew can claim slots, or{" "}
          <strong className="text-slate-400">Assign crew</strong> to pick people now (no public claims).
        </p>
        <form onSubmit={createShift} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm text-slate-400">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-slate-400">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400">Start</label>
            <input
              required
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400">End</label>
            <input
              required
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-medium text-slate-300">Crewing</p>
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3 has-[:checked]:border-brand/40 has-[:checked]:bg-brand/10">
                <input
                  type="radio"
                  name="crewing"
                  className="mt-1"
                  checked={crewingMode === "open"}
                  onChange={() => setCrewingMode("open")}
                />
                <span>
                  <span className="font-medium text-white">Open</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Members with shifts permission can claim until slots are full; you approve each claim.
                  </span>
                </span>
              </label>
              {crewingMode === "open" && (
                <div className="ml-7">
                  <label className="block text-xs text-slate-500">How many crew slots?</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={slotsTotal}
                    onChange={(e) => setSlotsTotal(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                    className="mt-1 w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3 has-[:checked]:border-brand/40 has-[:checked]:bg-brand/10">
                <input
                  type="radio"
                  name="crewing"
                  className="mt-1"
                  checked={crewingMode === "assigned"}
                  onChange={() => setCrewingMode("assigned")}
                />
                <span>
                  <span className="font-medium text-white">Assign crew</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Choose who is on this shift now. No claiming — the shift is fully booked for those people.
                  </span>
                </span>
              </label>
              {crewingMode === "assigned" && (
                <div className="ml-7 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
                  {crewOptions === null ? (
                    <p className="text-xs text-slate-500">Loading crew…</p>
                  ) : crewOptions.length === 0 ? (
                    <p className="text-xs text-slate-500">No users found.</p>
                  ) : (
                    <ul className="space-y-1">
                      {crewOptions.map((u) => (
                        <li key={u.email}>
                          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-white/5">
                            <input
                              type="checkbox"
                              checked={Boolean(assignSelected[u.email])}
                              onChange={() => toggleAssign(u.email)}
                            />
                            <span className="text-white">{u.displayName}</span>
                            <span className="text-xs text-slate-500">{u.email}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={createPending}
              className="rounded-lg bg-brand/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-60"
            >
              {createPending ? "Posting…" : "Post shift"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white">All shifts</h2>
          {shifts && shifts.length > 0 && (
            <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => setAllShiftsView("calendar")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  allShiftsView === "calendar"
                    ? "bg-brand/20 text-brand/95 ring-1 ring-brand/35"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                Calendar
              </button>
              <button
                type="button"
                onClick={() => setAllShiftsView("list")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  allShiftsView === "list"
                    ? "bg-brand/20 text-brand/95 ring-1 ring-brand/35"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LayoutList className="h-4 w-4" aria-hidden />
                List
              </button>
            </div>
          )}
        </div>
        {shifts === null ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : shifts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No shifts yet.</p>
        ) : allShiftsView === "calendar" ? (
          <div className="mt-4">
            <ShiftsCalendarView
              shifts={shifts}
              statusLabel={manageCalendarStatusLabel}
              showFooterHint={false}
            />
            <p className="mt-4 text-xs text-slate-500">
              Approve, reject, and assign from the list view.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {shifts.map((s) => {
              const claims = getShiftClaims(s);
              const pendingClaims = claims.filter((c) => c.status === "pending");
              const assigned = getAssignedEmails(s);
              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300"
                >
                  <div className="font-medium text-white">{s.title}</div>
                  <p className="mt-1 text-xs text-slate-500">
                    {s.status}
                    {getCrewing(s) === "open" ? ` · ${getSlotsTotal(s)} slot(s)` : " · assigned"}
                    {" · "}
                    {new Date(s.startAt).toLocaleString()} → {new Date(s.endAt).toLocaleString()}
                  </p>
                  {getCrewing(s) === "assigned" && assigned.length > 0 && (
                    <p className="mt-2 text-xs text-emerald-200/90">
                      Crew: {assigned.join(", ")}
                    </p>
                  )}
                  {claims.map((c) => (
                    <p key={`${c.email}-${c.requestedAt}`} className="mt-1 text-xs text-amber-200/90">
                      Claim: {c.email} ({c.status})
                    </p>
                  ))}
                  {s.assignedTo && getCrewing(s) !== "assigned" && (
                    <p className="mt-1 text-xs text-emerald-200/90">Assigned: {s.assignedTo}</p>
                  )}

                  <div className="mt-3 flex flex-col gap-2">
                    {pendingClaims.map((c) => (
                      <div key={c.email} className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-amber-100/90">Pending: {c.email}</span>
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => void approve(s.id, c.email)}
                          className="rounded-lg bg-emerald-500/25 px-3 py-1.5 text-xs font-medium text-emerald-100 ring-1 ring-emerald-500/40 hover:bg-emerald-500/35 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => void reject(s.id, c.email)}
                          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-100 ring-1 ring-red-500/35 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ))}
                  </div>

                  {(s.status === "open" || s.status === "pending") && getCrewing(s) === "open" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                      <span className="text-xs text-slate-500">Or assign directly:</span>
                      <input
                        type="email"
                        placeholder="member@crew.local"
                        value={assignEmail[s.id] ?? ""}
                        onChange={(e) =>
                          setAssignEmail((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                        className="min-w-[200px] rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:ring-2 focus:ring-brand/40"
                      />
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => void assign(s.id)}
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-50"
                      >
                        Assign
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
