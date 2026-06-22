import Link from "next/link";
import { BarChart2, CalendarRange, LayoutTemplate, Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { readProjects } from "@/lib/projects-store";
import { redirect } from "next/navigation";

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/projects");

  const perms = session.permissions;
  const canView =
    hasPermission(perms, "projects_view") ||
    hasPermission(perms, "projects_manage") ||
    hasPermission(perms, "*");
  if (!canView) redirect("/");

  const canManage =
    hasPermission(perms, "projects_manage") || hasPermission(perms, "*");

  const projects = await readProjects();
  const activeCount = projects.filter((p) => p.status === "In Progress" || p.status === "Confirmed").length;
  const totalCount = projects.length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/" className="text-sm text-brand/90 hover:text-brand/80">
            ← Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Projects
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Productions, hires, and engagements — files, talent, pricing, and milestones in one place.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          <li>
            <Link
              href="/projects/list"
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                <BarChart2 className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold text-white">All projects</h2>
              <p className="mt-1 text-sm text-slate-500">
                {totalCount === 0
                  ? "No projects yet."
                  : `${activeCount} active · ${totalCount} total`}
              </p>
            </Link>
          </li>

          <li>
            <Link
              href="/projects/timeline"
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                <CalendarRange className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold text-white">Timeline</h2>
              <p className="mt-1 text-sm text-slate-500">
                Gantt view across all projects and milestones.
              </p>
            </Link>
          </li>

          {canManage && (
            <>
              <li>
                <Link
                  href="/projects/templates"
                  className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                    <LayoutTemplate className="h-5 w-5" aria-hidden />
                  </span>
                  <h2 className="mt-4 font-semibold text-white">Templates</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Reusable starting points with default milestones.
                  </p>
                </Link>
              </li>

              <li>
                <Link
                  href="/projects/new"
                  className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand/30 hover:bg-white/[0.06]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand/70 ring-1 ring-brand/25">
                    <Plus className="h-5 w-5" aria-hidden />
                  </span>
                  <h2 className="mt-4 font-semibold text-white">New project</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Start a production, hire, or engagement from scratch or a template.
                  </p>
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
