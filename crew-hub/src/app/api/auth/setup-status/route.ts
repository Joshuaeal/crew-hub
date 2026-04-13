import { NextResponse } from "next/server";
import { readUsers } from "@/lib/users-store";

export const dynamic = "force-dynamic";

/** True when there are no users yet — show first-account UI on /login. */
export async function GET() {
  const users = await readUsers();
  return NextResponse.json({ needsSetup: users.length === 0 });
}
