"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InventoryItem } from "@/types/inventory";

type SortKey = "category" | "name" | "qty-desc" | "qty-asc";

function formatAud(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
}

function pricingLine(it: InventoryItem): string | null {
  const l = it.hireLowAud;
  const m = it.hireMidAud;
  const h = it.hireHighAud;
  if (
    (l === undefined || !Number.isFinite(l)) &&
    (m === undefined || !Number.isFinite(m)) &&
    (h === undefined || !Number.isFinite(h))
  ) {
    return null;
  }
  return `Low ${formatAud(l)} · Mid ${formatAud(m)} · High ${formatAud(h)} AUD/day ex GST`;
}

type Props = {
  items: InventoryItem[];
  canEdit: boolean;
};

export function InventoryListClient({ items, canEdit }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("category");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.category?.trim()) set.add(it.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const processed = useMemo(() => {
    const list =
      categoryFilter === "all"
        ? [...items]
        : items.filter((it) => (it.category?.trim() || "") === categoryFilter);

    list.sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (sort === "qty-desc") {
        return b.quantity - a.quantity;
      }
      if (sort === "qty-asc") {
        return a.quantity - b.quantity;
      }
      const ca = (a.category?.trim() || "\uffff").toLowerCase();
      const cb = (b.category?.trim() || "\uffff").toLowerCase();
      if (ca !== cb) return ca.localeCompare(cb);
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return list;
  }, [items, categoryFilter, sort]);

  return (
    <div className="space-y-4">
      {items.length > 1 && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          {categories.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="mt-1 min-w-[10rem] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Sort
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="mt-1 min-w-[12rem] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="category">Category, then name</option>
              <option value="name">Name (A–Z)</option>
              <option value="qty-desc">Quantity (high → low)</option>
              <option value="qty-asc">Quantity (low → high)</option>
            </select>
          </div>
          <p className="text-xs text-slate-500">
            Showing {processed.length} of {items.length}
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {processed.map((it) => {
          const low =
            it.minQuantity !== undefined &&
            Number.isFinite(it.minQuantity) &&
            it.quantity <= it.minQuantity;
          const priceStr = pricingLine(it);

          const inner = (
            <>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">
                  {it.name}
                  {it.sku && <span className="text-slate-500"> · {it.sku}</span>}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Qty {it.quantity}
                  {it.location && ` · ${it.location}`}
                  {it.category && (
                    <span className="text-slate-400"> · {it.category}</span>
                  )}
                  {it.owner && ` · ${it.owner}`}
                  {low && (
                    <span className="text-amber-400/90"> · below minimum ({it.minQuantity})</span>
                  )}
                </p>
                {priceStr && (
                  <p className="mt-1.5 text-xs font-medium text-emerald-400/95">{priceStr}</p>
                )}
                {!priceStr && (
                  <p className="mt-1.5 text-xs text-slate-600">No hire rates — edit item to add billing tiers</p>
                )}
                {it.midValueAud !== undefined && Number.isFinite(it.midValueAud) && (
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    Asset value (mid) ~{formatAud(it.midValueAud)} AUD
                  </p>
                )}
              </div>
              {canEdit && (
                <span className="mt-2 shrink-0 text-xs text-violet-400/90 sm:mt-0">Edit →</span>
              )}
            </>
          );

          return (
            <li key={it.id}>
              {canEdit ? (
                <Link
                  href={`/inventory/${it.id}`}
                  className={`flex flex-col rounded-xl border px-4 py-3 transition sm:flex-row sm:items-start sm:justify-between ${
                    low
                      ? "border-amber-500/35 bg-amber-950/20 hover:border-amber-500/50"
                      : "border-white/10 bg-white/[0.03] hover:border-violet-500/25"
                  }`}
                >
                  {inner}
                </Link>
              ) : (
                <div
                  className={`flex flex-col rounded-xl border px-4 py-3 sm:flex-row sm:items-start sm:justify-between ${
                    low
                      ? "border-amber-500/35 bg-amber-950/20"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
