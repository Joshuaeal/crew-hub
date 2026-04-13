"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BillingClient } from "@/types/billing";
import { Loader2, Plus, Trash2 } from "lucide-react";

export default function BillingClientsPage() {
  const [items, setItems] = useState<BillingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    fetch("/api/billing/clients")
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
    setError(null);
    if (!name.trim()) return;
    setPending(true);
    try {
      const res = await fetch("/api/billing/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          company: company.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed");
        return;
      }
      setName("");
      setEmail("");
      setCompany("");
      setAddress("");
      setNotes("");
      load();
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this client?")) return;
    setPending(true);
    try {
      await fetch(`/api/billing/clients/${id}`, { method: "DELETE" });
      load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/billing" className="text-sm text-slate-400 hover:text-white">
            ← Billing
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-white">Clients</h1>
          <p className="mt-1 text-sm text-slate-400">
            Saved customers for quotes and invoices. Pick them when editing a document.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => void add(e)}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h2 className="text-lg font-medium text-white">Add client</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-400">Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Company</label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-400">Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-slate-400">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add client
          </button>
        </form>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Directory</h2>
          {loading ? (
            <p className="mt-4 text-slate-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mt-4 text-slate-500">No clients yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {items.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {[c.email, c.company].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(c.id)}
                    className="self-start rounded p-2 text-slate-500 hover:bg-white/10 hover:text-red-300"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
