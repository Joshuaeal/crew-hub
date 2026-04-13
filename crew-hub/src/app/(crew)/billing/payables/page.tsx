import Link from "next/link";
import { redirect } from "next/navigation";
import { PayablesClient } from "@/components/PayablesClient";
import { readPayables } from "@/lib/payables-store";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";

export default async function BillingPayablesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/billing/payables");
  if (!hasPermission(session.permissions, "billing")) redirect("/");

  const items = await readPayables();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/billing" className="text-sm text-brand/90 hover:text-brand/80">
              ← Billing
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">Payables</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Supplier invoices and other expenses to approve and pay. Totals use <strong className="text-slate-300">paid</strong>{" "}
              dates; outstanding covers draft through approved before payment.
            </p>
          </div>
        </div>

        <PayablesClient initialItems={items} />
      </div>
    </div>
  );
}
