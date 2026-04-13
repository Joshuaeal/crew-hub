import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { parseCsv, rowToMap } from "@/lib/csv-parse";
import {
  createInventoryItem,
  findInventoryItemBySku,
  updateInventoryItem,
} from "@/lib/inventory-store";

function numOrUndef(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export async function POST(request: Request) {
  const gate = await requirePermission("users_manage");
  if (!gate.ok) return gate.response;

  const ct = request.headers.get("content-type") ?? "";
  let csvText = "";

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (file instanceof File) {
      csvText = await file.text();
    } else if (typeof form.get("csv") === "string") {
      csvText = form.get("csv") as string;
    }
  } else {
    try {
      const body = await request.json();
      csvText = typeof body.csv === "string" ? body.csv : "";
    } catch {
      return NextResponse.json({ error: "Expected JSON { csv } or multipart file" }, { status: 400 });
    }
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
  }

  const rows = parseCsv(csvText.trim()).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "Need a header row and at least one data row" },
      { status: 400 }
    );
  }

  const headers = rows[0].map((h) => h.trim());
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const m = rowToMap(headers, cells);
    const name = m.name || m.item || m.title || "";
    if (!name.trim()) {
      errors.push(`Row ${i + 1}: missing name`);
      continue;
    }

    const sku = m.sku || m.code || "";
    const qty = numOrUndef(m.quantity ?? m.qty ?? m.q ?? "") ?? 0;
    const location = m.location || m.loc || "";
    const category = m.category || m.cat || "";
    const notes = m.notes || m.note || m.description || "";
    const minQ = numOrUndef(m.minquantity ?? m.min ?? m.minimum ?? "");

    try {
      if (sku.trim()) {
        const existing = await findInventoryItemBySku(sku);
        if (existing) {
          await updateInventoryItem(existing.id, {
            name: name.trim(),
            sku: sku.trim(),
            quantity: qty,
            location: location.trim() || undefined,
            category: category.trim() || undefined,
            notes: notes.trim() || undefined,
            minQuantity: minQ,
          });
          updated += 1;
        } else {
          await createInventoryItem({
            name: name.trim(),
            sku: sku.trim(),
            quantity: qty,
            location: location.trim() || undefined,
            category: category.trim() || undefined,
            notes: notes.trim() || undefined,
            minQuantity: minQ,
          });
          created += 1;
        }
      } else {
        await createInventoryItem({
          name: name.trim(),
          quantity: qty,
          location: location.trim() || undefined,
          category: category.trim() || undefined,
          notes: notes.trim() || undefined,
          minQuantity: minQ,
        });
        created += 1;
      }
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return NextResponse.json({ ok: true, created, updated, errors });
}
