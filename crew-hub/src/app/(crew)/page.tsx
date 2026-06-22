import { redirect } from "next/navigation";
import { PublicLanding } from "@/components/PublicLanding";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getSession } from "@/lib/session";
import { readInstanceSettings } from "@/lib/instance-settings-store";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    return <PublicLanding />;
  }

  const settings = await readInstanceSettings().catch(() => null);

  if (session.role === "admin" && settings && !settings.setupComplete) {
    redirect("/admin/instance");
  }

  return <DashboardClient session={session} affineUrl={settings?.affineUrl} />;
}
