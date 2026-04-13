import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getSession } from "@/lib/session";
import { readInstanceSettings } from "@/lib/instance-settings-store";

/** Session is per-request; never cache the shell as static for all users. */
export const dynamic = "force-dynamic";

export default async function CrewLayout({ children }: { children: React.ReactNode }) {
  const [serverSession, settings] = await Promise.all([
    getSession(),
    readInstanceSettings().catch(() => null),
  ]);
  return (
    <WorkspaceShell
      initialSession={serverSession}
      enabledModules={settings?.enabledModules}
    >
      {children}
    </WorkspaceShell>
  );
}
