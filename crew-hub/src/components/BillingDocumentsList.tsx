"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type BillingDocRow = {
  id: string;
  kind: "invoice" | "quote";
  number: string;
  customerName: string;
  status: string;
  createdAt: string;
  currency: string;
  totalIncGst: number;
  totalLabel?: string;
};

export function BillingDocumentsList({ items }: { items: BillingDocRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function markPaid(id: string) {
    setErr(null);
    setBusy(id);
    try {
      const res = await fetch(`/api/billing/invoices/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "Could not update");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <>
      {err && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{err}</p>
      )}
      <ul className="space-y-2">
        {items.map((inv) => {
          const kindLabel = inv.kind === "quote" ? "Quote" : "Invoice";
          const showPaid =
            inv.kind === "invoice" && inv.status !== "paid" && inv.status !== "void";
          return (
            <li
              key={inv.id}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link href={`/billing/${inv.id}`} className="min-w-0 flex-1">
                <p className="font-medium text-white">
                  <span className="text-slate-500">{kindLabel}</span> · {inv.number} · {inv.customerName}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {new Date(inv.createdAt).toLocaleString()} · {inv.status} · {inv.currency}{" "}
                  {inv.totalLabel ?? inv.totalIncGst.toFixed(2)} inc GST
                </p>
              </Link>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {showPaid && (
                  <button
                    type="button"
                    disabled={busy === inv.id}
                    onClick={(e) => {
                      e.preventDefault();
                      void markPaid(inv.id);
                    }}
                    className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busy === inv.id ? "…" : "Paid"}
                  </button>
                )}
                <Link href={`/billing/${inv.id}`} className="text-xs text-amber-400/90 hover:text-amber-300">
                  Edit →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
