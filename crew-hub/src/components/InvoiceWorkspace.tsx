"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InvoiceRecord } from "@/types/invoice";
import { InvoiceListClient } from "./invoice/InvoiceListClient";

export function InvoiceWorkspace({
  initialItems,
}: {
  initialItems: InvoiceRecord[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [reference, setReference] = useState("");
  const [amountAudIncGst, setAmountAudIncGst] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/subcontractor/login");
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("reference", reference);
      fd.set("amountAudIncGst", amountAudIncGst);
      fd.set("dueDate", dueDate.includes("T") ? dueDate.slice(0, 10) : dueDate);
      if (notes.trim()) fd.set("notes", notes.trim());
      if (attachment) fd.set("attachment", attachment);

      const res = await fetch("/api/invoices", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Could not submit",
        );
        return;
      }
      if (data.item) {
        setItems((prev) => [data.item as InvoiceRecord, ...prev]);
      }
      setReference("");
      setAmountAudIncGst("");
      setDueDate("");
      setNotes("");
      setAttachment(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Invoices</h1>
          <p className="mt-1 text-sm text-slate-400">
            Attach your tax invoice (PDF or image). Amounts are{" "}
            <strong className="text-slate-300">AUD including GST</strong>.
            Submissions appear in Crew{" "}
            <strong className="text-slate-300">Payables</strong> with the due
            date you set.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="self-start rounded-lg px-4 py-2 text-sm text-slate-400 ring-1 ring-white/10 hover:bg-white/5 hover:text-white sm:self-auto"
        >
          Sign out
        </button>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium text-white">New submission</h2>
        <form
          onSubmit={(e) => void submit(e)}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          {error && (
            <p className="sm:col-span-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <label
              htmlFor="reference"
              className="text-sm font-medium text-slate-300"
            >
              Reference / invoice #
            </label>
            <input
              id="reference"
              required
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
              placeholder="INV-2026-0042"
            />
          </div>
          <div>
            <label
              htmlFor="amountAudIncGst"
              className="text-sm font-medium text-slate-300"
            >
              Amount (AUD inc GST)
            </label>
            <input
              id="amountAudIncGst"
              required
              inputMode="decimal"
              value={amountAudIncGst}
              onChange={(e) => setAmountAudIncGst(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
              placeholder="1250.00"
            />
          </div>
          <div>
            <label
              htmlFor="dueDate"
              className="text-sm font-medium text-slate-300"
            >
              Payment due
            </label>
            <input
              id="dueDate"
              type="datetime-local"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="attachment"
              className="text-sm font-medium text-slate-300"
            >
              Attach invoice
            </label>
            <input
              id="attachment"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
            />
            <p className="mt-1 text-xs text-slate-600">
              PDF or image, max 12 MB. Optional but recommended.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="notes"
              className="text-sm font-medium text-slate-300"
            >
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand/90 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-60"
            >
              {pending ? "Submitting…" : "Submit to payables"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-medium text-white">Your submissions</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No invoices yet.</p>
        ) : (
          <InvoiceListClient items={items} />
        )}
      </section>
    </div>
  );
}
