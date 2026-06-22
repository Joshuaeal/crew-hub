import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { readProjects } from "@/lib/projects-store";
import { readBillingClients } from "@/lib/billing-clients-store";
import { TimelinePageClient } from "@/components/TimelinePageClient";

export default async function ProjectTimelinePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/projects/timeline");

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
    <TimelinePageClient
      projects={projects}
      canManage={canManage}
      clientNames={clientNames}
    />
  );
}
