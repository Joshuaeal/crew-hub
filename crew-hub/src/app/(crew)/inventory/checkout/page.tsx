"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { InventoryItem, InventoryJob } from "@/types/inventory";
import { Loader2 } from "lucide-react";

export default function InventoryCheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [jobs, setJobs] = useState<InventoryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [itemId, setItemId] = useState("");
  const [jobId, setJobId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/inventory/items").then((r) => r.json()),
      fetch("/api/inventory/jobs").then((r) => r.json()),
    ])
      .then(([it, jb]) => {
        if (Array.isArray(it.items)) setItems(it.items);
        if (Array.isArray(jb.items)) setJobs(jb.items);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/inventory/checkout-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          jobId,
          quantity: parseFloat(quantity),
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed");
        return;
      }
      router.push("/inventory");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-lg space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/inventory" className="text-sm text-slate-400 hover:text-white">
            ← Inventory
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Request checkout</h1>
          <p className="mt-1 text-sm text-slate-400">
            Tie items to a job. An administrator will approve before stock is deducted.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            )}

            <div>
              <label className="block text-sm text-slate-400">Job</label>
              <select
                required
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="">— Select job —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-600">
                Jobs are created by inventory admins on the{" "}
                <Link href="/inventory/jobs" className="text-violet-400/90 hover:underline">
                  Jobs
                </Link>{" "}
                page.
              </p>
            </div>

            <div>
              <label className="block text-sm text-slate-400">Item</label>
              <select
                required
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="">— Select item —</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                    {it.sku ? ` (${it.sku})` : ""} — qty {it.quantity}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400">Quantity</label>
              <input
                required
                type="number"
                min={0.001}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400">Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>

            <button
              type="submit"
              disabled={pending || !itemId || !jobId}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500/90 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Submit request
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
