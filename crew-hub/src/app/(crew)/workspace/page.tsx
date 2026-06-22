import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { readInstanceSettings } from "@/lib/instance-settings-store";
import { AffineEmbed } from "@/components/AffineEmbed";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/workspace");
  if (!hasPermission(session.permissions, "affine_workspace")) redirect("/");

  const settings = await readInstanceSettings();
  return <AffineEmbed affineUrl={settings.affineUrl} title="Workspace" />;
}
