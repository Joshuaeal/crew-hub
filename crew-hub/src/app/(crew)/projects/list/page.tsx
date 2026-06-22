import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { readProjects } from "@/lib/projects-store";
import { readBillingClients } from "@/lib/billing-clients-store";
import { ProjectsListClient } from "@/components/ProjectsListClient";
import { redirect } from "next/navigation";

export default async function ProjectsListPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/projects/list");

  const perms = session.permissions;
  const canView =
    hasPermission(perms, "projects_view") ||
    hasPermission(perms, "projects_manage") ||
    hasPermission(perms, "*");
  if (!canView) redirect("/");

  const canManage =
    hasPermission(perms, "projects_manage") || hasPermission(perms, "*");

  const [projects, clients] = await Promise.all([readProjects(), readBillingClients()]);

  const clientNames: Record<string, string> = {};
  for (const c of clients) {
    clientNames[c.id] = c.company?.trim() || c.name;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Projects
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-white">All projects</h1>
          </div>
          {canManage && (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New project
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-500">
            No projects yet.{canManage ? " Create one to get started." : ""}
          </p>
        ) : (
          <ProjectsListClient
            projects={projects}
            canManage={canManage}
            clientNames={clientNames}
          />
        )}
      </div>
    </div>
  );
}
