import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarDays, UserCircle, Users } from "lucide-react";
import { getSession } from "@/lib/session";
import { canAccessHr, hasPermission } from "@/types/permissions";

export default async function HrHomePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/hr");
  if (!canAccessHr(session.permissions)) redirect("/");

  const canViewDirectory =
    hasPermission(session.permissions, "hr_manage") ||
    hasPermission(session.permissions, "users_manage");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/" className="text-sm text-brand/90 hover:text-brand/80">
            ← Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">HR</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            People directory and leave requests—built into Crew Hub (no separate HR container).
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          <li>
            <Link
              href="/hr/profile"
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                <UserCircle className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold text-white">My profile</h2>
              <p className="mt-1 text-sm text-slate-500">
                Name, DOB, ABN, address, emergency contacts, and upload WWCC, police check, and qualifications.
              </p>
            </Link>
          </li>
          <li>
            {canViewDirectory ? (
              <Link
                href="/hr/directory"
                className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                  <Users className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-4 font-semibold text-white">Directory</h2>
                <p className="mt-1 text-sm text-slate-500">Crew accounts, display names, and on-hands billing rates.</p>
              </Link>
            ) : (
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 opacity-70">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-500 ring-1 ring-white/10">
                  <Users className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-4 font-semibold text-slate-300">Directory</h2>
                <p className="mt-1 text-sm text-slate-600">Restricted to HR managers/admins.</p>
              </div>
            )}
          </li>
          <li>
            <Link
              href="/hr/leave"
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                <CalendarDays className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold text-white">Leave</h2>
              <p className="mt-1 text-sm text-slate-500">Submit requests; admins or HR managers approve in one place.</p>
            </Link>
          </li>
        </ul>

        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-500">
          <Building2 className="mb-2 inline h-4 w-4 text-slate-600" aria-hidden />
          <p>
            For time clocks, payroll exports, and advanced policies, connect external tools via your runbook. This
            workspace covers the same day-to-day basics teams used OrangeHRM for alongside Crew.
          </p>
        </div>
      </div>
    </div>
  );
}
