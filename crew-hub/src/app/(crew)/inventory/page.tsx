import Link from "next/link";
import { Plus } from "lucide-react";
import { InventoryListClient } from "@/components/InventoryListClient";
import { readInventoryItems } from "@/lib/inventory-store";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { readProjects } from "@/lib/projects-store";
import { readBillingCatalog } from "@/lib/billing-catalog-store";

export default async function InventoryPage() {
  const [items, allProjects, catalogItems, session] = await Promise.all([
    readInventoryItems(),
    readProjects(),
    readBillingCatalog(),
    getSession(),
  ]);
  const projects = allProjects.map((p) => ({ id: p.id, name: p.name, slug: p.slug }));
  const perms = session?.permissions ?? [];


  const canEdit = session && (hasPermission(perms, "inventory") || hasPermission(perms, "users_manage"));
  const canRequest = session && hasPermission(perms, "inventory_request");
  const canUserAdmin = session && hasPermission(perms, "users_manage");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Inventory</h1>
            <p className="mt-1 text-sm text-slate-400">
              Stock levels in one place. Request checkouts against jobs; an admin approves before quantities drop.
              {canUserAdmin && " Import CSV from the admin-only import page."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canRequest && (
              <>
                <Link
                  href="/inventory/checkout"
                  className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-500/20"
                >
                  Request checkout
                </Link>
                <Link
                  href="/inventory/my-requests"
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                >
                  My requests
                </Link>
              </>
            )}
            <Link
              href="/inventory/jobs"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Jobs
            </Link>
            {canUserAdmin && (
              <>
                <Link
                  href="/inventory/requests"
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20"
                >
                  Approve checkouts
                </Link>
                <Link
                  href="/inventory/import"
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                >
                  Import CSV
                </Link>
              </>
            )}
            {canEdit && (
              <Link
                href="/inventory/new"
                className="inline-flex items-center gap-2 rounded-lg bg-violet-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add item
              </Link>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-500">
            No items yet.
            {canEdit ? " Add parts or import a CSV (admins)." : " Ask an inventory admin to add stock."}
          </p>
        ) : (
          <InventoryListClient items={items} canEdit={Boolean(canEdit)} projects={projects} catalogItems={catalogItems} />
        )}
      </div>
    </div>
  );
}
