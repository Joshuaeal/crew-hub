import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Building2,
  MessageSquare,
  Receipt,
  Video,
} from "lucide-react";

type Props = {
  canManageUsers: boolean;
  canOpenAdminPanel: boolean;
  canAccessProductionVideo: boolean;
};

export function AdminDashboard({
  canManageUsers,
  canOpenAdminPanel,
  canAccessProductionVideo,
}: Props) {
  const showAdminSection = canManageUsers || canOpenAdminPanel;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-10 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Admin dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            <strong className="text-slate-300">Channels</strong>,{" "}
            <strong className="text-slate-300">Billing</strong>,{" "}
            <strong className="text-slate-300">Inventory</strong>, and{" "}
            <strong className="text-slate-300">HR</strong> in one
            workspace—structured invoices, gear &amp; labour, GST, and a
            line-item library.
          </p>
        </div>

        {showAdminSection && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Administration
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Team accounts and hub-wide tools.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {canOpenAdminPanel && (
                <Link
                  href="/admin"
                  className="group flex flex-col rounded-2xl border border-brand/25 bg-brand-maroon/20 p-5 transition hover:border-brand/40 hover:bg-brand-maroon/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand/70 ring-1 ring-brand/30">
                      <Building2 className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-xs text-brand/80">Shortcuts</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-white">Admin panel</h3>
                  <p className="mt-1 flex-1 text-sm text-slate-400">
                    Approvals, stock, shifts management, and other tools you are
                    allowed to use.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand/80 group-hover:text-brand/70">
                    Open panel
                    <ArrowRight
                      className="h-4 w-4 transition group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Native (team)
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <p className="mt-1 flex-1 text-sm text-slate-400">
                Crew directory and leave requests—permissions and backups in the
                deployment guide.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand/80 group-hover:text-brand/70">
                Open HR
                <ArrowRight
                  className="h-4 w-4 transition group-hover:translate-x.5"
                  aria-hidden
                />
              </span>
            </Link>
            <Link
              href="/comms"
              className="group flex flex-col rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-5 transition hover:border-emerald-500/40 hover:bg-emerald-950/25"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30">
                  <MessageSquare className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-xs text-emerald-400/90">Matrix SDK</span>
              </div>
              <h3 className="mt-3 font-semibold text-white">Channels</h3>
              <p className="mt-1 flex-1 text-sm text-slate-400">
                Matrix rooms and messages in-app—point at your Synapse URL
                (default localhost:8008).
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-300 group-hover:text-emerald-200">
                Open Channels
                <ArrowRight
                  className="h-4 w-4 transition group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
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
                <h3 className="mt-3 font-semibold text-white">
                  Production video
                </h3>
                <p className="mt-1 flex-1 text-sm text-slate-400">
                  Live multi-cam and director links from the channel
                  blueprint—LAN or cloud VDO base URL in env.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 group-hover:text-cyan-200">
                  Open Production video
                  <ArrowRight
                    className="h-4 w-4 transition group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            )}
            <Link
              href="/billing"
              className="group flex flex-col rounded-2xl border border-amber-500/25 bg-amber-950/15 p-5 transition hover:border-amber-500/40 hover:bg-amber-950/25"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30">
                  <Receipt className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-xs text-amber-300/90">Native AR</span>
              </div>
              <h3 className="mt-3 font-semibold text-white">Billing</h3>
              <p className="mt-1 flex-1 text-sm text-slate-400">
                Invoices and quotes, client directory, terms, CSS, follow-ups,
                and SMTP delivery.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-300 group-hover:text-amber-200">
                Open Billing
                <ArrowRight
                  className="h-4 w-4 transition group-hover:translate-x.5"
                  aria-hidden
                />
              </span>
            </Link>
            <Link
              href="/inventory"
              className="group flex flex-col rounded-2xl border border-violet-500/25 bg-violet-950/15 p-5 transition hover:border-violet-500/40 hover:bg-violet-950/25"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30">
                  <Boxes className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-xs text-violet-300/90">Native stock</span>
              </div>
              <h3 className="mt-3 font-semibold text-white">Inventory</h3>
              <p className="mt-1 flex-1 text-sm text-slate-400">
                Quantities, locations, SKUs, and low-stock hints for gear and
                assets.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-300 group-hover:text-violet-200">
                Open Inventory
                <ArrowRight
                  className="h-4 w-4 transition group-hover:translate-x.5"
                  aria-hidden
                />
              </span>
            </Link>
          </div>
        </section>

        {/* Admin-only home: do not show contractor workspace shortcuts here. */}
      </div>
    </div>
  );
}
