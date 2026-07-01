"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FolderKanban, X } from "lucide-react";
import type { InventoryItem } from "@/types/inventory";
import type { BillingCatalogItem } from "@/types/billing";
import { catalogUnitPriceForTier } from "@/types/billing";

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

type Project = { id: string; name: string; slug: string };

type Props = {
  items: InventoryItem[];
  canEdit: boolean;
  projects?: Project[];
  catalogItems?: BillingCatalogItem[];
};

export function InventoryListClient({ items, canEdit, projects = [], catalogItems = [] }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("category");

  // Add-to-project modal
  const [addModal, setAddModal] = useState<{ item: InventoryItem; catalog: BillingCatalogItem | null } | null>(null);
  const [addProjectSlug, setAddProjectSlug] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addTier, setAddTier] = useState<"low" | "mid" | "high">("mid");
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<{ text: string; err: boolean } | null>(null);

  const catalogByInventoryId = useMemo(() => {
    const m = new Map<string, BillingCatalogItem>();
    for (const c of catalogItems) {
      if (c.inventoryItemId) m.set(c.inventoryItemId, c);
    }
    return m;
  }, [catalogItems]);

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
      if (sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sort === "qty-desc") return b.quantity - a.quantity;
      if (sort === "qty-asc") return a.quantity - b.quantity;
      const ca = (a.category?.trim() || "￿").toLowerCase();
      const cb = (b.category?.trim() || "￿").toLowerCase();
      if (ca !== cb) return ca.localeCompare(cb);
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return list;
  }, [items, categoryFilter, sort]);

  function openAddModal(it: InventoryItem) {
    setAddModal({ item: it, catalog: catalogByInventoryId.get(it.id) ?? null });
    setAddProjectSlug(projects[0]?.slug ?? "");
    setAddQty("1");
    setAddTier("mid");
    setAddMsg(null);
  }

  async function submitAddToProject() {
    if (!addModal || !addProjectSlug) return;
    const { item, catalog } = addModal;
    const qty = parseFloat(addQty) || 1;

    let unitPrice = 0;
    let description = item.name;

    if (catalog) {
      unitPrice = parseFloat(catalogUnitPriceForTier(catalog, addTier)) || 0;
      description = catalog.name;
    } else {
      const rates: Record<"low"|"mid"|"high", number|undefined> = {
        low: item.hireLowAud,
        mid: item.hireMidAud,
        high: item.hireHighAud,
      };
      unitPrice = rates[addTier] ?? item.hireMidAud ?? 0;
    }

    setAddBusy(true);
    setAddMsg(null);
    try {
      const r = await fetch(`/api/projects/${addProjectSlug}/import-line-items`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [{
            description,
            quantity: qty,
            unitPrice,
            ...(catalog ? { catalogItemId: catalog.id } : {}),
          }],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error((d as { error?: string }).error ?? "Failed");
      setAddMsg({ text: `Added to project.`, err: false });
    } catch (e) {
      setAddMsg({ text: e instanceof Error ? e.message : "Failed", err: true });
    } finally {
      setAddBusy(false);
    }
  }

  const hasTiers = (it: InventoryItem, cat: BillingCatalogItem | null) => {
    if (cat) return !!(cat.unitPriceLow || cat.unitPriceHigh);
    return !!(it.hireLowAud ?? it.hireMidAud ?? it.hireHighAud);
  };

  return (
    <div className="space-y-4">
      {items.length > 1 && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          {categories.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="mt-1 min-w-[10rem] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sort</label>
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
          <p className="text-xs text-slate-500">Showing {processed.length} of {items.length}</p>
        </div>
      )}

      <ul className="space-y-2">
        {processed.map((it) => {
          const low =
            it.minQuantity !== undefined &&
            Number.isFinite(it.minQuantity) &&
            it.quantity <= it.minQuantity;
          const priceStr = pricingLine(it);
          const catalog = catalogByInventoryId.get(it.id) ?? null;
          const canQuote = projects.length > 0;

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
                  {it.category && <span className="text-slate-400"> · {it.category}</span>}
                  {it.owner && ` · ${it.owner}`}
                  {low && <span className="text-amber-400/90"> · below minimum ({it.minQuantity})</span>}
                </p>
                {priceStr && <p className="mt-1.5 text-xs font-medium text-emerald-400/95">{priceStr}</p>}
                {!priceStr && <p className="mt-1.5 text-xs text-slate-600">No hire rates — edit item to add billing tiers</p>}
                {it.midValueAud !== undefined && Number.isFinite(it.midValueAud) && (
                  <p className="mt-0.5 text-[11px] text-slate-600">Asset value (mid) ~{formatAud(it.midValueAud)} AUD</p>
                )}
              </div>
              <div className="mt-2 flex shrink-0 items-center gap-2 sm:mt-0">
                {canQuote && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); openAddModal(it); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand/90 hover:bg-brand/20"
                    title="Add to project quote"
                  >
                    <FolderKanban className="h-3.5 w-3.5" aria-hidden />
                    Add to project
                  </button>
                )}
                {canEdit && <span className="text-xs text-violet-400/90">Edit →</span>}
              </div>
            </>
          );

          return (
            <li key={it.id}>
              {canEdit ? (
                <Link
                  href={`/inventory/${it.id}`}
                  className={`flex flex-col rounded-xl border px-4 py-3 transition sm:flex-row sm:items-start sm:justify-between ${
                    low ? "border-amber-500/35 bg-amber-950/20 hover:border-amber-500/50" : "border-white/10 bg-white/[0.03] hover:border-violet-500/25"
                  }`}
                >
                  {inner}
                </Link>
              ) : (
                <div className={`flex flex-col rounded-xl border px-4 py-3 sm:flex-row sm:items-start sm:justify-between ${low ? "border-amber-500/35 bg-amber-950/20" : "border-white/10 bg-white/[0.03]"}`}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Add to project modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-24 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d10] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-white truncate">Add to project: {addModal.item.name}</h2>
              <button type="button" onClick={() => setAddModal(null)} className="ml-2 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="block text-xs text-slate-400">Project</label>
                <select
                  value={addProjectSlug}
                  onChange={(e) => setAddProjectSlug(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                >
                  {projects.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400">Quantity</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
                {hasTiers(addModal.item, addModal.catalog) && (
                  <div>
                    <label className="block text-xs text-slate-400">Rate tier</label>
                    <select
                      value={addTier}
                      onChange={(e) => setAddTier(e.target.value as "low" | "mid" | "high")}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                    >
                      <option value="low">Low</option>
                      <option value="mid">Mid</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                )}
              </div>
              {addMsg && (
                <p className={`text-xs ${addMsg.err ? "text-red-400" : "text-emerald-400"}`}>{addMsg.text}</p>
              )}
              <button
                type="button"
                disabled={addBusy || !addProjectSlug}
                onClick={() => void submitAddToProject()}
                className="w-full rounded-lg bg-brand/90 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80 disabled:opacity-60"
              >
                {addBusy ? "Adding…" : "Add to project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
