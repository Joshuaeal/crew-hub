"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { InventoryCheckoutRequest, InventoryItem, InventoryJob } from "@/types/inventory";
import { Loader2 } from "lucide-react";

export default function InventoryRequestsAdminPage() {
  const [rows, setRows] = useState<InventoryCheckoutRequest[]>([]);
  const [items, setItems] = useState<Record<string, InventoryItem>>({});
  const [jobs, setJobs] = useState<Record<string, InventoryJob>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      fetch("/api/inventory/checkout-requests").then((r) => r.json()),
      fetch("/api/inventory/items").then((r) => r.json()),
      fetch("/api/inventory/jobs").then((r) => r.json()),
    ])
      .then(([reqs, inv, jb]) => {
        if (Array.isArray(reqs.items)) setRows(reqs.items);
        const im: Record<string, InventoryItem> = {};
        if (Array.isArray(inv.items)) {
          for (const it of inv.items as InventoryItem[]) im[it.id] = it;
        }
        setItems(im);
        const jm: Record<string, InventoryJob> = {};
        if (Array.isArray(jb.items)) {
          for (const j of jb.items as InventoryJob[]) jm[j.id] = j;
        }
        setJobs(jm);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/checkout-requests/${id}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Approve failed");
        return;
      }
      load();
    } finally {
      setPendingId(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt("Reason (optional)") ?? "";
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/checkout-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Reject failed");
        return;
      }
      load();
    } finally {
      setPendingId(null);
    }
  }

  const pendingRows = rows.filter((r) => r.status === "pending");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/inventory" className="text-sm text-slate-400 hover:text-white">
            ← Inventory
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Approve checkouts</h1>
          <p className="mt-1 text-sm text-slate-400">
            Pending requests deduct stock only after you approve. (User admin permission required.)
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            )}

            {pendingRows.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-500">
                No pending checkout requests.
              </p>
            ) : (
              <ul className="space-y-3">
                {pendingRows.map((r) => {
                  const it = items[r.itemId];
                  const job = jobs[r.jobId];
                  return (
                    <li
                      key={r.id}
                      className="rounded-xl border border-amber-500/25 bg-amber-950/15 px-4 py-4 sm:flex sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-white">
                          {it?.name ?? r.itemId}
                          {it?.sku && <span className="text-slate-500"> · {it.sku}</span>}
                        </p>
                        <p className="text-sm text-slate-400">
                          Job: {job?.name ?? r.jobId} · Qty {r.quantity}
                        </p>
                        <p className="text-xs text-slate-500">
                          Requested by {r.requestedByEmail} · {new Date(r.createdAt).toLocaleString()}
                        </p>
                        {r.note && <p className="text-sm text-slate-500">Note: {r.note}</p>}
                      </div>
                      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
                        <button
                          type="button"
                          disabled={pendingId !== null}
                          onClick={() => void approve(r.id)}
                          className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {pendingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={pendingId !== null}
                          onClick={() => void reject(r.id)}
                          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {rows.some((r) => r.status !== "pending") && (
              <div className="border-t border-white/10 pt-6">
                <h2 className="text-sm font-medium text-slate-400">Recent history</h2>
                <ul className="mt-2 space-y-1 text-sm text-slate-500">
                  {rows
                    .filter((r) => r.status !== "pending")
                    .slice(0, 20)
                    .map((r) => (
                      <li key={r.id}>
                        {r.status} · {items[r.itemId]?.name ?? r.itemId} × {r.quantity} · {r.requestedByEmail}
                        {r.reviewedAt && ` · ${new Date(r.reviewedAt).toLocaleString()}`}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
