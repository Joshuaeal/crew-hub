import { InventoryItemEditor } from "@/components/InventoryItemEditor";

export default function NewInventoryPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">New inventory item</h1>
          <p className="mt-1 text-sm text-slate-400">Track quantity and optional reorder threshold.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <InventoryItemEditor mode="create" />
        </div>
      </div>
    </div>
  );
}
