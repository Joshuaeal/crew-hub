import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { matrixProvisioningEnabled, upsertMatrixUser } from "@/lib/matrix-provision";
import { createUser, deleteUser, readUsers } from "@/lib/users-store";
import type { CrewRole } from "@/types/crew-role";
import { isCrewRole } from "@/types/crew-role";
import { normalizePermissionList } from "@/types/permissions";
import { getMatrixUpstreamUrl } from "@/lib/service-urls";

function publicUser(u: Awaited<ReturnType<typeof readUsers>>[number]) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    permissions: u.permissions,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    displayName: u.displayName ?? "",
    crewHandsRateAudExGst: u.crewHandsRateAudExGst ?? null,
    crewHandsDailyRateAudExGst: u.crewHandsDailyRateAudExGst ?? null,
  };
}

export async function GET() {
  const gate = await requirePermission("users_manage");
  if (!gate.ok) return gate.response;

  const users = await readUsers();
  const upstream = getMatrixUpstreamUrl();
  const serverName =
    process.env.CREW_SYNAPSE_SERVER_NAME?.trim() ||
    process.env.SYNAPSE_SERVER_NAME?.trim() ||
    "";
  const token = process.env.CREW_SYNAPSE_ADMIN_ACCESS_TOKEN?.trim() || "";
  return NextResponse.json({
    users: users.map(publicUser),
    matrixProvisioningEnabled: matrixProvisioningEnabled(),
    matrixProvisioning: {
      upstreamConfigured: Boolean(upstream),
      serverNameConfigured: Boolean(serverName),
      tokenConfigured: Boolean(token),
      tokenPrefix: token ? token.slice(0, 4) : "",
      tokenLength: token.length,
    },
  });
}

export async function POST(request: Request) {
  const gate = await requirePermission("users_manage");
  if (!gate.ok) return gate.response;

  let body: {
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    permissions?: unknown;
    displayName?: string;
    crewHandsRateAudExGst?: number | null;
    crewHandsDailyRateAudExGst?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;

  if (!username || !email || !password) {
    return NextResponse.json(
      { error: "username, email, and password are required" },
      { status: 400 }
    );
  }

  if (!isCrewRole(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    const user = await createUser({
      username,
      email,
      password,
      role: role as CrewRole,
      permissions:
        body.permissions !== undefined
          ? normalizePermissionList(body.permissions)
          : undefined,
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      crewHandsRateAudExGst:
        body.crewHandsRateAudExGst === null || typeof body.crewHandsRateAudExGst === "number"
          ? body.crewHandsRateAudExGst
          : undefined,
      crewHandsDailyRateAudExGst:
        body.crewHandsDailyRateAudExGst === null || typeof body.crewHandsDailyRateAudExGst === "number"
          ? body.crewHandsDailyRateAudExGst
          : undefined,
    });

    if (matrixProvisioningEnabled()) {
      try {
        await upsertMatrixUser({
          localpart: user.username,
          password,
          displayName: typeof body.displayName === "string" ? body.displayName : undefined,
          logoutDevices: false,
        });
      } catch (e) {
        await deleteUser(user.id);
        const msg = e instanceof Error ? e.message : "Matrix provisioning failed";
        return NextResponse.json(
          { error: `Crew user was not created: Synapse / Element sync failed — ${msg}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ user: publicUser(user) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
