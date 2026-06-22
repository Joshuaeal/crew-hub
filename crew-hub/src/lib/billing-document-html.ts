import type { BillingDocument } from "@/types/billing";
import type { BillingSettings } from "@/types/billing";
import {
  activeBillingLines,
  computeBillingTotals,
  packageTotals,
  roundMoney2,
} from "@/types/billing";
import type { InstanceSettings } from "@/types/instance";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAud(n: number): string {
  return `$${n.toFixed(2)} AUD`;
}

export function combinedBillingCss(settings: BillingSettings): string {
  /* Neutral invoice styles; instance palette can override via CSS variables. */
  const base = `
.bill-page {
  font-family: system-ui, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  padding: 10mm;
  background: var(--invoice-base, #f1f5f9);
}

.bill-wrap {
  display: grid;
  grid-template-columns: 56mm 1fr;
  min-height: 277mm;
  border-radius: 6px;
  overflow: hidden;
  background: var(--invoice-base, #ffffff);
  color: var(--invoice-text, #0f172a);
  border: 1px solid rgba(15, 23, 42, 0.10);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.04), 0 26px 54px rgba(2, 6, 23, 0.20);
}

.bill-sidebar {
  position: relative;
  padding: 16px 14px 14px;
  background:
    radial-gradient(120px 120px at 100% 0%, rgba(255,255,255,0.25), rgba(255,255,255,0) 62%),
    linear-gradient(180deg, var(--brand, #5b8cff) 0%, var(--accent, #22c55e) 100%);
  color: rgba(255, 255, 255, 0.92);
}
.bill-sidebar::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(160px 160px at 20% 20%, rgba(255,255,255,0.14), rgba(255,255,255,0) 66%);
  pointer-events: none;
  mix-blend-mode: overlay;
}

.bill-main {
  padding: 18px 20px 18px;
  background: var(--invoice-base, #ffffff);
}

.bill-logo {
  display: block;
  width: 100%;
  height: auto;
  max-height: 120px;
  object-fit: contain;
  margin: 2px 0 12px;
  filter: drop-shadow(0 10px 22px rgba(2, 6, 23, 0.25));
}

.bill-side-mark {
  position: absolute;
  left: 10px;
  bottom: 14px;
  font-weight: 800;
  letter-spacing: 0.32em;
  font-size: 38px;
  line-height: 1;
  opacity: 0.18;
  transform: rotate(-90deg);
  transform-origin: left bottom;
  white-space: nowrap;
  user-select: none;
}

.bill-side-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.88;
}
.bill-side-block {
  margin-top: 14px;
}
.bill-side-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.72;
}
.bill-side-value {
  margin-top: 6px;
  font-size: 0.78rem;
  line-height: 1.4;
  opacity: 0.92;
}

.bill-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.10);
  margin-bottom: 12px;
}
.bill-head-left {
  min-width: 0;
}
.bill-company {
  font-size: 1.15rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--invoice-text, rgba(15, 23, 42, 0.92));
}
.bill-desc {
  margin-top: 4px;
  font-size: 0.82rem;
  color: var(--invoice-text, rgba(51, 65, 85, 0.88));
  opacity: 0.8;
}
.bill-doc-title {
  text-align: right;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--invoice-text, rgba(15, 23, 42, 0.92));
}
.bill-doc-number {
  margin-top: 4px;
  text-align: right;
  font-size: 0.8rem;
  color: var(--invoice-text, rgba(51, 65, 85, 0.86));
  opacity: 0.8;
}

.bill-meta-grid {
  display: grid;
  grid-template-columns: 1fr 170px;
  gap: 14px 18px;
  margin: 12px 0 12px;
}
.bill-meta-card {
  border: 1px solid rgba(128, 128, 128, 0.20);
  border-radius: 10px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--invoice-base, #ffffff) 85%, transparent);
}
.bill-meta-card strong {
  display: block;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--invoice-text, rgba(51, 65, 85, 0.78));
  opacity: 0.7;
}
.bill-meta-card span {
  display: block;
  margin-top: 6px;
  font-size: 0.82rem;
  line-height: 1.35;
  color: var(--invoice-text, rgba(15, 23, 42, 0.88));
}
.bill-sender {
  white-space: pre-wrap;
}

.bill-brief {
  color: var(--invoice-text, rgba(15, 23, 42, 0.82));
  font-size: 0.9rem;
  margin: 4px 0 14px;
  white-space: pre-wrap;
  line-height: 1.55;
}
.bill-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 10px 0 10px;
  font-size: 0.82rem;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid rgba(128, 128, 128, 0.20);
  background: color-mix(in srgb, var(--invoice-base, #ffffff) 90%, transparent);
}
.bill-table th, .bill-table td {
  border-bottom: 1px solid rgba(128, 128, 128, 0.12);
  padding: 9px 10px;
  text-align: left;
  color: var(--invoice-text, inherit);
}
.bill-table th {
  background: color-mix(in srgb, var(--invoice-base, #f1f5f9) 70%, transparent);
  color: var(--invoice-text, rgba(15, 23, 42, 0.82));
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.85;
}
.bill-table tbody tr:last-child td { border-bottom: none; }
.bill-table td:nth-child(2),
.bill-table td:nth-child(3),
.bill-table td:nth-child(4),
.bill-table th:nth-child(2),
.bill-table th:nth-child(3),
.bill-table th:nth-child(4) {
  text-align: right;
}

.bill-totals {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 8px 16px;
  margin-top: 12px;
  align-items: end;
}
.bill-totals .bill-total-box {
  border: 1px solid rgba(128, 128, 128, 0.20);
  border-radius: 10px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--invoice-base, #f8fafc) 80%, transparent);
}
.bill-totals .bill-total-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.85rem;
  color: var(--invoice-text, rgba(15, 23, 42, 0.84));
  margin: 6px 0;
}
.bill-totals .bill-grand {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(128, 128, 128, 0.20);
  font-weight: 800;
  color: var(--invoice-text, rgba(15, 23, 42, 0.94));
}

.bill-terms {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid rgba(128, 128, 128, 0.15);
  font-size: 0.84rem;
  color: var(--invoice-text, rgba(51, 65, 85, 0.92));
  white-space: pre-wrap;
  line-height: 1.55;
}
.bill-terms {
}
.bill-packages {
  display: grid;
  gap: 14px;
  margin: 12px 0;
}
.bill-package-card {
  border: 1px solid rgba(128, 128, 128, 0.22);
  border-radius: 10px;
  overflow: hidden;
  background: color-mix(in srgb, var(--invoice-base, #ffffff) 90%, transparent);
}
.bill-package-header {
  padding: 10px 14px 8px;
  background: color-mix(in srgb, var(--brand, #5b8cff) 12%, transparent);
  border-bottom: 1px solid rgba(128, 128, 128, 0.18);
}
.bill-package-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--invoice-text, rgba(15, 23, 42, 0.92));
  letter-spacing: -0.01em;
}
.bill-package-desc {
  font-size: 0.78rem;
  color: var(--invoice-text, rgba(51, 65, 85, 0.78));
  margin-top: 3px;
}
.bill-package-total {
  padding: 8px 14px;
  background: color-mix(in srgb, var(--invoice-base, #f8fafc) 80%, transparent);
  border-top: 1px solid rgba(128, 128, 128, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--invoice-text, rgba(15, 23, 42, 0.92));
}
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  .bill-page { padding: 0; max-width: none; width: auto; min-height: auto; background: #ffffff; }
  .bill-wrap {
    box-shadow: none;
    border-radius: 0;
    border: none;
  }
}
`;
  return [base, settings.globalInvoiceCss || ""].join("\n");
}

