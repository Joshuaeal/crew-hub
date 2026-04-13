import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { deleteMatrixUser, matrixProvisioningEnabled, upsertMatrixUser } from "@/lib/matrix-provision";
import { deleteUser, getUserById, updateUser } from "@/lib/users-store";
import type { CrewRole } from "@/types/crew-role";
import { isCrewRole } from "@/types/crew-role";
import { normalizePermissionList } from "@/types/permissions";

type Ctx = { params: Promise<{ id: string }> };

function publicUser(u: NonNullable<Awaited<ReturnType<typeof getUserById>>>) {
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
  };
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requirePermission("users_manage");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  let body: {
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    permissions?: unknown;
    displayName?: string | null;
    crewHandsRateAudExGst?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateUser>[1] = {};
  if (body.username !== undefined) patch.username = body.username;
  if (body.email !== undefined) patch.email = body.email;
  if (body.password !== undefined) patch.password = body.password;
  if (body.role !== undefined) {
    if (!isCrewRole(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    patch.role = body.role as CrewRole;
  }
  if (body.permissions !== undefined) {
    patch.permissions = normalizePermissionList(body.permissions);
  }
  if (body.displayName !== undefined) {
    if (body.displayName === null || body.displayName === "") patch.displayName = null;
    else if (typeof body.displayName === "string") patch.displayName = body.displayName;
    else return NextResponse.json({ error: "Invalid displayName" }, { status: 400 });
  }
  if (body.crewHandsRateAudExGst !== undefined) {
    if (body.crewHandsRateAudExGst === null) patch.crewHandsRateAudExGst = null;
    else if (typeof body.crewHandsRateAudExGst === "number") patch.crewHandsRateAudExGst = body.crewHandsRateAudExGst;
    else return NextResponse.json({ error: "Invalid crewHandsRateAudExGst" }, { status: 400 });
  }

  try {
    const updated = await updateUser(id, patch);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (
      matrixProvisioningEnabled() &&
      typeof body.password === "string" &&
      body.password.length > 0
    ) {
      try {
        await upsertMatrixUser({
          localpart: updated.username,
          password: body.password,
          displayName: updated.displayName?.trim() || undefined,
          logoutDevices: true,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({
          user: publicUser(updated),
          matrixSyncFailed: true,
          matrixSyncError: msg,
        });
      }
    }

    return NextResponse.json({ user: publicUser(updated) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const gate = await requirePermission("users_manage");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (gate.session.userId === id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const existing = await getUserById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const ok = await deleteUser(id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (matrixProvisioningEnabled()) {
      void deleteMatrixUser(existing.username).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
