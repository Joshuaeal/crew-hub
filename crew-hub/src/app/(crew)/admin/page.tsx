import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Boxes,
  Building2,
  ClipboardList,
  FolderArchive,
  Receipt,
  Server,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { canAccessHr, hasPermission } from "@/types/permissions";

export default async function AdminPanelPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/admin");
  }

  const perms = session.permissions;
  const canUsers = hasPermission(perms, "users_manage");
  const canShifts = hasPermission(perms, "shifts_manage");
  const canBilling = hasPermission(perms, "billing");
  const canHr = canAccessHr(perms);
  const canSynapse = hasPermission(perms, "embed_synapse");

  if (!canUsers && !canShifts && !canSynapse && !canBilling) {
    redirect("/");
  }

  type Card = {
    href: string;
    title: string;
    description: string;
    icon: typeof Users;
  };

  const cards: Card[] = [];

  if (canUsers) {
    cards.push({
      href: "/admin/instance",
      title: "Instance settings",
      description: "Branding (logo + palette), email sender defaults, invoice template, and imports.",
      icon: Settings,
    });
    cards.push({
      href: "/admin/hr-document-storage",
      title: "HR document storage",
      description:
        "Local disk path for WWCC, police checks, and qualifications—back up .data with your deployment.",
      icon: FolderArchive,
    });
    cards.push({
      href: "/admin/users",
      title: "Users & permissions",
      description: "Create accounts, roles, and granular access to billing, inventory, shifts, and more.",
      icon: Users,
    });
    cards.push({
      href: "/inventory/requests",
      title: "Stock approvals",
      description: "Approve or reject inventory checkout requests before stock is deducted.",
      icon: Boxes,
    });
    cards.push({
      href: "/inventory/import",
      title: "Import inventory (CSV)",
      description: "Bulk load or update items from a spreadsheet (SKU matching updates existing rows).",
      icon: Upload,
    });
  }

  if (canShifts) {
    cards.push({
      href: "/shifts/manage",
      title: "Manage shifts",
      description: "Create shifts, review claims, and manage the team calendar.",
      icon: ClipboardList,
    });
  }

  if (canHr) {
    cards.push({
      href: "/hr",
      title: "HR",
      description: "People directory, leave requests, and approvals (grant hr / hr_manage in Users).",
      icon: Building2,
    });
  }

  if (canBilling) {
    cards.push({
      href: "/billing/settings",
      title: "Billing workspace",
      description: "Default terms, sender email, follow-up intervals, and global invoice CSS.",
      icon: Settings,
    });
    cards.push({
      href: "/billing",
      title: "Billing documents",
      description: "Invoices, quotes, clients, and line-item library.",
      icon: Receipt,
    });
    cards.push({
      href: "/billing/payables",
      title: "Payables",
      description: "Bills and expenses to approve and pay out—totals by month, quarter, and financial year.",
      icon: Banknote,
    });
  }

  if (canSynapse) {
    cards.push({
      href: "/admin/synapse",
      title: "Synapse Admin",
      description: "Matrix homeserver admin (synapse-admin): users, rooms, and server checks.",
      icon: Server,
    });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/" className="text-sm text-brand/90 hover:text-brand/80">
            ← Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Shortcuts to administration and approval flows. You only see tools your account is allowed to use.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <li key={c.href}>
                <Link
                  href={c.href}
                  className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-brand/90" />
                  </div>
                  <h2 className="mt-4 font-semibold text-white">{c.title}</h2>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">{c.description}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
