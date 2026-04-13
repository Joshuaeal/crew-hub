"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { InventoryJob } from "@/types/inventory";
import { Loader2, Plus, Trash2 } from "lucide-react";

export default function InventoryJobsPage() {
  const [items, setItems] = useState<InventoryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [canManage, setCanManage] = useState(false);

  const load = useCallback(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        const perms: string[] = Array.isArray(s.permissions) ? s.permissions : [];
        const ok =
          perms.includes("*") ||
          perms.includes("inventory") ||
          perms.includes("users_manage");
        setCanManage(ok);
      })
      .catch(() => setCanManage(false));

    fetch("/api/inventory/jobs")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setItems(d.items);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/inventory/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), notes: notes.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed");
        return;
      }
      setName("");
      setNotes("");
      load();
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!canManage) return;
    if (!confirm("Delete this job? Pending checkouts still reference it by id.")) return;
    setPending(true);
    try {
      await fetch(`/api/inventory/jobs/${id}`, { method: "DELETE" });
      load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/inventory" className="text-sm text-slate-400 hover:text-white">
            ← Inventory
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Jobs</h1>
          <p className="mt-1 text-sm text-slate-400">
            Group checkout requests by job (install, venue, project). Everyone can see the list; only inventory
            admins create or delete jobs.
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

            {canManage && (
              <form onSubmit={(e) => void add(e)} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-medium text-slate-300">New job</h2>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Job name"
                  required
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                />
                <button
                  type="submit"
                  disabled={pending || !name.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-50"
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  <Plus className="h-4 w-4" aria-hidden />
                  Add job
                </button>
              </form>
            )}

            {!canManage && (
              <p className="text-sm text-slate-500">
                You can use jobs for checkout requests. Ask an inventory admin to add jobs here.
              </p>
            )}

            <ul className="space-y-2">
              {items.length === 0 ? (
                <li className="rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                  No jobs yet.
                </li>
              ) : (
                items.map((j) => (
                  <li
                    key={j.id}
                    className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-white">{j.name}</p>
                      {j.notes && <p className="text-sm text-slate-500">{j.notes}</p>}
                      <p className="text-xs text-slate-600">{j.id}</p>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => void remove(j.id)}
                        disabled={pending}
                        className="self-end rounded p-2 text-slate-500 hover:bg-white/10 hover:text-red-300 sm:self-auto"
                        aria-label="Delete job"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
