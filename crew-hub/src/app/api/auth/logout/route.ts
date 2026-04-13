import { NextResponse } from "next/server";
import { COOKIE_NAME, getSessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", getSessionCookieOptions(request, { maxAge: 0 }));
  return res;
}
