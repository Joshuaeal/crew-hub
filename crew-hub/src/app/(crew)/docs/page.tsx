import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { listAllProjectFiles } from "@/lib/project-files-store";
import { readProjects } from "@/lib/projects-store";
import { readInstanceSettings } from "@/lib/instance-settings-store";
import { DocsClient } from "@/components/DocsClient";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/docs");

  const canView =
    hasPermission(session.permissions, "projects_view") ||
    hasPermission(session.permissions, "projects_manage") ||
    hasPermission(session.permissions, "*");
  if (!canView) redirect("/");

  const [files, projects, settings] = await Promise.all([
    listAllProjectFiles(),
    readProjects(),
    readInstanceSettings().catch(() => null),
  ]);

  const projectMap: Record<string, { name: string; slug: string }> = {};
  for (const p of projects) projectMap[p.id] = { name: p.name, slug: p.slug };

  return (
    <DocsClient
      files={files}
      projectMap={projectMap}
      collaboraUrl={settings?.collaboraUrl}
    />
  );
}
