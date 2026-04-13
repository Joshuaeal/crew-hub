"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FileText,
  Download,
  Copy,
  CheckCircle2,
  Clock,
  Trash2,
} from "lucide-react";
import type { InvoiceRecord } from "@/types/invoice";

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function displayStatus(invoice: InvoiceRecord): {
  label: string;
  icon: React.ElementType;
  color: string;
} {
  if (invoice.attachmentRelativePath) {
    return {
      label: "Submitted",
      icon: CheckCircle2,
      color: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    };
  }
  if (invoice.submittedAt) {
    return {
      label: "Processing",
      icon: Clock,
      color: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    };
  }
  return {
    label: "Draft",
    icon: FileText,
    color: "bg-slate-500/10 text-slate-400 ring-slate-500/30",
  };
}

type InvoiceRowProps = {
  invoice: InvoiceRecord;
  onDelete?: (id: string) => void;
};

function InvoiceRow({ invoice, onDelete }: InvoiceRowProps): React.JSX.Element {
  const status = displayStatus(invoice);
  const Icon = status.icon;

  async function deleteInvoice(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!confirm("Delete this invoice record? This cannot be undone.")) {
      return;
    }
    try {
      const ok = await fetch("/api/invoices", {
        method: "DELETE",
        body: JSON.stringify({ id: invoice.id }),
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.ok);
      if (ok) {
        onDelete?.(invoice.id);
      }
    } catch {
      /* Network error — ignore for UX */
    }
  }

  function copyReference(): void {
    if (invoice.reference) {
      navigator.clipboard.writeText(invoice.reference).then(() => {
        /* Optional toast could go here */
      });
    }
  }

  const attachmentLink = invoice.attachmentRelativePath
    ? `/api/invoices/${invoice.id}/attachment`
    : null;

  return (
    <tr key={invoice.id} className="text-slate-200 hover:bg-white/[0.03]">
      <td className="px-4 py-3 font-mono text-xs sm:text-sm whitespace-nowrap">
        {invoice.reference}
      </td>
      <td className="px-4 py-3">
        {invoice.amountAudIncGst !== undefined
          ? `${invoice.amountAudIncGst.toFixed(2)} AUD inc GST`
          : (invoice.amount ?? "—")}
      </td>
      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
        {invoice.dueDate ?? "—"}
      </td>
      <td className="px-4 py-3">
        {attachmentLink ? (
          <a
            href={attachmentLink}
            className="inline-flex items-center gap-1 text-brand/90 hover:underline text-xs"
            target="_blank"
            rel="noreferrer"
          >
            <Download className="h-3 w-3" aria-hidden />
            Download
          </a>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${status.color}`}
        >
          <Icon className="h-3 w-3" aria-hidden />
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
        {formatDateTime(invoice.submittedAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={copyReference}
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label={`Copy ${invoice.reference} to clipboard`}
            title="Copy reference"
          >
            <Copy className="h-4 w-4" aria-hidden />
          </button>
          <Link
            href={`/subcontractor/invoices?ref=${encodeURIComponent(invoice.id)}`}
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label={`View details for ${invoice.reference}`}
            title="View details"
          >
            <FileText className="h-4 w-4" aria-hidden />
          </Link>
          <form onSubmit={deleteInvoice} className="inline hidden sm:block">
            <button
              type="submit"
              className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-300"
              aria-label={`Delete ${invoice.reference}`}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

export function InvoiceListClient({
  items,
  onRemove,
}: {
  items: InvoiceRecord[];
  onRemove?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  function filterItems(input: string): InvoiceRecord[] {
    if (!input.trim()) return items;
    const q = input.toLowerCase();
    return items.filter(
      (i) =>
        i.reference.toLowerCase().includes(q) ||
        (i.subcontractorEmail && i.subcontractorEmail.toLowerCase().includes(q)) ||
        i.id.toLowerCase().includes(q),
    );
  }

  const filtered = filterItems(query);

  const totalAmount = filtered.reduce(
    (sum, row) => sum + (row.amountAudIncGst ?? 0),
    0,
  );

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-white">Your submissions</h2>
        <input
          type="search"
          placeholder="Search by reference, email or invoice ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full shrink-0 max-w-md rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>

      <div className="max-h-[50vh] overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex min-h-[100px] items-center justify-center text-sm text-slate-500 p-6">
            No invoices found.
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur supports-[backdrop-filter]:bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Attachment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((row) => (
                <InvoiceRow
                  key={row.id}
                  invoice={row}
                  onDelete={onRemove}
                />
              ))}
            </tbody>
            <tfoot className="bg-white/5">
              <tr>
                <td className="px-4 py-3 text-slate-500 font-medium">
                  Total submissions
                </td>
                <td className="px-4 py-3 font-semibold text-brand/90">
                  {totalAmount > 0
                    ? `${totalAmount.toLocaleString("en-AU", { minimumFractionDigits: 2 })} AUD`
                    : "—"}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
