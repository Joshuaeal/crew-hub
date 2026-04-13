import { NextResponse } from "next/server";
import { requireHrAccess } from "@/lib/api-auth";
import { getHrProfile, saveHrProfile } from "@/lib/hr-profile-store";
import type { EmergencyContact } from "@/types/hr-profile";

function normalizeContacts(raw: unknown): EmergencyContact[] | null {
  if (!Array.isArray(raw)) return null;
  const out: EmergencyContact[] = [];
  for (const x of raw.slice(0, 6)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    out.push({
      name: typeof o.name === "string" ? o.name.trim().slice(0, 120) : "",
      relationship: typeof o.relationship === "string" ? o.relationship.trim().slice(0, 80) : "",
      phone: typeof o.phone === "string" ? o.phone.trim().slice(0, 40) : "",
    });
  }
  return out;
}

export async function GET() {
  const gate = await requireHrAccess();
  if (!gate.ok) return gate.response;

  const profile = await getHrProfile(gate.session.userId);
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const gate = await requireHrAccess();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : undefined);

  const legalName = str("legalName");
  const dateOfBirth = str("dateOfBirth");
  const abn = str("abn");
  const phone = str("phone");
  const addressLine1 = str("addressLine1");
  const addressSuburb = str("addressSuburb");
  const addressState = str("addressState");
  const addressPostcode = str("addressPostcode");

  if (dateOfBirth !== undefined && dateOfBirth !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return NextResponse.json({ error: "Date of birth must be YYYY-MM-DD or empty" }, { status: 400 });
    }
  }

  const patch: Parameters<typeof saveHrProfile>[1] = {};
  if (legalName !== undefined) patch.legalName = legalName.slice(0, 200);
  if (dateOfBirth !== undefined) patch.dateOfBirth = dateOfBirth;
  if (abn !== undefined) patch.abn = abn.replace(/\s+/g, "").slice(0, 20);
  if (phone !== undefined) patch.phone = phone.slice(0, 40);
  if (addressLine1 !== undefined) patch.addressLine1 = addressLine1.slice(0, 200);
  if (addressSuburb !== undefined) patch.addressSuburb = addressSuburb.slice(0, 120);
  if (addressState !== undefined) patch.addressState = addressState.slice(0, 40);
  if (addressPostcode !== undefined) patch.addressPostcode = addressPostcode.slice(0, 20);
  if (body.emergencyContacts !== undefined) {
    const contacts = normalizeContacts(body.emergencyContacts);
    if (contacts === null) {
      return NextResponse.json({ error: "Invalid emergencyContacts" }, { status: 400 });
    }
    patch.emergencyContacts = contacts;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const profile = await saveHrProfile(gate.session.userId, patch);
    return NextResponse.json({ profile });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
