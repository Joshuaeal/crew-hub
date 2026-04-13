"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  FolderArchive,
  Server,
  Upload,
  Users,
  Box,
  Receipt,
  FileText,
  FileCheck,
} from "lucide-react";

type AdminLink = {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
};

export function AdminPanelClient() {
  // Legacy client-side admin panel. The server-rendered `/admin` page is the primary entrypoint.
  // Keep this component buildable even if it isn't currently mounted.
  const perms: string[] = [];

  const isAdmin = perms.includes("*");
  const canUsers = perms.includes("users_manage");
  const canShifts = perms.includes("shifts_manage");
  const canBilling = perms.includes("billing");
  const canHr = perms.includes("hr") || perms.includes("hr_manage");
  const canSynapse = perms.includes("embed_synapse");
  const canInventory =
    perms.includes("inventory") || perms.includes("inventory_request");

  const visible = isAdmin;

  const links: AdminLink[] = [];

  if (canHr) {
    links.push({
      href: "/admin/hr-document-storage",
      label: "HR document storage",
      description:
        "Local disk path for WWCC, police checks, and qualifications.",
      icon: FolderArchive,
    });
  }

  if (canUsers) {
    links.push({
      href: "/admin/users",
      label: "Users & permissions",
      description:
        "Create accounts, roles, and granular access to billing and inventory.",
      icon: Users,
    });
  }

  if (canInventory) {
    links.push({
      href: "/inventory/requests",
      label: "Stock approvals",
      description: "Approve or reject inventory checkout requests.",
      icon: Box,
    });
  }

  if (canInventory) {
    links.push({
      href: "/inventory/import",
      label: "Import inventory",
      description: "Bulk load or update items from a CSV file.",
      icon: Upload,
    });
  }

  if (canShifts) {
    links.push({
      href: "/shifts/manage",
      label: "Manage shifts",
      description: "Create shifts and review claims.",
      icon: ClipboardList,
    });
  }

  if (canBilling) {
    links.push({
      href: "/billing/settings",
      label: "Billing workspace",
      description: "Default terms, sender email, and global invoice CSS.",
      icon: Receipt,
    });
  }

  if (canBilling) {
    links.push({
      href: "/billing",
      label: "Billing documents",
      description: "Invoices, quotes, clients, and line-item library.",
      icon: FileText,
    });
  }

  if (canBilling) {
    links.push({
      href: "/billing/payables",
      label: "Payables",
      description: "Bills and expenses to approve and pay out.",
      icon: FileCheck,
    });
  }

  if (canHr) {
    links.push({
      href: "/hr",
      label: "HR directory",
      description: "People directory, leave requests, and approvals.",
      icon: Building2,
    });
  }

  if (canSynapse) {
    links.push({
      href: "/admin/synapse",
      label: "Synapse admin",
      description: "Matrix homeserver admin: users, rooms, and server checks.",
      icon: Server,
    });
  }

  if (!visible) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6 lg:p-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Admin dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
              Channels, Billing, Inventory, and HR in one workspace—structured
              invoices, gear & labour, GST, and a line-item library.
            </p>
          </div>

          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/40 to-transparent p-6">
            <h2 className="font-semibold text-white">Contractors</h2>
            <p className="mt-1 text-sm text-slate-400">
              Use the dedicated dashboard below for invoice intake—separate from
              this admin home.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/subcontractor"
                className="rounded-lg bg-brand/20 px-4 py-2 text-sm font-medium text-brand/95 ring-1 ring-brand/35 hover:bg-brand/30"
              >
                Contractor dashboard
              </Link>
              <Link
                href="/login?next=/subcontractor"
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Contractor sign-in
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Admin
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Approvals, stock, shifts management, billing, HR, and other tools
            you are allowed to use.
          </p>
        </div>

        {links.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Tools
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              {links.length} {links.length === 1 ? "tool" : "tools"} available
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <ArrowRight className="h-5 w-5 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-brand/90" />
                    </div>
                    <h2 className="mt-4 font-semibold text-white">
                      {link.label}
                    </h2>
                    <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">
                      {link.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {links.length === 0 && (
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-slate-400">
              No admin tools available with your current permissions.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/40 to-transparent p-6">
          <h2 className="font-semibold text-white">Contractors</h2>
          <p className="mt-1 text-sm text-slate-400">
            Use the dedicated dashboard below for invoice intake—separate from
            this admin home.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/subcontractor"
              className="rounded-lg bg-brand/20 px-4 py-2 text-sm font-medium text-brand/95 ring-1 ring-brand/35 hover:bg-brand/30"
            >
              Contractor dashboard
            </Link>
            <Link
              href="/login?next=/subcontractor"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
            >
              Contractor sign-in
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
