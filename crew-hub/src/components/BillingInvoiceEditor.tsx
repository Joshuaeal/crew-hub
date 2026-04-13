"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BillingCatalogItem,
  BillingClient,
  BillingDocument,
  BillingLineItem,
  BillingStatus,
} from "@/types/billing";
import {
  BILLING_CURRENCY,
  GST_RATE,
  activeBillingLines,
  catalogUnitPriceForTier,
  computeBillingTotals,
  defaultStatusesForKind,
  roundMoney2,
} from "@/types/billing";
import type { PriceTier } from "@/types/billing";
import type { InventoryItem } from "@/types/inventory";
import { billingDocumentFullHtml } from "@/lib/billing-document-html";
import type { BillingSettings } from "@/types/billing";
import type { InstanceSettings } from "@/types/instance";
import { Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";

type Props = {
  mode: "create" | "edit";
  initial?: BillingDocument;
  defaultKind?: "invoice" | "quote";
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputValueToIso(local: string): string | undefined {
  const v = (local || "").trim();
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function newId(): string {
  try {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
    const id = c?.randomUUID?.();
    if (id) return id;
  } catch {
    // ignore
  }
  return `id_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function normalizeLinesForEdit(items: BillingLineItem[] | undefined): BillingLineItem[] {
  if (!items?.length) {
    return [{ id: newId(), description: "", quantity: 1, unitPrice: "0", gstExempt: false }];
  }
  return items.map((l) => ({
    ...l,
    gstExempt: l.gstExempt === true,
    hrUserId: typeof l.hrUserId === "string" ? l.hrUserId : undefined,
  }));
}

type CrewRateRow = {
  id: string;
  username: string;
  label: string;
  crewHandsRateAudExGst: number | null;
};

function lineMatchesCatalogTierPrices(line: BillingLineItem, c: BillingCatalogItem): boolean {
  const p = (line.unitPrice || "0").trim();
  const low = catalogUnitPriceForTier(c, "low").trim();
  const mid = catalogUnitPriceForTier(c, "mid").trim();
  const high = catalogUnitPriceForTier(c, "high").trim();
  return p === low || p === mid || p === high;
}

function inventoryUnitPriceForTier(inv: InventoryItem, tier: PriceTier): string {
  const low = inv.hireLowAud;
  const mid = inv.hireMidAud;
  const high = inv.hireHighAud;
  const midStr =
    mid != null && Number.isFinite(mid)
      ? String(mid)
      : low != null && Number.isFinite(low)
        ? String(low)
        : "0";
  if (tier === "low" && low != null && Number.isFinite(low)) return String(low);
  if (tier === "high" && high != null && Number.isFinite(high)) return String(high);
  return midStr;
}

function lineAmounts(line: BillingLineItem): { exGst: number; gst: number; incGst: number } {
  const q = Number(line.quantity) || 0;
  const p = parseFloat(line.unitPrice) || 0;
  const exGst = roundMoney2(q * p);
  const gst = line.gstExempt ? 0 : roundMoney2(exGst * GST_RATE);
  const incGst = roundMoney2(exGst + gst);
  return { exGst, gst, incGst };
}

function matchesCatalogLine(line: BillingLineItem, catalog: BillingCatalogItem[]): boolean {
  const d = line.description.trim().toLowerCase();
  if (!d) return false;
  return catalog.some(
    (c) =>
      c.name.trim().toLowerCase() === d &&
      lineMatchesCatalogTierPrices(line, c) &&
      c.defaultGstExempt === line.gstExempt
  );
}

function buildPreviewDoc(
  args: {
    kind: "invoice" | "quote";
    number: string;
    customerName: string;
    customerEmail?: string;
    documentTitle?: string;
    brief?: string;
    invoiceDate?: string;
    referenceNo?: string;
    headerText?: string;
    includeGear: boolean;
    includeLabour: boolean;
    priceTier?: PriceTier;
    gearLineItems: BillingLineItem[];
    labourLineItems: BillingLineItem[];
    notes?: string;
    termsText?: string;
    id?: string;
  }
): BillingDocument {
  const now = new Date().toISOString();
  return {
    id: args.id ?? "preview",
    kind: args.kind,
    number: args.number,
    invoiceDate: args.invoiceDate,
    referenceNo: args.referenceNo,
    headerText: args.headerText,
    currency: BILLING_CURRENCY,
    customerName: args.customerName || "Customer",
    customerEmail: args.customerEmail,
    documentTitle: args.documentTitle?.trim() || undefined,
    brief: args.brief?.trim() || undefined,
    includeGear: args.includeGear,
    includeLabour: args.includeLabour,
    gearLineItems: args.gearLineItems,
    labourLineItems: args.labourLineItems,
    status: "draft",
    notes: args.notes?.trim() || undefined,
    termsText: args.termsText?.trim() || undefined,
    followUpEnabled: false,
    followUpStage: 0,
    createdAt: now,
    updatedAt: now,
    createdByEmail: "preview",
    priceTier: args.priceTier ?? "mid",
  };
}

export function BillingInvoiceEditor({ mode, initial, defaultKind = "invoice" }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [catalog, setCatalog] = useState<BillingCatalogItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [crewRates, setCrewRates] = useState<CrewRateRow[]>([]);
  const [workspaceSettings, setWorkspaceSettings] = useState<BillingSettings | null>(null);
  const [instanceSettings, setInstanceSettings] = useState<InstanceSettings | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const [kind, setKind] = useState<"invoice" | "quote">(initial?.kind ?? defaultKind);
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState(initial?.customerEmail ?? "");
  const [documentTitle, setDocumentTitle] = useState(initial?.documentTitle ?? "");
  const [invoiceDateLocal, setInvoiceDateLocal] = useState(() => {
    const iso = initial?.invoiceDate ?? initial?.createdAt ?? "";
    return iso ? toLocalInputValue(iso) : "";
  });
  const [referenceNo, setReferenceNo] = useState(initial?.referenceNo ?? "");
  const [headerText, setHeaderText] = useState(initial?.headerText ?? "");
  const [brief, setBrief] = useState(initial?.brief ?? "");
  const [includeGear, setIncludeGear] = useState(initial?.includeGear !== false);
  const [includeLabour, setIncludeLabour] = useState(initial?.includeLabour !== false);
  const [priceTier, setPriceTier] = useState<PriceTier>(initial?.priceTier ?? "mid");
  const [gearLines, setGearLines] = useState<BillingLineItem[]>(() =>
    normalizeLinesForEdit(initial?.gearLineItems)
  );
  const [labourLines, setLabourLines] = useState<BillingLineItem[]>(() =>
    normalizeLinesForEdit(initial?.labourLineItems)
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [termsText, setTermsText] = useState(initial?.termsText ?? "");
  const [sendFromEmail, setSendFromEmail] = useState(initial?.sendFromEmail ?? "");
  const [status, setStatus] = useState<BillingStatus>(initial?.status ?? "draft");
  const [followUpEnabled, setFollowUpEnabled] = useState(initial?.followUpEnabled ?? false);
  const [followUpDays, setFollowUpDays] = useState(
    initial?.followUpIntervalDays?.join(",") ?? ""
  );

  const statuses = useMemo(() => defaultStatusesForKind(kind), [kind]);
  const previewDoc = useMemo(
    () =>
      buildPreviewDoc({
        kind,
        number: initial?.number ?? "DRAFT",
        customerName,
        customerEmail: customerEmail.trim() || undefined,
        documentTitle: documentTitle.trim() || undefined,
        invoiceDate: localInputValueToIso(invoiceDateLocal),
        referenceNo: referenceNo.trim() || undefined,
        headerText: headerText.trim() || undefined,
        brief: brief.trim() || undefined,
        includeGear,
        includeLabour,
        priceTier,
        gearLineItems: gearLines,
        labourLineItems: labourLines,
        notes: notes.trim() || undefined,
        termsText: termsText.trim() || undefined,
        id: initial?.id,
      }),
    [
      kind,
      initial?.number,
      initial?.id,
      customerName,
      customerEmail,
      documentTitle,
      invoiceDateLocal,
      referenceNo,
      headerText,
      brief,
      includeGear,
      includeLabour,
      priceTier,
      gearLines,
      labourLines,
      notes,
      termsText,
    ]
  );

  const totals = useMemo(() => computeBillingTotals(activeBillingLines(previewDoc)), [previewDoc]);

  const refreshPreview = useCallback(() => {
    if (!workspaceSettings) return;
    const html = billingDocumentFullHtml(previewDoc, workspaceSettings, "", instanceSettings ?? undefined);
    setPreviewHtml(html);
  }, [previewDoc, workspaceSettings, instanceSettings]);

  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  useEffect(() => {
    fetch("/api/billing/clients")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setClients(d.items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/billing/catalog")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setCatalog(d.items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/inventory/items", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (Array.isArray(d.items)) setInventoryItems(d.items);
      })
      .catch(() => setInventoryItems([]));
  }, []);

  useEffect(() => {
    fetch("/api/billing/crew-rates", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (Array.isArray(d.items)) setCrewRates(d.items as CrewRateRow[]);
      })
      .catch(() => setCrewRates([]));
  }, []);

  useEffect(() => {
    fetch("/api/billing/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setWorkspaceSettings(d.settings);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/instance/settings", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.settings) setInstanceSettings(d.settings as InstanceSettings);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!clientId) return;
    const c = clients.find((x) => x.id === clientId);
    if (c) {
      setCustomerName(c.name);
      setCustomerEmail(c.email ?? "");
    }
  }, [clientId, clients]);

  useEffect(() => {
    setStatus((s) => (statuses.includes(s) ? s : "draft"));
  }, [kind, statuses]);

  const mergedGearPicklist = useMemo(() => {
    const seen = new Set<string>();
    const rows: { key: string; name: string; hint: string }[] = [];
    for (const c of catalog) {
      const n = c.name.trim();
      const k = n.toLowerCase();
      if (!n || seen.has(k)) continue;
      seen.add(k);
      rows.push({
        key: `c-${c.id}`,
        name: n,
        hint: `L ${catalogUnitPriceForTier(c, "low")} · M ${catalogUnitPriceForTier(c, "mid")} · H ${catalogUnitPriceForTier(c, "high")} ${BILLING_CURRENCY}/day`,
      });
    }
    for (const inv of inventoryItems) {
      const n = inv.name.trim();
      const k = n.toLowerCase();
      if (!n || seen.has(k)) continue;
      seen.add(k);
      rows.push({
        key: `i-${inv.id}`,
        name: n,
        hint: `Inventory hire L ${inventoryUnitPriceForTier(inv, "low")} · M ${inventoryUnitPriceForTier(inv, "mid")} · H ${inventoryUnitPriceForTier(inv, "high")} ${BILLING_CURRENCY}/day`,
      });
    }
    return rows;
  }, [catalog, inventoryItems]);

  function addGearLine() {
    setGearLines((prev) => [
      ...prev,
      { id: newId(), description: "", quantity: 1, unitPrice: "0", gstExempt: false },
    ]);
  }

  function addLabourLine() {
    setLabourLines((prev) => [
      ...prev,
      { id: newId(), description: "", quantity: 1, unitPrice: "0", gstExempt: false },
    ]);
  }

  function applyGearLineFromPicklist(id: string, value: string, tier: PriceTier) {
    const key = value.trim().toLowerCase();
    const cat = catalog.find((c) => c.name.trim().toLowerCase() === key);
    if (cat) {
      setGearLines((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                description: cat.name,
                unitPrice: catalogUnitPriceForTier(cat, tier),
                gstExempt: cat.defaultGstExempt,
              }
            : l
        )
      );
      return;
    }
    const inv = inventoryItems.find((i) => i.name.trim().toLowerCase() === key);
    if (inv) {
      setGearLines((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                description: inv.name,
                unitPrice: inventoryUnitPriceForTier(inv, tier),
                gstExempt: false,
              }
            : l
        )
      );
      return;
    }
    setGearLines((prev) => prev.map((l) => (l.id === id ? { ...l, description: value } : l)));
  }

  function onGearPriceTierChange(next: PriceTier) {
    setPriceTier(next);
    setGearLines((prev) =>
      prev.map((line) => {
        const d = line.description.trim().toLowerCase();
        if (!d) return line;
        const cat = catalog.find((c) => c.name.trim().toLowerCase() === d);
        if (cat) {
          return {
            ...line,
            unitPrice: catalogUnitPriceForTier(cat, next),
            gstExempt: cat.defaultGstExempt,
          };
        }
        const inv = inventoryItems.find((i) => i.name.trim().toLowerCase() === d);
        if (inv) {
          return {
            ...line,
            unitPrice: inventoryUnitPriceForTier(inv, next),
            gstExempt: false,
          };
        }
        return line;
      })
    );
  }

  async function addLineToLibrary(line: BillingLineItem) {
    const name = line.description.trim();
    if (!name) return;
    setError(null);
    const up = line.unitPrice || "0";
    const res = await fetch("/api/billing/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        unitPrice: up,
        unitPriceLow: up,
        unitPriceMid: up,
        unitPriceHigh: up,
        defaultGstExempt: line.gstExempt === true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not add to library");
      return;
    }
    const list = await fetch("/api/billing/catalog").then((r) => r.json());
    if (Array.isArray(list.items)) setCatalog(list.items);
  }

  function removeGearLine(id: string) {
    setGearLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  }

  function removeLabourLine(id: string) {
    setLabourLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  }

  function updateGearLine(id: string, patch: Partial<BillingLineItem>) {
    setGearLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function updateLabourLine(id: string, patch: Partial<BillingLineItem>) {
    setLabourLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function parseFollowUpDays(): number[] | undefined {
    const raw = followUpDays
      .split(/[,;\s]+/)
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    return raw.length > 0 ? raw : undefined;
  }

  function linePayload(lines: BillingLineItem[]) {
    return lines.map((l) => ({
      id: l.id,
      description: l.description.trim() || "Line item",
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      gstExempt: l.gstExempt === true,
      ...(l.hrUserId ? { hrUserId: l.hrUserId } : {}),
    }));
  }

  function applyLabourCrew(lineId: string, userId: string) {
    setLabourLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        if (!userId) {
          return { ...l, hrUserId: undefined, description: "", unitPrice: "0" };
        }
        const c = crewRates.find((x) => x.id === userId);
        if (!c) return { ...l, hrUserId: userId };
        const rate = c.crewHandsRateAudExGst;
        const unit =
          rate != null && Number.isFinite(rate) ? roundMoney2(rate).toFixed(2) : "0";
        return {
          ...l,
          hrUserId: userId,
          description: `Labour — ${c.label}`,
          unitPrice: unit,
        };
      })
    );
  }

  async function save() {
    setError(null);
    setPending(true);
    try {
      const payload: Record<string, unknown> = {
        clientId: clientId || undefined,
        customerName,
        customerEmail: customerEmail.trim() || undefined,
        documentTitle: documentTitle.trim() || undefined,
        invoiceDate: localInputValueToIso(invoiceDateLocal),
        referenceNo: referenceNo.trim() || undefined,
        headerText: headerText.trim() || undefined,
        brief: brief.trim() || undefined,
        includeGear,
        includeLabour,
        gearLineItems: includeGear ? linePayload(gearLines) : [],
        labourLineItems: includeLabour ? linePayload(labourLines) : [],
        notes: notes.trim() || undefined,
        termsText: termsText.trim() || undefined,
        sendFromEmail: sendFromEmail.trim() || undefined,
        status,
        followUpEnabled,
        followUpIntervalDays: parseFollowUpDays(),
        priceTier,
      };

      if (mode === "create") {
        payload.kind = kind;
        const res = await fetch("/api/billing/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Save failed");
          return;
        }
        const id = data.item?.id as string | undefined;
        if (id) window.location.assign(`/billing/${id}`);
        else window.location.assign("/billing");
        return;
      }

      if (!initial) return;
      const res = await fetch(`/api/billing/invoices/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function sendEmail() {
    if (!initial) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/billing/invoices/${initial.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: sendFromEmail.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Send failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!initial || mode !== "edit") return;
    if (!confirm("Delete this document permanently?")) return;
    setPending(true);
    try {
      const res = await fetch(`/api/billing/invoices/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Delete failed");
        return;
      }
      window.location.assign("/billing");
    } finally {
      setPending(false);
    }
  }

  const label = kind === "quote" ? "Quote" : "Invoice";
  const gstPct = Math.round(GST_RATE * 100);
  const gearDatalistId = "billing-gear-autofill";

  const renderGearLineRow = (line: BillingLineItem) => {
    const d = line.description.trim().toLowerCase();
    const catMatch = d ? catalog.find((c) => c.name.trim().toLowerCase() === d) : undefined;
    const invMatch = d ? inventoryItems.find((i) => i.name.trim().toLowerCase() === d) : undefined;
    const amounts = lineAmounts(line);
    const showAddLib =
      line.description.trim() &&
      line.unitPrice.trim() !== "" &&
      !matchesCatalogLine(line, catalog);

    const inventoryEditHref = catMatch?.inventoryItemId
      ? `/inventory/${catMatch.inventoryItemId}`
      : invMatch
        ? `/inventory/${invMatch.id}`
        : undefined;
    const catalogEditHref = catMatch ? `/billing/catalog#catalog-item-${catMatch.id}` : undefined;

    return (
      <div key={line.id} className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:min-w-[200px]">
            <span className="text-[10px] uppercase text-slate-500">Item (inventory / presets)</span>
            <input
              value={line.description}
              list={gearDatalistId}
              onChange={(e) => applyGearLineFromPicklist(line.id, e.target.value, priceTier)}
              placeholder="Type to search gear…"
              className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          </div>
          <div className="w-24">
            <span className="text-[10px] uppercase text-slate-500">Qty</span>
            <input
              type="number"
              min={0.001}
              step="any"
              value={line.quantity}
              onChange={(e) =>
                updateGearLine(line.id, {
                  quantity: Math.max(0.0001, parseFloat(e.target.value) || 0),
                })
              }
              className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          </div>
          <div className="w-36">
            <span className="text-[10px] uppercase text-slate-500">Unit price / day</span>
            <input
              value={line.unitPrice}
              onChange={(e) => updateGearLine(line.id, { unitPrice: e.target.value })}
              className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-white/10 bg-black/20 px-2 py-2 text-xs text-slate-300 sm:mb-0.5">
            <input
              type="checkbox"
              checked={line.gstExempt}
              onChange={(e) => updateGearLine(line.id, { gstExempt: e.target.checked })}
              className="rounded border-white/20"
            />
            No GST on this line
          </label>
          <div className="flex flex-wrap items-center gap-1 sm:mb-0.5">
            {inventoryEditHref && (
              <Link
                href={inventoryEditHref}
                className="inline-flex items-center gap-1 rounded border border-violet-500/35 bg-violet-500/10 px-2 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/20"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Inventory
              </Link>
            )}
            {catalogEditHref && (
              <Link
                href={catalogEditHref}
                className="inline-flex items-center gap-1 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Preset
              </Link>
            )}
            {showAddLib && (
              <button
                type="button"
                onClick={() => void addLineToLibrary(line)}
                className="rounded border border-brand/40 bg-brand/10 px-2 py-1.5 text-xs text-brand/95 hover:bg-brand/20"
              >
                Add to library
              </button>
            )}
            <button
              type="button"
              onClick={() => removeGearLine(line.id)}
              className="rounded p-2 text-slate-500 hover:bg-white/10 hover:text-red-300"
              aria-label="Remove line"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1 border-t border-white/5 pt-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-slate-400">
            <span className="text-slate-500">Line total </span>
            <span className="font-medium text-white tabular-nums">{amounts.exGst.toFixed(2)}</span> {BILLING_CURRENCY}
          </p>
          {catMatch && (
            <p className="text-slate-500">
              Preset L/M/H:{" "}
              <span className="tabular-nums text-slate-400">{catalogUnitPriceForTier(catMatch, "low")}</span> /{" "}
              <span className="tabular-nums text-slate-400">{catalogUnitPriceForTier(catMatch, "mid")}</span> /{" "}
              <span className="tabular-nums text-slate-400">{catalogUnitPriceForTier(catMatch, "high")}</span>
              <span className="text-slate-600"> · </span>
              <span className="text-brand/90">
                Tier {priceTier}: {catalogUnitPriceForTier(catMatch, priceTier)} {BILLING_CURRENCY}
              </span>
            </p>
          )}
          {!catMatch && invMatch && (
            <p className="text-slate-500">
              Inventory hire L/M/H:{" "}
              <span className="tabular-nums text-slate-400">{inventoryUnitPriceForTier(invMatch, "low")}</span> /{" "}
              <span className="tabular-nums text-slate-400">{inventoryUnitPriceForTier(invMatch, "mid")}</span> /{" "}
              <span className="tabular-nums text-slate-400">{inventoryUnitPriceForTier(invMatch, "high")}</span>
              <span className="text-slate-600"> · </span>
              <span className="text-brand/90">
                Tier {priceTier}: {inventoryUnitPriceForTier(invMatch, priceTier)} {BILLING_CURRENCY}
              </span>
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderLabourLineRow = (line: BillingLineItem) => {
    const amounts = lineAmounts(line);
    const selected = line.hrUserId ? crewRates.find((c) => c.id === line.hrUserId) : undefined;
    return (
      <div key={line.id} className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:min-w-[220px]">
            <span className="text-[10px] uppercase text-slate-500">Crew (from HR)</span>
            <select
              value={line.hrUserId ?? ""}
              onChange={(e) => applyLabourCrew(line.id, e.target.value)}
              className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="">— Select crew member —</option>
              {crewRates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.crewHandsRateAudExGst != null
                    ? ` — ${c.crewHandsRateAudExGst.toFixed(2)} ${BILLING_CURRENCY}/h`
                    : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <span className="text-[10px] uppercase text-slate-500">Hours</span>
            <input
              type="number"
              min={0.001}
              step="any"
              value={line.quantity}
              onChange={(e) =>
                updateLabourLine(line.id, {
                  quantity: Math.max(0.0001, parseFloat(e.target.value) || 0),
                })
              }
              className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          </div>
          <div className="w-36">
            <span className="text-[10px] uppercase text-slate-500">Rate / hour</span>
            <input
              value={line.unitPrice}
              onChange={(e) => updateLabourLine(line.id, { unitPrice: e.target.value })}
              className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-white/10 bg-black/20 px-2 py-2 text-xs text-slate-300 sm:mb-0.5">
            <input
              type="checkbox"
              checked={line.gstExempt}
              onChange={(e) => updateLabourLine(line.id, { gstExempt: e.target.checked })}
              className="rounded border-white/20"
            />
            No GST on this line
          </label>
          <button
            type="button"
            onClick={() => removeLabourLine(line.id)}
            className="rounded p-2 text-slate-500 hover:bg-white/10 hover:text-red-300 sm:mb-0.5"
            aria-label="Remove line"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="min-w-0">
          <span className="text-[10px] uppercase text-slate-500">Invoice line text</span>
          <input
            value={line.description}
            onChange={(e) => updateLabourLine(line.id, { description: e.target.value })}
            placeholder="e.g. Labour — Alex"
            className="mt-0.5 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div className="flex flex-col gap-1 border-t border-white/5 pt-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-slate-400">
            <span className="text-slate-500">Line total </span>
            <span className="font-medium text-white tabular-nums">{amounts.exGst.toFixed(2)}</span> {BILLING_CURRENCY}
          </p>
          {selected && (
            <p className="text-slate-500">
              HR rate:{" "}
              {selected.crewHandsRateAudExGst != null ? (
                <span className="tabular-nums text-brand/90">
                  {selected.crewHandsRateAudExGst.toFixed(2)} {BILLING_CURRENCY}/h
                </span>
              ) : (
                <span className="text-amber-200/80">Not set in HR — enter rate manually</span>
              )}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <datalist id={gearDatalistId}>
        {mergedGearPicklist.map((row) => (
          <option key={row.key} value={row.name}>
            {row.hint}
          </option>
        ))}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/billing" className="text-sm text-slate-400 hover:text-white">
          ← All billing
        </Link>
        {mode === "edit" && initial && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>
              {initial.number} · {new Date(initial.createdAt).toLocaleDateString()} · {BILLING_CURRENCY}
            </span>
            <Link
              href={`/billing/${initial.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400/90 hover:text-amber-300"
            >
              Print / PDF
            </Link>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      {mode === "create" && (
        <div>
          <label className="block text-sm text-slate-400">Type</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "invoice" | "quote")}
            className="mt-1 w-full max-w-xs rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          >
            <option value="invoice">Invoice</option>
            <option value="quote">Quote</option>
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-400">Client (saved directory)</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          >
            <option value="">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` (${c.company})` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-600">
            Manage in{" "}
            <Link href="/billing/clients" className="text-brand/90 hover:underline">
              Clients
            </Link>
            . Library:{" "}
            <Link href="/billing/catalog" className="text-brand/90 hover:underline">
              line presets
            </Link>
            . Styling:{" "}
            <Link href="/billing/settings" className="text-brand/90 hover:underline">
              Billing workspace
            </Link>{" "}
            (CSS).
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-400">{label} title (shown on PDF)</label>
          <input
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            placeholder={`Defaults to ${label.toLowerCase()} number`}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Date of {label.toLowerCase()}</label>
          <input
            type="datetime-local"
            value={invoiceDateLocal}
            onChange={(e) => setInvoiceDateLocal(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          />
          <p className="mt-1 text-xs text-slate-600">Shows on the PDF header. Includes time.</p>
        </div>
        <div>
          <label className="block text-sm text-slate-400">Reference no. (optional)</label>
          <input
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            placeholder="e.g. PO-1234 / job ref"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-400">Header text (optional)</label>
          <textarea
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            rows={2}
            placeholder="A short note shown near the top of the PDF (separate from Notes/Terms)"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-400">Customer name</label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Customer email (for sending)</label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Send from (optional override)</label>
          <input
            type="email"
            value={sendFromEmail}
            onChange={(e) => setSendFromEmail(e.target.value)}
            placeholder="Uses billing settings or SMTP_FROM"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-400">Brief</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            placeholder="Short summary (e.g. job reference, site)"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BillingStatus)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-6 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-300">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={includeGear}
              onChange={(e) => setIncludeGear(e.target.checked)}
              className="rounded border-white/20"
            />
            Include gear / equipment section
          </label>
          {includeGear && (
            <label className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">Gear rate tier</span>
              <select
                value={priceTier}
                onChange={(e) => onGearPriceTierChange(e.target.value as PriceTier)}
                className="rounded border border-white/10 bg-black/30 px-2 py-1 text-white"
                aria-label="Gear hire pricing tier for this document"
              >
                <option value="low">Low</option>
                <option value="mid">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={includeLabour}
              onChange={(e) => setIncludeLabour(e.target.checked)}
              className="rounded border-white/20"
            />
            Include labour section
          </label>
        </div>
        <div className="sm:col-span-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-400">
          <strong className="text-slate-300">Tax</strong> — Unit prices exclude GST; GST ({gstPct}%) is shown only in
          the document totals below (not on each line). Type in a description to autofill from your{" "}
          <Link href="/billing/catalog" className="text-brand/90 hover:underline">
            library
          </Link>
          .
        </div>
      </div>

      {includeGear && (
        <div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <label className="text-sm font-medium text-slate-300">Gear / equipment</label>
              <p className="mt-0.5 text-xs text-slate-500">
                Pick from <Link href="/inventory" className="text-brand/90 hover:underline">inventory</Link> or{" "}
                <Link href="/billing/catalog" className="text-brand/90 hover:underline">line presets</Link>. Line
                totals and tier rates update as you type; use Edit to change stock or preset pricing.
              </p>
            </div>
            <button
              type="button"
              onClick={addGearLine}
              className="inline-flex shrink-0 items-center gap-1 text-xs text-brand/90 hover:text-brand/80"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add line
            </button>
          </div>
          <div className="mt-2 space-y-3">{gearLines.map((line) => renderGearLineRow(line))}</div>
        </div>
      )}

      {includeLabour && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="text-sm font-medium text-slate-300">Labour</label>
              <p className="mt-0.5 text-xs text-slate-500">
                Pick crew from HR (on-hands rates).{" "}
                <Link href="/hr/directory" className="text-brand/90 hover:underline">
                  Set names &amp; rates in Directory
                </Link>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={addLabourLine}
              className="inline-flex items-center gap-1 text-xs text-brand/90 hover:text-brand/80"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add line
            </button>
          </div>
          <div className="mt-2 space-y-3">{labourLines.map((line) => renderLabourLineRow(line))}</div>
        </div>
      )}

      <div>
        <label className="block text-sm text-slate-400">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400">Terms (override workspace default)</label>
        <textarea
          value={termsText}
          onChange={(e) => setTermsText(e.target.value)}
          rows={3}
          placeholder="Leave blank to use default from Billing settings"
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={followUpEnabled}
            onChange={(e) => setFollowUpEnabled(e.target.checked)}
            className="rounded border-white/20"
          />
          Automatic follow-ups (when status is Sent; requires SMTP + cron hitting `/api/billing/cron/followups`)
        </label>
        <div className="mt-2">
          <label className="text-xs text-slate-500">Follow-up days after send (comma-separated)</label>
          <input
            value={followUpDays}
            onChange={(e) => setFollowUpDays(e.target.value)}
            placeholder="e.g. 7, 14, 30 — blank uses workspace default"
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </div>
        {initial?.nextFollowUpAt && (
          <p className="mt-2 text-xs text-slate-500">
            Next follow-up scheduled: {new Date(initial.nextFollowUpAt).toLocaleString()}
          </p>
        )}
      </div>

      {previewHtml && workspaceSettings && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-slate-300">Preview</p>
          <p className="mt-1 text-xs text-slate-500">
            Uses workspace CSS from{" "}
            <Link href="/billing/settings" className="text-brand/90 hover:underline">
              settings
            </Link>
            . Save to update the public print link.
          </p>
          <iframe
            title="Preview"
            className="mt-3 h-[min(520px,70vh)] w-full rounded-lg border border-white/10 bg-white"
            srcDoc={previewHtml}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
        <div className="space-y-0.5 text-sm text-slate-300">
          <p>
            Subtotal (ex GST):{" "}
            <span className="font-medium text-white">{totals.subtotalExGst.toFixed(2)} {BILLING_CURRENCY}</span>
          </p>
          <p>
            GST ({gstPct}%):{" "}
            <span className="font-medium text-white">{totals.gstAmount.toFixed(2)} {BILLING_CURRENCY}</span>
          </p>
          <p className="text-lg font-semibold text-white">
            Total (inc GST): {totals.totalIncGst.toFixed(2)} {BILLING_CURRENCY}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "edit" && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={pending}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
            >
              Delete
            </button>
          )}
          {mode === "edit" && initial && (
            <button
              type="button"
              onClick={() => void sendEmail()}
              disabled={pending || !customerEmail.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden />
              Send by email
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={pending || !customerName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {mode === "create" ? `Create ${label.toLowerCase()}` : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
