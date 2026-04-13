import Link from "next/link";
import { Plus } from "lucide-react";
import { BillingDocumentsList } from "@/components/BillingDocumentsList";
import { readBillingInvoices } from "@/lib/billing-store";
import { billingDocumentTotal } from "@/types/billing";

export default async function BillingPage() {
  const items = await readBillingInvoices();
  const rows = items.map((inv) => ({
    id: inv.id,
    kind: inv.kind,
    number: inv.number,
    customerName: inv.customerName,
    status: inv.status,
    createdAt: inv.createdAt,
    currency: inv.currency,
    totalIncGst: billingDocumentTotal(inv),
  }));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Billing</h1>
            <p className="mt-1 text-sm text-slate-400">
              Invoices and quotes in AUD with 10% GST (per-line exempt). Clients, line library, email, follow-ups,
              and custom CSS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/billing/clients"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Clients
            </Link>
            <Link
              href="/billing/catalog"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Line library
            </Link>
            <Link
              href="/billing/payables"
              className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20"
            >
              Payables
            </Link>
            <Link
              href="/billing/settings"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Workspace
            </Link>
            <Link
              href="/billing/new?kind=quote"
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20"
            >
              New quote
            </Link>
            <Link
              href="/billing/new"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New invoice
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-500">
            No documents yet. Create an invoice or quote, add clients, and configure workspace defaults.
          </p>
        ) : (
          <BillingDocumentsList items={rows} />
        )}
      </div>
    </div>
  );
}
