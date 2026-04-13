import { redirect } from "next/navigation";
import { HrLeaveClient } from "@/components/HrLeaveClient";
import { getSession } from "@/lib/session";
import { canAccessHr } from "@/types/permissions";

export default async function HrLeavePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/hr/leave");
  if (!canAccessHr(session.permissions)) redirect("/");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Leave requests</h1>
          <p className="mt-1 text-sm text-slate-400">Submit leave and track approvals.</p>
        </div>
        <HrLeaveClient />
      </div>
    </div>
  );
}
