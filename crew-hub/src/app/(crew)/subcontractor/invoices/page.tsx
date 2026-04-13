import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listInvoicesForEmail } from "@/lib/invoices-store";
import { InvoiceWorkspace } from "@/components/InvoiceWorkspace";
import { hasPermission } from "@/types/permissions";

export default async function InvoicesPage() {
  const session = await getSession();
  if (!session?.email || !hasPermission(session.permissions, "invoices_subcontractor")) {
    redirect("/login?next=/subcontractor/invoices");
  }

  const initialItems = await listInvoicesForEmail(session.email);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <InvoiceWorkspace initialItems={initialItems} />
      </div>
    </div>
  );
}
