"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LeaveRequest } from "@/types/leave-request";
import { Loader2 } from "lucide-react";

export function HrLeaveClient() {
  const [items, setItems] = useState<LeaveRequest[] | null>(null);
  const [canApprove, setCanApprove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/hr/leave");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setCanApprove(Boolean(data.canApprove));
    } catch {
      setError("Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/hr/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Update failed");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/hr" className="text-sm text-brand/90 hover:text-brand/80">
          ← HR
        </Link>
        <Link
          href="/hr/leave/new"
          className="inline-flex shrink-0 justify-center rounded-lg bg-brand/25 px-4 py-2 text-sm font-medium text-cream ring-1 ring-brand/40 hover:bg-brand/35"
        >
          Request leave
        </Link>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>
      )}

      {items === null ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No leave requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-white">
                    {r.kind} · {r.requestedByUsername}
                    <span className="ml-2 font-normal text-slate-500">{r.requestedByEmail}</span>
                  </p>
                  <p className="mt-1 text-slate-400">
                    {new Date(r.startAt).toLocaleString()} → {new Date(r.endAt).toLocaleString()}
                  </p>
                  {r.note && <p className="mt-2 text-slate-500">{r.note}</p>}
                  <p className="mt-2 text-xs uppercase tracking-wide text-slate-600">
                    {r.status}
                    {r.decidedAt && ` · ${new Date(r.decidedAt).toLocaleString()}`}
                    {r.decidedByEmail && ` · ${r.decidedByEmail}`}
                  </p>
                </div>
                {canApprove && r.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void decide(r.id, "approved")}
                      className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-100 ring-1 ring-emerald-500/35 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void decide(r.id, "rejected")}
                      className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-100 ring-1 ring-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
