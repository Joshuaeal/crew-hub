"use client";

import { useEffect } from "react";
import {
  SKU_CATEGORY_CODES,
  SKU_SUBCATEGORY_BY_CAT,
  isSkuCategoryCode,
  isValidSubForCategory,
  normalizeSkuItem,
  normalizeSkuOwnerCode,
  validateSkuItem,
  validateSkuOwner,
} from "@/lib/sku-protocol";

type Props = {
  skuCat: string;
  setSkuCat: (v: string) => void;
  skuSub: string;
  setSkuSub: (v: string) => void;
  skuItem: string;
  setSkuItem: (v: string) => void;
  skuOwner: string;
  setSkuOwner: (v: string) => void;
  sku: string;
  setSku: (v: string) => void;
  skuLocked: boolean;
  setSkuLocked: (v: boolean) => void;
  excludeSku?: string;
};

export function SkuProtocolBuilder({
  skuCat,
  setSkuCat,
  skuSub,
  setSkuSub,
  skuItem,
  setSkuItem,
  skuOwner,
  setSkuOwner,
  sku,
  setSku,
  skuLocked,
  setSkuLocked,
  excludeSku,
}: Props) {
  useEffect(() => {
    if (!isSkuCategoryCode(skuCat)) return;
    const subs = SKU_SUBCATEGORY_BY_CAT[skuCat];
    if (!subs.some((s) => s.code === skuSub)) {
      setSkuSub(subs[0].code);
    }
  }, [skuCat, skuSub, setSkuSub]);

  useEffect(() => {
    if (skuLocked) return;
    if (!isSkuCategoryCode(skuCat)) return;
    if (!isValidSubForCategory(skuCat, skuSub)) return;
    const itemN = normalizeSkuItem(skuItem);
    const ownerN = normalizeSkuOwnerCode(skuOwner);
    if (!validateSkuItem(itemN) || !validateSkuOwner(ownerN)) return;

    const ac = new AbortController();
    const t = window.setTimeout(() => {
      const q = new URLSearchParams({
        cat: skuCat,
        sub: skuSub,
        item: itemN,
        owner: ownerN,
      });
      if (excludeSku) q.set("excludeSku", excludeSku);
      void fetch(`/api/inventory/sku-suggest?${q}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((d: { sku?: string }) => {
          if (typeof d.sku === "string") setSku(d.sku);
        })
        .catch(() => {});
    }, 350);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [skuCat, skuSub, skuItem, skuOwner, skuLocked, excludeSku, setSku]);

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs font-medium text-slate-400">SKU — CAT-SUB-ITEM-OWNER-###</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-slate-500">Category</label>
          <select
            value={skuCat}
            onChange={(e) => {
              setSkuLocked(false);
              setSkuCat(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          >
            {SKU_CATEGORY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Subcategory</label>
          <select
            value={skuSub}
            onChange={(e) => {
              setSkuLocked(false);
              setSkuSub(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          >
            {(isSkuCategoryCode(skuCat) ? SKU_SUBCATEGORY_BY_CAT[skuCat] : []).map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Item code (4–6)</label>
          <input
            value={skuItem}
            onChange={(e) => {
              setSkuLocked(false);
              setSkuItem(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
            }}
            placeholder="BMP4K"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Owner code (2–3)</label>
          <input
            value={skuOwner}
            onChange={(e) => {
              setSkuLocked(false);
              setSkuOwner(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3));
            }}
            placeholder="JA"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500">SKU</label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              value={sku}
              onChange={(e) => {
                setSkuLocked(true);
                setSku(e.target.value.toUpperCase());
              }}
              placeholder="Filled automatically when item + owner codes are valid"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={() => setSkuLocked(false)}
              className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
            >
              Sync from protocol
            </button>
          </div>
          {skuLocked && (
            <p className="mt-1 text-xs text-amber-200/80">
              SKU edited manually — change category fields or click Sync from protocol to regenerate.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
