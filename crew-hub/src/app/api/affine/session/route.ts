/**
 * GET /api/affine/session
 *
 * Previously returned HMAC-derived credentials for auto-login. Now that AFFiNE accounts
 * use the user's actual Crew Hub password (set at login/creation time), auto-SSO is not
 * possible without storing the plaintext. The iframe instead shows AFFiNE's own login form,
 * and users authenticate with their Crew Hub email and password (one-time per browser).
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/types/permissions";
import { readInstanceSettings } from "@/lib/instance-settings-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!hasPermission(session.permissions, "affine_workspace")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const settings = await readInstanceSettings();
  if (!settings.affineUrl) {
    return NextResponse.json({ error: "AFFiNE URL not configured" }, { status: 503 });
  }

  return NextResponse.json({ bridgeDisabled: true, affineUrl: settings.affineUrl });
}
