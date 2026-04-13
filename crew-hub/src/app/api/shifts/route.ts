import { NextResponse } from "next/server";
import { requireAnyPermission, requirePermission } from "@/lib/api-auth";
import { createShift, readShifts } from "@/lib/shift-store";

export async function GET() {
  const gate = await requireAnyPermission(["shifts_view", "shifts_manage", "shifts_claim"]);
  if (!gate.ok) return gate.response;

  const all = await readShifts();
  return NextResponse.json({ shifts: all });
}

export async function POST(request: Request) {
  const gate = await requirePermission("shifts_manage");
  if (!gate.ok) return gate.response;

  let body: {
    title?: string;
    description?: string;
    startAt?: string;
    endAt?: string;
    crewing?: string;
    slotsTotal?: unknown;
    assignedEmails?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const description = typeof body.description === "string" ? body.description : undefined;
  const startAt = typeof body.startAt === "string" ? body.startAt : "";
  const endAt = typeof body.endAt === "string" ? body.endAt : "";
  const crewingRaw = typeof body.crewing === "string" ? body.crewing : "open";
  const crewing = crewingRaw === "assigned" ? "assigned" : "open";

  if (!title.trim() || !startAt || !endAt) {
    return NextResponse.json(
      { error: "title, startAt, and endAt are required" },
      { status: 400 }
    );
  }

  let slotsTotal: number | undefined;
  if (typeof body.slotsTotal === "number" && Number.isFinite(body.slotsTotal)) {
    slotsTotal = Math.floor(body.slotsTotal);
  } else if (typeof body.slotsTotal === "string" && body.slotsTotal.trim() !== "") {
    slotsTotal = parseInt(body.slotsTotal, 10);
  }

  let assignedEmails: string[] | undefined;
  if (Array.isArray(body.assignedEmails)) {
    assignedEmails = body.assignedEmails.filter((x): x is string => typeof x === "string");
  }

  try {
    const shift = await createShift({
      title,
      description,
      startAt,
      endAt,
      postedBy: gate.session.email,
      crewing,
      slotsTotal: crewing === "open" ? slotsTotal : undefined,
      assignedEmails: crewing === "assigned" ? assignedEmails : undefined,
    });
    return NextResponse.json({ shift });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
