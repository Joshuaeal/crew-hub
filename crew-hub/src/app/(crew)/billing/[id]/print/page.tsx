import { notFound } from "next/navigation";
import { billingDocumentFullHtml } from "@/lib/billing-render";
import { getBillingInvoice } from "@/lib/billing-store";
import { readBillingSettings } from "@/lib/billing-settings-store";
import { readInstanceSettings } from "@/lib/instance-settings-store";

type PageProps = { params: { id: string } };

export default async function BillingPrintPage({ params }: PageProps) {
  const doc = await getBillingInvoice(params.id);
  if (!doc) notFound();
  const settings = await readBillingSettings();
  const instance = await readInstanceSettings();
  const publicBase =
    process.env.NEXT_PUBLIC_CREW_PUBLIC_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "";
  const baseUrl = publicBase
    ? publicBase.startsWith("http")
      ? publicBase
      : `https://${publicBase}`
    : "";

  const html = billingDocumentFullHtml(doc, settings, baseUrl, instance);

  return (
    <div className="min-h-full bg-white text-slate-900">
      <iframe title="Print" className="h-[calc(100dvh-0px)] w-full border-0" srcDoc={html} />
    </div>
  );
}