function lineExGst(line: { quantity: number; unitPrice: string }): number {
  const q = Number(line.quantity) || 0;
  const p = parseFloat(line.unitPrice) || 0;
  return roundMoney2(q * p);
}

function renderLineRows(
  lines: BillingDocument["gearLineItems"]
): string {
  return lines
    .map((line) => {
      const ex = lineExGst(line);
      const unit = parseFloat(line.unitPrice) || 0;
      return `<tr><td>${escapeHtml(line.description)}</td><td>${line.quantity}</td><td>${formatAud(
        unit
      )}</td><td>${formatAud(ex)}</td></tr>`;
    })
    .join("");
}

export function billingDocumentInnerHtml(
  doc: BillingDocument,
  settings: BillingSettings,
  publicBaseUrl: string,
  instance?: Pick<InstanceSettings, "invoiceLogoDataUrl" | "companyName" | "palette" | "invoiceSenderBlock">
): string {
  const usePackages = doc.usePackages && doc.kind === "quote" && (doc.packages?.length ?? 0) > 0;
  const lines = usePackages ? [] : activeBillingLines(doc);
  const totals = computeBillingTotals(lines);
  const label = doc.kind === "quote" ? "Quote" : "Tax invoice";
  const terms = (doc.termsText?.trim() || settings.defaultTerms || "").trim();
  const titleLine = (doc.documentTitle?.trim() || doc.number).trim();
  const subtitle = doc.kind === "quote" ? "Quote" : "Invoice";
  const showGear = doc.includeGear !== false;
  const showLabour = doc.includeLabour !== false;
  const gearLines = showGear
    ? doc.gearLineItems?.filter((l) => l.description?.trim()) ?? []
    : [];
  const labourLines = showLabour
    ? doc.labourLineItems?.filter((l) => l.description?.trim()) ?? []
    : [];

  const thead =
    "<thead><tr><th>Item description</th><th>Quantity</th><th>Price</th><th>Amount</th></tr></thead>";

  const gearBlock =
    !usePackages && showGear && gearLines.length > 0
      ? `<table class="bill-table">${thead}<tbody>${renderLineRows(gearLines)}</tbody></table>`
      : "";

  const labourBlock =
    !usePackages && showLabour && labourLines.length > 0
      ? `<table class="bill-table">${thead}<tbody>${renderLineRows(labourLines)}</tbody></table>`
      : "";

  const packagesBlock = usePackages
    ? (() => {
        const pkgs = (doc.packages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
        const cards = pkgs
          .map((pkg) => {
            const pkgTotals = packageTotals(pkg);
            const activeLines = pkg.lineItems.filter((l) => l.description?.trim());
            const rows = activeLines.length > 0
              ? `<table class="bill-table">${thead}<tbody>${renderLineRows(activeLines)}</tbody></table>`
              : "";
            return `<div class="bill-package-card">
  <div class="bill-package-header">
    <div class="bill-package-name">${escapeHtml(pkg.name)}</div>
    ${pkg.description ? `<div class="bill-package-desc">${escapeHtml(pkg.description)}</div>` : ""}
  </div>
  ${rows}
  <div class="bill-package-total">
    <span>Total (inc GST)</span>
    <span>${formatAud(pkgTotals.totalIncGst)}</span>
  </div>
</div>`;
          })
          .join("");
        return `<div class="bill-packages">${cards}</div>`;
      })()
    : "";

  const briefBlock = doc.brief?.trim()
    ? `<div class="bill-brief">${escapeHtml(doc.brief.trim())}</div>`
    : "";

  /** Internal pricing tier — shown on quotes only; hidden on tax invoices sent to customers. */
  const tier = doc.priceTier ?? "mid";
  const tierLabel = tier === "low" ? "Low" : tier === "high" ? "High" : "Medium";
  const tierBlock =
    doc.kind === "quote" && showGear && gearLines.length > 0
      ? `<div class="bill-meta">Gear hire rate tier: ${escapeHtml(tierLabel)}</div>`
      : "";

  const logoSrc = instance?.invoiceLogoDataUrl?.trim() || "";
  const companyName = instance?.companyName?.trim() || "Crew Hub";
  const brand = instance?.palette?.brand?.trim() || "#5b8cff";
  const accent = instance?.palette?.accent?.trim() || "#22c55e";
  const invoiceBase = instance?.palette?.invoiceBase?.trim() || "#0b1220";
  const invoiceText = instance?.palette?.invoiceText?.trim() || "#e2e8f0";
  const sender = (instance?.invoiceSenderBlock || "").trim();
  const senderName = sender.split("\n")[0]?.trim() || "";
  const displayName = senderName || companyName;
  const issueDateIso = (doc.invoiceDate || doc.createdAt || "").trim();
  const issueDate = issueDateIso ? new Date(issueDateIso) : null;
  const issueDateText = issueDate && !Number.isNaN(issueDate.getTime()) ? issueDate.toLocaleString() : "";
  const refNo = (doc.referenceNo || "").trim();
  const headerText = (doc.headerText || "").trim();

  return `
<div class="bill-page" style="--brand: ${escapeHtml(brand)}; --accent: ${escapeHtml(accent)}; --invoice-base: ${escapeHtml(invoiceBase)}; --invoice-text: ${escapeHtml(invoiceText)};">
  <div class="bill-wrap">
    <aside class="bill-sidebar">
      ${logoSrc ? `<img class="bill-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(companyName)}" />` : ""}
      <div class="bill-side-title">${escapeHtml(subtitle)}</div>
      <div class="bill-side-block">
        <div class="bill-side-label">Details</div>
        <div class="bill-side-value">
          <div><strong>${escapeHtml(doc.number)}</strong></div>
        </div>
      </div>
      <div class="bill-side-block">
        <div class="bill-side-label">${escapeHtml(subtitle)} to</div>
        <div class="bill-side-value">${escapeHtml(doc.customerName || "Customer")}${doc.customerEmail ? `<br/>${escapeHtml(doc.customerEmail)}` : ""}</div>
      </div>
      <div class="bill-side-mark">${escapeHtml(subtitle)}</div>
    </aside>
    <main class="bill-main">
      <div class="bill-header">
        <div class="bill-head-left">
          <h1 class="bill-company">${escapeHtml(displayName)}</h1>
          <div class="bill-desc">${escapeHtml(doc.documentTitle?.trim() || "")}</div>
        </div>
        <div>
          <div class="bill-doc-title">${escapeHtml(label)}</div>
          <div class="bill-doc-number">${escapeHtml(titleLine)}</div>
        </div>
      </div>
      <div class="bill-meta-grid">
        <div class="bill-meta-card">
          <strong>From</strong>
          <span class="bill-sender">${sender ? escapeHtml(sender) : escapeHtml(displayName)}</span>
        </div>
        <div class="bill-meta-card">
          <strong>${escapeHtml(subtitle)} no.</strong>
          <span>${escapeHtml(doc.number)}</span>
        </div>
        ${issueDateText ? `<div class="bill-meta-card"><strong>Date</strong><span>${escapeHtml(issueDateText)}</span></div>` : ""}
        ${refNo ? `<div class="bill-meta-card"><strong>Reference</strong><span>${escapeHtml(refNo)}</span></div>` : ""}
      </div>
      ${headerText ? `<div class="bill-brief">${escapeHtml(headerText)}</div>` : ""}
      ${briefBlock}
      ${tierBlock}
      ${gearBlock}
      ${labourBlock}
      ${packagesBlock}
      ${!usePackages ? `<div class="bill-totals">
        <div></div>
        <div class="bill-total-box">
          <div class="bill-total-row"><span>Sub total</span><span>${formatAud(totals.subtotalExGst)}</span></div>
          <div class="bill-total-row"><span>Tax (GST)</span><span>${formatAud(totals.gstAmount)}</span></div>
          <div class="bill-total-row bill-grand"><span>Grand total</span><span>${formatAud(totals.totalIncGst)}</span></div>
        </div>
      </div>` : ""}
      ${doc.notes ? `<div class="bill-terms"><strong>Notes</strong><br/>${escapeHtml(doc.notes)}</div>` : ""}
      ${terms ? `<div class="bill-terms"><strong>Terms</strong><br/>${escapeHtml(terms)}</div>` : ""}
    </main>
  </div>
</div>`;
}

export function billingDocumentFullHtml(
  doc: BillingDocument,
  settings: BillingSettings,
  publicBaseUrl: string,
  instance?: Pick<InstanceSettings, "invoiceLogoDataUrl" | "companyName" | "palette">
): string {
  const css = combinedBillingCss(settings);
  const inner = billingDocumentInnerHtml(doc, settings, publicBaseUrl, instance);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><style>${css}</style></head><body>${inner}</body></html>`;
}

export function billingFollowUpText(
  doc: BillingDocument,
  settings: BillingSettings,
  publicBaseUrl: string
): { subject: string; text: string; html: string } {
  void settings;
  const label = doc.kind === "quote" ? "quote" : "invoice";
  const subject = `Follow-up: ${doc.number} (${doc.customerName})`;
  const link = publicBaseUrl
    ? `${publicBaseUrl.replace(/\/$/, "")}/billing/${doc.id}/print`
    : "";
  const text = `This is an automated follow-up regarding ${doc.number} (${label}) for ${doc.customerName}.
${link ? `\nView: ${link}\n` : ""}
Thank you.`;
  const html = `<p>This is an automated follow-up regarding <strong>${escapeHtml(doc.number)}</strong> (${escapeHtml(label)}) for ${escapeHtml(doc.customerName)}.</p>${
    link ? `<p><a href="${escapeHtml(link)}">View document</a></p>` : ""
  }<p>Thank you.</p>`;
  return { subject, text, html };
}
