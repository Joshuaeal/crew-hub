import Link from "next/link";
import { ArrowRight, FileText, LogIn, BookOpen } from "lucide-react";
import type { CrewSession } from "@/lib/session";

type Props = {
  session: CrewSession | null;
};

export function ContractorDashboard({ session }: Props) {
  const signedIn = Boolean(session);
  const isSubcontractor = session?.role === "subcontractor";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-10 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Contractor dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Submit and track <strong className="text-slate-300">invoices</strong> for your work—this area is separate
            from the crew admin workspace.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/subcontractor/invoices"
            className="group flex flex-col rounded-2xl border border-brand/25 bg-brand-maroon/25 p-6 transition hover:border-brand/45 hover:bg-brand-maroon/35"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand/70 ring-1 ring-brand/30">
                <FileText className="h-6 w-6" aria-hidden />
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-brand/80">Primary</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Submit invoice</h2>
            <p className="mt-2 flex-1 text-sm text-slate-400">
              Upload, label, and manage invoices tied to your subcontractor account.
            </p>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand/70 group-hover:text-brand/95">
              Submit invoice
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>

          {!signedIn && (
            <Link
              href="/login?next=/subcontractor"
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-brand/25 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-slate-200 ring-1 ring-white/15">
                  <LogIn className="h-6 w-6" aria-hidden />
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Access</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">Sign in</h2>
              <p className="mt-2 flex-1 text-sm text-slate-400">
                Use the email and password issued by your crew admin. You will return here after signing in.
              </p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand/90 group-hover:text-brand/80">
                Contractor sign-in
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          )}

          {signedIn && isSubcontractor && (
            <Link
              href="/onboard"
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-slate-200 ring-1 ring-white/15">
                  <BookOpen className="h-6 w-6" aria-hidden />
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Help</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">Deployment guides</h2>
              <p className="mt-2 flex-1 text-sm text-slate-400">
                Optional reading if your crew shares Matrix, billing, or other service notes.
              </p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-slate-300 group-hover:text-white">
                View guides
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          )}
        </div>

        {!signedIn && (
          <p className="text-center text-sm text-slate-600">
            Crew admins use the{" "}
            <Link href="/" className="text-brand/90 hover:underline">
              admin dashboard
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
