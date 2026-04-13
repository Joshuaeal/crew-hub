"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BillingCatalogItem } from "@/types/billing";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { SkuProtocolBuilder } from "@/components/SkuProtocolBuilder";
import { SKU_SUBCATEGORY_BY_CAT } from "@/lib/sku-protocol";

export default function BillingCatalogPage() {
  const [items, setItems] = useState<BillingCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [skuCat, setSkuCat] = useState("CAM");
  const [skuSub, setSkuSub] = useState(SKU_SUBCATEGORY_BY_CAT.CAM[0].code);
  const [skuItem, setSkuItem] = useState("");
  const [skuOwner, setSkuOwner] = useState("");
  const [sku, setSku] = useState("");
  const [skuLocked, setSkuLocked] = useState(false);
  const [unitPriceLow, setUnitPriceLow] = useState("0");
  const [unitPriceMid, setUnitPriceMid] = useState("0");
  const [unitPriceHigh, setUnitPriceHigh] = useState("0");
  const [defaultGstExempt, setDefaultGstExempt] = useState(false);

  const load = useCallback(() => {
    fetch("/api/billing/catalog")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setItems(d.items);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    setPending(true);
    try {
      const res = await fetch("/api/billing/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim() || undefined,
          skuCat,
          skuSub,
          skuItem,
          skuOwner,
          unitPrice: unitPriceMid.trim() || "0",
          unitPriceLow: unitPriceLow.trim() || "0",
          unitPriceMid: unitPriceMid.trim() || "0",
          unitPriceHigh: unitPriceHigh.trim() || "0",
          defaultGstExempt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed");
        return;
      }
      setName("");
      setSkuCat("CAM");
      setSkuSub(SKU_SUBCATEGORY_BY_CAT.CAM[0].code);
      setSkuItem("");
      setSkuOwner("");
      setSku("");
      setSkuLocked(false);
      setUnitPriceLow("0");
      setUnitPriceMid("0");
      setUnitPriceHigh("0");
      setDefaultGstExempt(false);
      load();
    } finally {
      setPending(false);
    }
  }

  async function updateGstExempt(id: string, value: boolean) {
    setPending(true);
    try {
      await fetch(`/api/billing/catalog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultGstExempt: value }),
      });
      load();
    } finally {
      setPending(false);
    }
  }

  async function updatePrices(
    id: string,
    patch: { unitPriceLow?: string; unitPriceMid?: string; unitPriceHigh?: string }
  ) {
    setPending(true);
    try {
      const mid = patch.unitPriceMid?.trim() || "0";
      await fetch(`/api/billing/catalog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitPrice: mid,
          ...patch,
        }),
      });
      load();
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this catalog line?")) return;
    setPending(true);
    try {
      await fetch(`/api/billing/catalog/${id}`, { method: "DELETE" });
      load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
        <div>
          <Link href="/billing" className="text-sm text-slate-400 hover:text-white">
            ← Billing
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Line item library</h1>
          <p className="mt-1 text-sm text-slate-400">
            Saved products and services (AUD, ex GST). Gear lines can store low / medium / high hire rates; the
            invoice&apos;s tier selector picks which rate applies to matching lines.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            )}

            <form onSubmit={(e) => void add(e)} className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-medium text-slate-300">Add preset</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-500">Name / description</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <SkuProtocolBuilder
                    skuCat={skuCat}
                    setSkuCat={setSkuCat}
                    skuSub={skuSub}
                    setSkuSub={setSkuSub}
                    skuItem={skuItem}
                    setSkuItem={setSkuItem}
                    skuOwner={skuOwner}
                    setSkuOwner={setSkuOwner}
                    sku={sku}
                    setSku={setSku}
                    skuLocked={skuLocked}
                    setSkuLocked={setSkuLocked}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Low (ex GST)</label>
                  <input
                    value={unitPriceLow}
                    onChange={(e) => setUnitPriceLow(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Medium (ex GST)</label>
                  <input
                    value={unitPriceMid}
                    onChange={(e) => setUnitPriceMid(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">High (ex GST)</label>
                  <input
                    value={unitPriceHigh}
                    onChange={(e) => setUnitPriceHigh(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={defaultGstExempt}
                    onChange={(e) => setDefaultGstExempt(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  Default GST exempt when added to a document
                </label>
              </div>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/90 disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                <Plus className="h-4 w-4" aria-hidden />
                Add to library
              </button>
            </form>

            <ul className="space-y-2">
              {items.length === 0 ? (
                <li className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
                  No presets yet. Add common invoice lines here for quick entry.
                </li>
              ) : (
                items.map((row) => (
                  <li
                    key={row.id}
                    id={`catalog-item-${row.id}`}
                    className="flex flex-col gap-3 scroll-mt-24 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.sku && <span className="mr-2">SKU {row.sku}</span>}
                        Updated {new Date(row.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={row.defaultGstExempt}
                          disabled={pending}
                          onChange={(e) => void updateGstExempt(row.id, e.target.checked)}
                          className="rounded border-white/20"
                        />
                        GST exempt default
                      </label>
                      {row.inventoryItemId && (
                        <span className="text-[10px] uppercase text-slate-600">Linked to inventory</span>
                      )}
                      <span className="text-[10px] uppercase text-slate-500">L</span>
                      <input
                        type="text"
                        defaultValue={row.unitPriceLow ?? row.unitPrice}
                        key={`${row.id}-low-${row.unitPriceLow ?? row.unitPrice}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const cur = (row.unitPriceLow ?? row.unitPrice).trim();
                          if (v !== cur) void updatePrices(row.id, { unitPriceLow: v });
                        }}
                        className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white"
                        aria-label="Low tier ex GST"
                      />
                      <span className="text-[10px] uppercase text-slate-500">M</span>
                      <input
                        type="text"
                        defaultValue={row.unitPriceMid ?? row.unitPrice}
                        key={`${row.id}-mid-${row.unitPriceMid ?? row.unitPrice}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const cur = (row.unitPriceMid ?? row.unitPrice).trim();
                          if (v !== cur) void updatePrices(row.id, { unitPriceMid: v });
                        }}
                        className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white"
                        aria-label="Medium tier ex GST"
                      />
                      <span className="text-[10px] uppercase text-slate-500">H</span>
                      <input
                        type="text"
                        defaultValue={row.unitPriceHigh ?? row.unitPrice}
                        key={`${row.id}-high-${row.unitPriceHigh ?? row.unitPrice}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const cur = (row.unitPriceHigh ?? row.unitPrice).trim();
                          if (v !== cur) void updatePrices(row.id, { unitPriceHigh: v });
                        }}
                        className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white"
                        aria-label="High tier ex GST"
                      />
                      <span className="text-xs text-slate-500">AUD</span>
                      <button
                        type="button"
                        onClick={() => void remove(row.id)}
                        disabled={pending}
                        className="rounded p-2 text-slate-500 hover:bg-white/10 hover:text-red-300 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
