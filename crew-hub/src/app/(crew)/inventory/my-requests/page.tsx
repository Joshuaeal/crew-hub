"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { InventoryCheckoutRequest, InventoryItem, InventoryJob } from "@/types/inventory";
import { Loader2 } from "lucide-react";

export default function MyInventoryRequestsPage() {
  const [rows, setRows] = useState<InventoryCheckoutRequest[]>([]);
  const [items, setItems] = useState<Record<string, InventoryItem>>({});
  const [jobs, setJobs] = useState<Record<string, InventoryJob>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      fetch("/api/inventory/checkout-requests?mine=1").then((r) => r.json()),
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

  async function cancel(id: string) {
    if (!confirm("Cancel this pending request?")) return;
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/checkout-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Cancel failed");
        return;
      }
      load();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/inventory" className="text-sm text-slate-400 hover:text-white">
            ← Inventory
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">My checkout requests</h1>
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
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">No requests yet.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="font-medium text-white">{r.status}</span>
                        {" · "}
                        {items[r.itemId]?.name ?? r.itemId} × {r.quantity}
                        <br />
                        <span className="text-slate-500">
                          Job: {jobs[r.jobId]?.name ?? r.jobId} · {new Date(r.createdAt).toLocaleString()}
                        </span>
                        {r.rejectReason && (
                          <p className="mt-1 text-amber-200/90">Reason: {r.rejectReason}</p>
                        )}
                      </div>
                      {r.status === "pending" && (
                        <button
                          type="button"
                          disabled={pendingId !== null}
                          onClick={() => void cancel(r.id)}
                          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          {pendingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
