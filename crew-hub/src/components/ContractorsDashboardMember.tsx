import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import type { CrewSession } from "@/lib/session";

type Props = {
  session: CrewSession;
};

export function ContractorsDashboardMember({ session }: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-10 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/" className="text-sm text-brand/90 hover:text-brand/80">
            ← Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Contractors
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Internal contractor tools for members. Signed in as{" "}
            <strong className="text-slate-300">{session.username}</strong>.
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
              <span className="text-xs font-medium uppercase tracking-wide text-brand/80">
                Submit
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Submit invoice</h2>
            <p className="mt-2 flex-1 text-sm text-slate-400">
              Upload and track invoices tied to your account.
            </p>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand/70 group-hover:text-brand/95">
              Open invoice submit
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

