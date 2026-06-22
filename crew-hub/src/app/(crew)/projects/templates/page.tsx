import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { readProjectTemplates } from "@/lib/project-templates-store";
import { ProjectTemplatesClient } from "@/components/ProjectTemplatesClient";

export default async function ProjectTemplatesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/projects/templates");

  const perms = session.permissions;
  const canManage =
    hasPermission(perms, "projects_manage") || hasPermission(perms, "*");
  if (!canManage) redirect("/projects");

  const templates = await readProjectTemplates();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Projects
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">Project templates</h1>
          <p className="mt-1 text-sm text-slate-400">
            Reusable starting points with default milestones. When a project is created from a template,
            milestones are computed from each milestone&apos;s day offset relative to the project start date.
          </p>
        </div>

        <ProjectTemplatesClient initialTemplates={templates} />
      </div>
    </div>
  );
}
