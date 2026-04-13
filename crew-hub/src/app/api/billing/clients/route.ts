import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { createBillingClient, readBillingClients } from "@/lib/billing-clients-store";

export async function GET() {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;
  const items = await readBillingClients();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const gate = await requirePermission("billing");
  if (!gate.ok) return gate.response;

  let body: {
    name?: string;
    email?: string;
    company?: string;
    address?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const row = await createBillingClient({
    name,
    email: typeof body.email === "string" ? body.email : undefined,
    company: typeof body.company === "string" ? body.company : undefined,
    address: typeof body.address === "string" ? body.address : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  return NextResponse.json({ item: row });
}
