"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const KINDS = [
  { id: "annual" as const, label: "Annual" },
  { id: "sick" as const, label: "Sick" },
  { id: "personal" as const, label: "Personal" },
  { id: "other" as const, label: "Other" },
];

export default function HrLeaveNewPage() {
  const router = useRouter();
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("annual");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/hr/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt, endAt, kind, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not submit");
        return;
      }
      router.push("/hr/leave");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-lg space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href="/hr/leave" className="text-sm text-brand/90 hover:text-brand/80">
          ← Leave requests
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Request leave</h1>
          <p className="mt-1 text-sm text-slate-400">Pick dates and type; a manager will approve or reject.</p>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>
          )}
          <div>
            <label className="text-sm text-slate-300">Type</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as (typeof KINDS)[number]["id"])}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-300">Start</label>
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300">End</label>
            <input
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand/90 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit request"}
          </button>
        </form>
      </div>
    </div>
  );
}
