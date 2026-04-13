import Link from "next/link";
import { redirect } from "next/navigation";
import { HrProfileClient } from "@/components/HrProfileClient";
import { getSession } from "@/lib/session";
import { canAccessHr } from "@/types/permissions";

export default async function HrProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/hr/profile");
  if (!canAccessHr(session.permissions)) redirect("/");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/hr" className="text-sm text-brand/90 hover:text-brand/80">
            ← HR
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">My HR profile</h1>
          <p className="mt-1 text-sm text-slate-400">
            Your details and compliance documents for this organisation. Data is kept on the Crew Hub server (not in
            public cloud storage).
          </p>
        </div>
        <HrProfileClient />
      </div>
    </div>
  );
}
