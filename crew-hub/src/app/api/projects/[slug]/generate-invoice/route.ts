import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { getProjectBySlug } from "@/lib/projects-store";
import { createBillingInvoice } from "@/lib/billing-store";
import { readBillingClients } from "@/lib/billing-clients-store";

type Ctx = { params: { slug: string } };

export async function POST(_req: Request, ctx: Ctx) {
  const gate = await requireAnyPermission(["projects_manage"]);
  if (!gate.ok) return gate.response;

  const project = await getProjectBySlug(ctx.params.slug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (project.lineItems.length === 0) {
    return NextResponse.json({ error: "Project has no line items to invoice" }, { status: 400 });
  }

  let customerName = "Client";
  let customerEmail: string | undefined;

  if (project.clientId) {
    const clients = await readBillingClients();
    const client = clients.find((c) => c.id === project.clientId);
    if (client) {
      customerName = client.company?.trim() || client.name;
      customerEmail = client.email || undefined;
    }
  }

  const gearLineItems = project.lineItems.map((li) => ({
    id: crypto.randomUUID(),
    description: li.description,
    quantity: li.quantity,
    unitPrice: String(li.unitPrice),
    gstExempt: false,
  }));

  const talentWithRates = project.talent.filter((t) => t.rate !== undefined);
  const labourLineItems = talentWithRates.map((t) => {
    const name = t.externalName ? ` (${t.externalName})` : "";
    return {
      id: crypto.randomUUID(),
      description: `Labour — ${t.role}${name}`,
      quantity: 1,
      unitPrice: String(t.rate),
      gstExempt: false,
      ...(t.personId ? { hrUserId: t.personId } : {}),
    };
  });

  const invoice = await createBillingInvoice({
    kind: "invoice",
    customerName,
    customerEmail,
    clientId: project.clientId,
    referenceNo: project.name,
    gearLineItems,
    labourLineItems: labourLineItems.length > 0 ? labourLineItems : [],
    includeGear: true,
    includeLabour: labourLineItems.length > 0,
    status: "draft",
    followUpEnabled: false,
    createdByEmail: gate.session.email,
    projectSlug: ctx.params.slug,
  });

  return NextResponse.json({ invoice });
}
