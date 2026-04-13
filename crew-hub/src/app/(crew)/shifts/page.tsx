import Link from "next/link";
import { redirect } from "next/navigation";
import { ShiftsListClient } from "@/components/ShiftsListClient";
import { getSession } from "@/lib/session";
import { canAccessShiftsList, hasPermission } from "@/types/permissions";

export default async function ShiftsPage() {
  const session = await getSession();
  const canView = session && canAccessShiftsList(session.permissions);
  if (!session || !canView) {
    redirect("/login?next=/shifts");
  }

  const canManage = hasPermission(session.permissions, "shifts_manage");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Shifts</h1>
            <p className="mt-1 text-sm text-slate-400">
              Members claim open shifts; an admin approves before the shift is yours.
            </p>
          </div>
          {canManage && (
            <Link
              href="/shifts/manage"
              className="shrink-0 rounded-lg bg-brand/20 px-4 py-2 text-sm font-medium text-brand/95 ring-1 ring-brand/35 hover:bg-brand/30"
            >
              Manage shifts
            </Link>
          )}
        </div>
        <ShiftsListClient email={session.email} />
      </div>
    </div>
  );
}

