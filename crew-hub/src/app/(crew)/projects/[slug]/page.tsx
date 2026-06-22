import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { getProjectBySlug } from "@/lib/projects-store";
import { readBillingClients } from "@/lib/billing-clients-store";
import { readUsers } from "@/lib/users-store";
import { readInstanceSettings } from "@/lib/instance-settings-store";
import { ProjectDetailClient } from "@/components/ProjectDetailClient";

type Props = { params: { slug: string } };

export default async function ProjectDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/projects/${params.slug}`);

  const perms = session.permissions;
  const canView =
    hasPermission(perms, "projects_view") ||
    hasPermission(perms, "projects_manage") ||
    hasPermission(perms, "*");
  if (!canView) redirect("/");

  const canManage =
    hasPermission(perms, "projects_manage") || hasPermission(perms, "*");

  const project = await getProjectBySlug(params.slug);
  if (!project) notFound();

  const [clients, users, settings] = await Promise.all([
    readBillingClients(),
    readUsers(),
    readInstanceSettings().catch(() => null),
  ]);

  const clientNames: Record<string, string> = {};
  const clientList: { id: string; name: string }[] = [];
  for (const c of clients) {
    const name = c.company?.trim() || c.name;
    clientNames[c.id] = name;
    clientList.push({ id: c.id, name });
  }

  const userList = users.map((u) => ({ id: u.id, email: u.email, displayName: u.displayName }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Projects
        </Link>
      </div>
      <ProjectDetailClient
        initialProject={project}
        slug={params.slug}
        canManage={canManage}
        clientNames={clientNames}
        clientList={clientList}
        userList={userList}
        affineUrl={settings?.affineUrl}
        currentUserId={session.userId}
      />
    </div>
  );
}
