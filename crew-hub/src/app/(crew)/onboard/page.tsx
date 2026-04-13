import Link from "next/link";
import { forkServices } from "@/lib/services";
import { ArrowRight } from "lucide-react";

export default function OnboardIndexPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Deployment guides</h1>
          <p className="mt-2 text-sm text-slate-400 sm:text-base">
            Step-by-step onboarding for each fork. URLs configured here power the embedded workspace
            views.
          </p>
        </div>
        <ul className="space-y-3">
          {forkServices.map((s) => (
            <li key={s.id}>
              <Link
                href={`/onboard/${s.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-brand/25 hover:bg-white/[0.05]"
              >
                <div>
                  <p className="font-medium text-white">{s.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{s.tagline}</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
