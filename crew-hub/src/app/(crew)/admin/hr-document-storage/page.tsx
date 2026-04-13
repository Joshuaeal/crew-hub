import Link from "next/link";
import { redirect } from "next/navigation";
import { getHrDocumentsRootAbs } from "@/lib/hr-profile-store";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";

export default async function HrDocumentStoragePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/admin/hr-document-storage");
  }
  if (!hasPermission(session.permissions, "users_manage")) {
    redirect("/admin");
  }

  const hrDocumentsStoragePath = getHrDocumentsRootAbs();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/admin" className="text-sm text-brand/90 hover:text-brand/80">
            ← Admin
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            HR document storage
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Where compliance uploads live on disk and how to back them up.
          </p>
        </div>

        <section className="rounded-2xl border border-amber-500/25 bg-amber-950/15 p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-slate-300">
            Employee-uploaded WWCC, police checks, and qualifications are stored{" "}
            <strong className="text-slate-200">only on this server&apos;s local disk</strong>, not in third-party cloud
            object storage. Profile metadata lives in{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-slate-300">.data/hr-profiles.json</code>{" "}
            (relative to the app). Back up the whole <code className="rounded bg-black/30 px-1">.data</code> folder with
            your deployment backups.
          </p>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-amber-100/80">Local documents path</p>
          <p className="mt-1 break-all rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-amber-50/95">
            {hrDocumentsStoragePath}
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Crew complete their profile under <span className="text-slate-400">HR → My profile</span>. HR managers can
            download files from the same app when reviewing compliance.
          </p>
        </section>
      </div>
    </div>
  );
}
