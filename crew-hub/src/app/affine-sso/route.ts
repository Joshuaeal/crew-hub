/**
 * GET /affine-sso
 *
 * Previously used HMAC-derived credentials to auto-sign-in to AFFiNE in an iframe.
 * Now that AFFiNE accounts use the user's actual Crew Hub password, this route is no
 * longer needed — the AffineEmbed component loads AFFiNE directly and the user logs in
 * once with their Crew Hub email and password.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse("AFFiNE SSO bridge is no longer used.", { status: 410 });
}
