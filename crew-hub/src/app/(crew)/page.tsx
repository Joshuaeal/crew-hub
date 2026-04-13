import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { PublicLanding } from "@/components/PublicLanding";
import { TeamDashboard } from "@/components/TeamDashboard";
import { getSession } from "@/lib/session";
import { canAccessHr, hasPermission } from "@/types/permissions";
import { readInstanceSettings } from "@/lib/instance-settings-store";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    return <PublicLanding />;
  }

  if (session.role === "admin") {
    const settings = await readInstanceSettings().catch(() => null);
    if (settings && !settings.setupComplete) {
      redirect("/admin/instance");
    }
  }

  if (session && session.role !== "admin") {
    return (
      <TeamDashboard
        canAccessHr={canAccessHr(session.permissions)}
        canAccessChannels={hasPermission(session.permissions, "comms")}
        canAccessProductionVideo={
          hasPermission(session.permissions, "comms") ||
          hasPermission(session.permissions, "invoices_subcontractor")
        }
        canAccessInventory={
          hasPermission(session.permissions, "inventory") ||
          hasPermission(session.permissions, "inventory_request")
        }
        canSubmitInvoice={hasPermission(session.permissions, "invoices_subcontractor")}
      />
    );
  }

  const canManageUsers = session
    ? hasPermission(session.permissions, "users_manage")
    : false;
  const canOpenAdminPanel = session
    ? hasPermission(session.permissions, "users_manage") ||
      hasPermission(session.permissions, "shifts_manage")
    : false;
  const canAccessProductionVideo = session
    ? hasPermission(session.permissions, "comms") ||
      hasPermission(session.permissions, "invoices_subcontractor")
    : false;

  return (
    <AdminDashboard
      canManageUsers={canManageUsers}
      canOpenAdminPanel={canOpenAdminPanel}
      canAccessProductionVideo={canAccessProductionVideo}
    />
  );
}
