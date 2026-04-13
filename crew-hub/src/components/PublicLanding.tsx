import Link from "next/link";
import { ArrowRight, MessageSquare, Video, LogIn, FileText } from "lucide-react";

export function PublicLanding() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-10 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Crew Hub</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Public tools: channels and production video. Sign in for HR, inventory, and admin tools.
          </p>
        </div>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Available</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              <p className="mt-1 flex-1 text-sm text-slate-400">Open Element (embedded) for Matrix comms.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-300 group-hover:text-emerald-200">
                Open Channels
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>

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
              <p className="mt-1 flex-1 text-sm text-slate-400">
                Live engine + join/director links (room password applied).
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 group-hover:text-cyan-200">
                Open Production video
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h2 className="font-semibold text-white">Sign in</h2>
          <p className="mt-1 text-sm text-slate-400">
            Admins manage users and configuration. Contractors submit invoices.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/login?next=/"
              className="inline-flex items-center gap-2 rounded-lg bg-brand/20 px-4 py-2 text-sm font-medium text-brand/95 ring-1 ring-brand/35 hover:bg-brand/30"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              Admin sign-in
            </Link>
            <Link
              href="/subcontractor/login"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
            >
              <FileText className="h-4 w-4" aria-hidden />
              Contractor sign-in
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

