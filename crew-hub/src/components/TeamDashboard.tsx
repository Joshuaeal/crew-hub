import Link from "next/link";
import { ArrowRight, Building2, Boxes, FileText, MessageSquare, Video } from "lucide-react";

type Props = {
  canAccessHr: boolean;
  canAccessChannels: boolean;
  canAccessProductionVideo: boolean;
  canAccessInventory: boolean;
  /** When false, show tile but disable access. */
  canSubmitInvoice: boolean;
};

export function TeamDashboard({
  canAccessHr,
  canAccessChannels,
  canAccessProductionVideo,
  canAccessInventory,
  canSubmitInvoice,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-10 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Team workspace—channels, HR, inventory, and contractor invoicing.
          </p>
        </div>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Native (team)</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {canAccessHr && (
              <Link
                href="/hr"
                className="group flex flex-col rounded-2xl border border-brand/25 bg-brand-maroon/20 p-5 transition hover:border-brand/40 hover:bg-brand-maroon/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand/70 ring-1 ring-brand/30">
                    <Building2 className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-xs text-emerald-400/90">Native</span>
                </div>
                <h3 className="mt-3 font-semibold text-white">HR</h3>
                <p className="mt-1 flex-1 text-sm text-slate-400">Profile, documents, and leave requests.</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand/80 group-hover:text-brand/70">
                  Open HR
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            )}

            {canAccessChannels && (
              <Link
                href="/comms"
                className="group flex flex-col rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-5 transition hover:border-emerald-500/40 hover:bg-emerald-950/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30">
                    <MessageSquare className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-xs text-emerald-400/90">Element</span>
                </div>
                <h3 className="mt-3 font-semibold text-white">Channels</h3>
                <p className="mt-1 flex-1 text-sm text-slate-400">Element embed via Crew Hub proxy.</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-300 group-hover:text-emerald-200">
                  Open Channels
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            )}

            {canAccessProductionVideo && (
              <Link
                href="/comms/vdo"
                className="group flex flex-col rounded-2xl border border-cyan-500/25 bg-cyan-950/15 p-5 transition hover:border-cyan-500/40 hover:bg-cyan-950/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30">
                    <Video className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-xs text-cyan-300/90">VDO.Ninja</span>
                </div>
                <h3 className="mt-3 font-semibold text-white">Production video</h3>
                <p className="mt-1 flex-1 text-sm text-slate-400">Join/director links per channel alias.</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 group-hover:text-cyan-200">
                  Open Production video
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            )}

            {canSubmitInvoice ? (
              <Link
                href="/subcontractor/invoices"
                className="group flex flex-col rounded-2xl border border-rose-500/25 bg-rose-950/15 p-5 transition hover:border-rose-500/40 hover:bg-rose-950/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30">
                    <FileText className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-xs text-rose-200/90">Contractors</span>
                </div>
                <h3 className="mt-3 font-semibold text-white">Submit an invoice</h3>
                <p className="mt-1 flex-1 text-sm text-slate-400">Upload and track subcontractor invoices.</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-rose-200 group-hover:text-rose-100">
                  Submit an invoice
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ) : (
              <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 opacity-70">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-500 ring-1 ring-white/10">
                    <FileText className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-xs text-slate-500">Contractors</span>
                </div>
                <h3 className="mt-3 font-semibold text-slate-200">Submit an invoice</h3>
                <p className="mt-1 flex-1 text-sm text-slate-600">
                  Ask an admin to enable subcontractor invoice access for your account.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500">
                  Not enabled
                </span>
              </div>
            )}

            {canAccessInventory && (
              <Link
                href="/inventory"
                className="group flex flex-col rounded-2xl border border-violet-500/25 bg-violet-950/15 p-5 transition hover:border-violet-500/40 hover:bg-violet-950/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30">
                    <Boxes className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-xs text-violet-300/90">Stock</span>
                </div>
                <h3 className="mt-3 font-semibold text-white">Inventory</h3>
                <p className="mt-1 flex-1 text-sm text-slate-400">Requests, items, and job checkouts.</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-300 group-hover:text-violet-200">
                  Open Inventory
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

