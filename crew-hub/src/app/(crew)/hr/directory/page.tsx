import Link from "next/link";
import { redirect } from "next/navigation";
import { HrDirectoryClient } from "@/components/HrDirectoryClient";
import { getSession } from "@/lib/session";
import { readUsers } from "@/lib/users-store";
import { canAccessHr, hasPermission } from "@/types/permissions";

export default async function HrDirectoryPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/hr/directory");
  if (!canAccessHr(session.permissions)) redirect("/");

  const canViewDirectory =
    hasPermission(session.permissions, "hr_manage") ||
    hasPermission(session.permissions, "users_manage");
  if (!canViewDirectory) {
    redirect("/hr/profile");
  }

  const users = await readUsers();
  const initialUsers = users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    displayName: u.displayName?.trim() ?? "",
    crewHandsRateAudExGst: u.crewHandsRateAudExGst ?? null,
    crewHandsDailyRateAudExGst: u.crewHandsDailyRateAudExGst ?? null,
  }));

  const canEdit = canViewDirectory;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/hr" className="text-sm text-brand/90 hover:text-brand/80">
            ← HR
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">Directory</h1>
          <p className="mt-1 text-sm text-slate-400">
            People who can sign in to this hub. Set a display name and crew on-hands rate (AUD per hour, ex GST) for
            billing labour lines.
          </p>
        </div>
        <HrDirectoryClient initialUsers={initialUsers} canEdit={canEdit} />
      </div>
    </div>
  );
}
