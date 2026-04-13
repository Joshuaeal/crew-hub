"use client";

import { useCallback, useEffect, useState } from "react";

export type HrDirectoryRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  displayName: string;
  crewHandsRateAudExGst: number | null;
};

export function HrDirectoryClient({
  initialUsers,
  canEdit,
}: {
  initialUsers: HrDirectoryRow[];
  canEdit: boolean;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const saveRow = useCallback(
    async (id: string, displayName: string, rateRaw: string) => {
      setError(null);
      const trimmed = displayName.trim();
      let crewHandsRateAudExGst: number | null = null;
      const r = rateRaw.trim();
      if (r !== "") {
        const n = parseFloat(r);
        if (!Number.isFinite(n) || n < 0) {
          setError("On-hands rate must be a non-negative number (AUD/h ex GST), or leave blank");
          return;
        }
        crewHandsRateAudExGst = Math.round(n * 100) / 100;
      }
      setPendingId(id);
      try {
        const res = await fetch(`/api/hr/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: trimmed || null,
            crewHandsRateAudExGst,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Save failed");
          return;
        }
        const u = data.user as HrDirectoryRow | undefined;
        if (u) {
          setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...u } : x)));
        }
      } finally {
        setPendingId(null);
      }
    },
    []
  );

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>
      )}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name (invoice)</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">On-hands (AUD/h ex GST)</th>
              <th className="px-4 py-3 font-medium">Role</th>
              {canEdit && <th className="px-4 py-3 font-medium"> </th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {users.map((u) => (
              <HrDirectoryRowEdit
                key={u.id}
                user={u}
                canEdit={canEdit}
                pending={pendingId === u.id}
                onSave={saveRow}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        On-hands rate is used as the default hourly rate (ex GST) when this person is selected on billing labour
        lines.
      </p>
    </div>
  );
}

function HrDirectoryRowEdit({
  user,
  canEdit,
  pending,
  onSave,
}: {
  user: HrDirectoryRow;
  canEdit: boolean;
  pending: boolean;
  onSave: (id: string, displayName: string, rateRaw: string) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [rate, setRate] = useState(
    user.crewHandsRateAudExGst != null ? String(user.crewHandsRateAudExGst) : ""
  );

  useEffect(() => {
    setDisplayName(user.displayName);
    setRate(user.crewHandsRateAudExGst != null ? String(user.crewHandsRateAudExGst) : "");
  }, [user.displayName, user.crewHandsRateAudExGst]);

  if (!canEdit) {
    return (
      <tr className="text-slate-300">
        <td className="px-4 py-3 text-white">{user.displayName || "—"}</td>
        <td className="px-4 py-3 font-mono text-brand/70">{user.username}</td>
        <td className="px-4 py-3">{user.email}</td>
        <td className="px-4 py-3 tabular-nums text-slate-400">
          {user.crewHandsRateAudExGst != null ? user.crewHandsRateAudExGst.toFixed(2) : "—"}
        </td>
        <td className="px-4 py-3 capitalize text-slate-500">{user.role}</td>
      </tr>
    );
  }

  return (
    <tr className="text-slate-300">
      <td className="px-4 py-2 align-top">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={user.username}
          className="w-full min-w-[8rem] rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
        />
      </td>
      <td className="px-4 py-3 font-mono text-brand/70">{user.username}</td>
      <td className="px-4 py-3">{user.email}</td>
      <td className="px-4 py-2 align-top">
        <input
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="e.g. 85"
          inputMode="decimal"
          className="w-full max-w-[7rem] rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white tabular-nums outline-none focus:ring-2 focus:ring-brand/40"
        />
      </td>
      <td className="px-4 py-3 capitalize text-slate-500">{user.role}</td>
      <td className="px-4 py-2 align-top">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSave(user.id, displayName, rate)}
          className="rounded-lg bg-brand/25 px-3 py-1.5 text-xs font-medium text-cream ring-1 ring-brand/40 hover:bg-brand/35 disabled:opacity-50"
        >
          {pending ? "…" : "Save"}
        </button>
      </td>
    </tr>
  );
}
