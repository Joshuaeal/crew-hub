import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import type { CrewRole } from "@/types/crew-role";
import { canAccessHr, canManageHrLeave, hasPermission } from "@/types/permissions";

export async function requireRoles(roles: CrewRole[]) {
  const session = await getSession();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!roles.includes(session.role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}

export async function requirePermission(key: string) {
  const session = await getSession();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!hasPermission(session.permissions, key)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}

export async function requireAnyPermission(keys: string[]) {
  const session = await getSession();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const ok = keys.some((k) => hasPermission(session.permissions, k));
  if (!ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}

export async function requireHrAccess() {
  const session = await getSession();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canAccessHr(session.permissions)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}

export async function requireHrLeaveApproval() {
  const session = await getSession();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canManageHrLeave(session.permissions)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}
