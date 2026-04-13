"use client";

import { useCallback, useMemo, useState } from "react";
import { computePayrollRollups } from "@/lib/payables-stats";
import type { Payable, PayableStatus } from "@/types/payables";

const STATUS: { value: PayableStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

function fmtAud(n: number, signed: boolean) {
  const abs = Math.abs(n).toFixed(2);
  if (!signed) return `$${abs}`;
  if (n === 0) return "$0.00";
  return n < 0 ? `−$${abs}` : `+$${abs}`;
}

export function PayablesClient({ initialItems }: { initialItems: Payable[] }) {
  const [items, setItems] = useState<Payable[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rollups = useMemo(() => computePayrollRollups(items), [items]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/billing/payables", { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not load");
      return;
    }
    setItems(Array.isArray(data.items) ? data.items : []);
    setError(null);
  }, []);

  async function addRow() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/payables", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New payable",
          amountAudIncGst: 0,
          status: "draft",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create");
        return;
      }
      if (data.item) setItems((prev) => [data.item as Payable, ...prev]);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/payables/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Update failed");
        return;
      }
      if (data.item) {
        setItems((prev) => prev.map((p) => (p.id === id ? (data.item as Payable) : p)));
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this payable?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/billing/payables/${id}`, { method: "DELETE", credentials: "same-origin" });
      if (res.ok) setItems((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">Outstanding (unpaid)</p>
          <p className="mt-2 text-2xl font-semibold text-amber-100">{fmtAud(-rollups.outstanding, true)}</p>
          <p className="mt-1 text-xs text-slate-500">Draft + pending + approved</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rollups.month.label}</p>
          <p className="mt-2 text-xl font-semibold text-white">{fmtAud(rollups.month.paidSigned, true)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Paid out · avg / mo: {fmtAud(rollups.month.avgPerMonth, false)} (calendar month)
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rollups.quarter.label}</p>
          <p className="mt-2 text-xl font-semibold text-white">{fmtAud(rollups.quarter.paidSigned, true)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Paid out · avg / mo: {fmtAud(rollups.quarter.avgPerMonth, false)} (÷3)
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rollups.fy.label}</p>
          <p className="mt-2 text-xl font-semibold text-white">{fmtAud(rollups.fy.paidSigned, true)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Paid out · avg / mo: {fmtAud(rollups.fy.avgPerMonth, false)} (÷12, AU FY)
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void addRow()}
          className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          Add payable
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-white/10 bg-black/30 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Amount (AUD inc GST)</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Attachment</th>
              <th className="px-3 py-2">Paid at</th>
              <th className="px-3 py-2">Billing doc</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                  No payables yet. Add supplier bills, reimbursements, or other outflows to track and approve.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-full min-w-[140px] rounded border border-white/10 bg-black/30 px-2 py-1 text-white"
                      defaultValue={p.title}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== p.title) void patch(p.id, { title: v });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-full min-w-[100px] rounded border border-white/10 bg-black/30 px-2 py-1 text-white"
                      defaultValue={p.vendor ?? ""}
                      placeholder="Vendor"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (p.vendor ?? "")) void patch(p.id, { vendor: v || null });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-28 rounded border border-white/10 bg-black/30 px-2 py-1 text-white"
                      defaultValue={p.amountAudIncGst}
                      onBlur={(e) => {
                        const n = parseFloat(e.target.value);
                        if (Number.isFinite(n) && n >= 0 && n !== p.amountAudIncGst) {
                          void patch(p.id, { amountAudIncGst: n });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      className="rounded border border-white/10 bg-black/30 px-2 py-1 text-white"
                      value={p.status}
                      disabled={busy}
                      onChange={(e) => {
                        const status = e.target.value as PayableStatus;
                        void patch(p.id, { status });
                      }}
                    >
                      {STATUS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="date"
                      className="rounded border border-white/10 bg-black/30 px-2 py-1 text-white"
                      value={p.dueDate?.slice(0, 10) ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        void patch(p.id, { dueDate: v || null });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {p.attachmentRelativePath ? (
                      <a
                        href={`/api/billing/payables/${p.id}/attachment`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand/90 hover:underline"
                      >
                        {p.attachmentFilename ?? "Download"}
                      </a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-slate-400">
                    {p.paidAt ? new Date(p.paidAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-24 rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs text-white"
                      defaultValue={p.linkedBillingDocumentId ?? ""}
                      placeholder="UUID"
                      title="Optional Crew billing document id"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (p.linkedBillingDocumentId ?? "")) {
                          void patch(p.id, { linkedBillingDocumentId: v || null });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col gap-1.5">
                      {p.status !== "paid" && p.status !== "void" && (
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded bg-emerald-700/90 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                          onClick={() => void patch(p.id, { status: "paid" })}
                        >
                          Paid
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:text-red-300"
                        onClick={() => void remove(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-600">
        Amounts are AUD inc GST. Outflows show with a minus sign. Averages: calendar month, current Australian FY
        quarter (three months), and full FY (July–June) with total paid ÷ 12 for yearly average monthly outflow.
      </p>
    </div>
  );
}
