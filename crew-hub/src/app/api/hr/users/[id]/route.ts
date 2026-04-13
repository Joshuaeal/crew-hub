import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { updateUser } from "@/lib/users-store";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Update HR-visible profile fields (display name, crew on-hands rate).
 * Allowed for hr_manage or users_manage.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["hr_manage", "users_manage"]);
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  let body: { displayName?: unknown; crewHandsRateAudExGst?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateUser>[1] = {};
  if (body.displayName !== undefined) {
    if (body.displayName === null || body.displayName === "") {
      patch.displayName = null;
    } else if (typeof body.displayName === "string") {
      patch.displayName = body.displayName;
    } else {
      return NextResponse.json({ error: "Invalid displayName" }, { status: 400 });
    }
  }
  if (body.crewHandsRateAudExGst !== undefined) {
    if (body.crewHandsRateAudExGst === null) {
      patch.crewHandsRateAudExGst = null;
    } else if (typeof body.crewHandsRateAudExGst === "number") {
      patch.crewHandsRateAudExGst = body.crewHandsRateAudExGst;
    } else {
      return NextResponse.json({ error: "Invalid crewHandsRateAudExGst" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  try {
    const updated = await updateUser(id, patch);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        displayName: updated.displayName ?? "",
        crewHandsRateAudExGst: updated.crewHandsRateAudExGst ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
