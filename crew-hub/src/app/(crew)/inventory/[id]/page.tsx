import { notFound } from "next/navigation";
import { InventoryItemEditor } from "@/components/InventoryItemEditor";
import { getInventoryItem } from "@/lib/inventory-store";

type PageProps = { params: { id: string } };

export default async function InventoryDetailPage({ params }: PageProps) {
  const item = await getInventoryItem(params.id);
  if (!item) notFound();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">{item.name}</h1>
          <p className="mt-1 text-sm text-slate-500">SKU {item.sku ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <InventoryItemEditor mode="edit" initial={item} />
        </div>
      </div>
    </div>
  );
}
