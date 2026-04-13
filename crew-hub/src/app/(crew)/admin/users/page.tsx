import Link from "next/link";
import { redirect } from "next/navigation";
import { UsersAdminClient } from "@/components/UsersAdminClient";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "users_manage")) {
    redirect("/login?next=/admin/users");
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/admin" className="text-sm text-brand/90 hover:text-brand/80">
            ← Admin
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Users & permissions</h1>
          <p className="mt-1 text-sm text-slate-400">
            Create accounts and choose what each person can open (billing, embeds, shifts, inventory,
            etc.).
          </p>
        </div>
        <UsersAdminClient />
      </div>
    </div>
  );
}
