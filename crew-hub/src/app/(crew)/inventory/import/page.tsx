"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Upload } from "lucide-react";

export default function InventoryImportPage() {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/inventory/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Import failed");
        return;
      }
      const errs = Array.isArray(data.errors) ? data.errors : [];
      setResult(
        `Created ${data.created ?? 0}, updated ${data.updated ?? 0}.` +
          (errs.length ? ` Warnings: ${errs.slice(0, 5).join("; ")}` : "")
      );
    } finally {
      setPending(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/inventory" className="text-sm text-slate-400 hover:text-white">
            ← Inventory
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Import CSV</h1>
          <p className="mt-1 text-sm text-slate-400">
            Admin only. UTF-8 CSV with a header row. Columns (case-insensitive):{" "}
            <code className="text-slate-300">name</code>, <code className="text-slate-300">sku</code>,{" "}
            <code className="text-slate-300">quantity</code>, <code className="text-slate-300">location</code>,{" "}
            <code className="text-slate-300">category</code>, <code className="text-slate-300">notes</code>,{" "}
            <code className="text-slate-300">minQuantity</code>. Rows with a matching{" "}
            <code className="text-slate-300">sku</code> update the existing item.
          </p>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-violet-500/35 bg-violet-950/10 px-6 py-12 hover:border-violet-500/50">
          <Upload className="mb-2 h-8 w-8 text-violet-400/80" aria-hidden />
          <span className="text-sm font-medium text-white">Choose CSV file</span>
          <span className="mt-1 text-xs text-slate-500">inventory.csv</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e)} />
        </label>

        {pending && (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Importing…
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>
        )}
        {result && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100">
            {result}
          </p>
        )}
      </div>
    </div>
  );
}
