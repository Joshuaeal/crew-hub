import { notFound } from "next/navigation";
import { BillingInvoiceEditor } from "@/components/BillingInvoiceEditor";
import { getBillingInvoice } from "@/lib/billing-store";

type PageProps = { params: { id: string } };

export default async function BillingDetailPage({ params }: PageProps) {
  const inv = await getBillingInvoice(params.id);
  if (!inv) notFound();

  const label = inv.kind === "quote" ? "Quote" : "Invoice";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {label} {inv.number}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Created by {inv.createdByEmail}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <BillingInvoiceEditor mode="edit" initial={inv} />
        </div>
      </div>
    </div>
  );
}
