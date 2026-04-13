import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { SetupWizardClient } from "@/components/setup/SetupWizardClient";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/setup");
  if (!hasPermission(session.permissions, "users_manage") && session.role !== "admin") {
    redirect("/");
  }
  return <SetupWizardClient />;
}

