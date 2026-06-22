import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDashboardLayout, saveDashboardLayout } from "@/lib/dashboard-store";
import { DEFAULT_WIDGETS } from "@/lib/widget-registry";
import type { WidgetInstance } from "@/types/dashboard";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const layout = await getDashboardLayout(session.userId);
  if (!layout) {
    return NextResponse.json({ widgets: DEFAULT_WIDGETS, isDefault: true });
  }
  return NextResponse.json({ widgets: layout.widgets, isDefault: false });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { widgets?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.widgets)) {
    return NextResponse.json({ error: "widgets must be an array" }, { status: 400 });
  }

  const layout = await saveDashboardLayout(
    session.userId,
    body.widgets as WidgetInstance[],
  );
  return NextResponse.json({ widgets: layout.widgets });
}
