import { BillingInvoiceEditor } from "@/components/BillingInvoiceEditor";

type PageProps = {
  searchParams: { kind?: string };
};

export default function NewBillingPage({ searchParams }: PageProps) {
  const defaultKind = searchParams.kind === "quote" ? "quote" : "invoice";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            New {defaultKind === "quote" ? "quote" : "invoice"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Drafts can be sent by email when SMTP is configured. Add clients in the directory first if
            you like.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <BillingInvoiceEditor mode="create" defaultKind={defaultKind} />
        </div>
      </div>
    </div>
  );
}
