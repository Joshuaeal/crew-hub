"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { InventoryItem } from "@/types/inventory";
import { Loader2 } from "lucide-react";
import { SkuProtocolBuilder } from "@/components/SkuProtocolBuilder";
import {
  SKU_SUBCATEGORY_BY_CAT,
  guessSkuCategoryFromCategoryLabel,
  parseRaconteurSku,
} from "@/lib/sku-protocol";

type Props = {
  mode: "create" | "edit";
  initial?: InventoryItem;
};

function initSkuState(mode: "create" | "edit", initial?: InventoryItem) {
  if (mode === "create" || !initial) {
    return {
      skuCat: "CAM",
      skuSub: SKU_SUBCATEGORY_BY_CAT.CAM[0].code,
      skuItem: "",
      skuOwner: "",
      sku: "",
      skuLocked: false,
    };
  }
  const p = initial.sku ? parseRaconteurSku(initial.sku) : null;
  if (p) {
    return {
      skuCat: p.cat,
      skuSub: p.sub,
      skuItem: p.item,
      skuOwner: p.owner,
      sku: initial.sku ?? "",
      skuLocked: false,
    };
  }
  const guessed = initial.category ? guessSkuCategoryFromCategoryLabel(initial.category) : undefined;
  const cat = guessed ?? "CAM";
  return {
    skuCat: cat,
    skuSub: SKU_SUBCATEGORY_BY_CAT[cat][0].code,
    skuItem: "",
    skuOwner: "",
    sku: initial.sku ?? "",
    skuLocked: Boolean(initial.sku?.trim()),
  };
}

export function InventoryItemEditor({ mode, initial }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const initialSku = useMemo(() => initSkuState(mode, initial), [mode, initial]);

  const [name, setName] = useState(initial?.name ?? "");
  const [skuCat, setSkuCat] = useState(initialSku.skuCat);
  const [skuSub, setSkuSub] = useState(initialSku.skuSub);
  const [skuItem, setSkuItem] = useState(initialSku.skuItem);
  const [skuOwner, setSkuOwner] = useState(initialSku.skuOwner);
  const [sku, setSku] = useState(initialSku.sku);
  const [skuLocked, setSkuLocked] = useState(initialSku.skuLocked);

  const [quantity, setQuantity] = useState(initial?.quantity ?? 0);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [minQuantity, setMinQuantity] = useState<string>(
    initial?.minQuantity !== undefined ? String(initial.minQuantity) : ""
  );
  const [midValueAud, setMidValueAud] = useState(
    initial?.midValueAud !== undefined ? String(initial.midValueAud) : ""
  );
  const [hireLowAud, setHireLowAud] = useState(
    initial?.hireLowAud !== undefined ? String(initial.hireLowAud) : ""
  );
  const [hireMidAud, setHireMidAud] = useState(
    initial?.hireMidAud !== undefined ? String(initial.hireMidAud) : ""
  );
  const [hireHighAud, setHireHighAud] = useState(
    initial?.hireHighAud !== undefined ? String(initial.hireHighAud) : ""
  );

  async function save() {
    setError(null);
    setPending(true);
    try {
      const payload = {
        name,
        sku: sku.trim() || undefined,
        skuCat,
        skuSub,
        skuItem,
        skuOwner,
        quantity,
        location: location.trim() || undefined,
        owner: skuOwner.trim() || undefined,
        midValueAud: midValueAud.trim() === "" ? undefined : parseFloat(midValueAud),
        hireLowAud: hireLowAud.trim() === "" ? undefined : parseFloat(hireLowAud),
        hireMidAud: hireMidAud.trim() === "" ? undefined : parseFloat(hireMidAud),
        hireHighAud: hireHighAud.trim() === "" ? undefined : parseFloat(hireHighAud),
        notes: notes.trim() || undefined,
        minQuantity: minQuantity.trim() === "" ? undefined : parseFloat(minQuantity),
      };

      if (mode === "create") {
        const res = await fetch("/api/inventory/items", {
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
        if (id) router.push(`/inventory/${id}`);
        else router.push("/inventory");
        router.refresh();
        return;
      }

      if (!initial) return;
      const res = await fetch(`/api/inventory/items/${initial.id}`, {
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

  async function remove() {
    if (!initial || mode !== "edit") return;
    if (!confirm("Delete this item?")) return;
    setPending(true);
    try {
      const res = await fetch(`/api/inventory/items/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Delete failed");
        return;
      }
      router.push("/inventory");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const minNum = minQuantity.trim() === "" ? NaN : parseFloat(minQuantity);
  const lowStock = Number.isFinite(minNum) && quantity <= minNum;

  return (
    <div className="space-y-6">
      <Link href="/inventory" className="text-sm text-slate-400 hover:text-white">
        ← All items
      </Link>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      {lowStock && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          At or below minimum stock ({minNum}).
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-400">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
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
            excludeSku={mode === "edit" ? initial?.sku : undefined}
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400">Quantity on hand</label>
          <input
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Location (optional)</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Shelf A1"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Mid asset value AUD (optional)</label>
          <input
            type="number"
            step="any"
            value={midValueAud}
            onChange={(e) => setMidValueAud(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Hire low (AUD/day, optional)</label>
          <input
            type="number"
            step="any"
            value={hireLowAud}
            onChange={(e) => setHireLowAud(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Hire medium (AUD/day, optional)</label>
          <input
            type="number"
            step="any"
            value={hireMidAud}
            onChange={(e) => setHireMidAud(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Hire high (AUD/day, optional)</label>
          <input
            type="number"
            step="any"
            value={hireHighAud}
            onChange={(e) => setHireHighAud(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Reorder alert below (optional)</label>
          <input
            type="number"
            step="any"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-400">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
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
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-400 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {mode === "create" ? "Add item" : "Save"}
        </button>
      </div>
    </div>
  );
}
