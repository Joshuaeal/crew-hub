"use client";

import { useRef, useState } from "react";
import { AlertCircle, Check, ChevronRight, Loader2, Upload, X } from "lucide-react";
import { parseCsv } from "@/lib/csv-parse";

const ROW_LIMIT = 500;

type ParsedSheet = { headers: string[]; rows: string[][] };

type FieldDef = { key: string; label: string; required: boolean };

type UserEntry = { id: string; email: string; displayName?: string };
type CatalogEntry = { id: string; name: string };

type TalentPreviewRow = {
  name: string;
  role: string;
  rate?: number;
  externalContact?: string;
  personId?: string;
  externalName?: string;
  matched: boolean;
  excluded: boolean;
};

type LineItemPreviewRow = {
  description: string;
  quantity: number;
  unitPrice: number;
  catalogItemId?: string;
  catalogMatched: boolean;
  excluded: boolean;
};

type ImportResult = { ok: boolean; error?: string };

type Step = "upload" | "map" | "preview" | "result";

const TALENT_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", required: true },
  { key: "role", label: "Role", required: true },
  { key: "rate", label: "Rate (AUD/day)", required: false },
  { key: "externalContact", label: "Contact (email/phone)", required: false },
];

const LINE_ITEM_FIELDS: FieldDef[] = [
  { key: "description", label: "Description", required: true },
  { key: "quantity", label: "Quantity", required: true },
  { key: "unitPrice", label: "Unit Price", required: true },
  { key: "catalogItemId", label: "Catalog Item (name lookup)", required: false },
];

const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "person", "talent", "crew", "crewmember"],
  role: ["role", "position", "title", "jobtitle", "job"],
  rate: ["rate", "dayrate", "dailyrate", "daycost", "dayrateaud"],
  externalContact: ["externalcontact", "contact", "email", "phone", "contactemail"],
  description: ["description", "desc", "item", "lineitem", "service", "itemname"],
  quantity: ["quantity", "qty", "units", "days", "count"],
  unitPrice: ["unitprice", "price", "unit", "cost", "unitcost", "rate"],
  catalogItemId: ["catalogitemid", "catalog", "catalogitem", "sku", "catalogid", "catalogname"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-]/g, "");
}

function guessMapping(headers: string[], fields: FieldDef[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();
  for (const field of fields) {
    const aliases = FIELD_ALIASES[field.key] ?? [normalize(field.key)];
    for (const h of headers) {
      const nh = normalize(h);
      if (!usedHeaders.has(h) && aliases.includes(nh)) {
        mapping[field.key] = h;
        usedHeaders.add(h);
        break;
      }
    }
  }
  return mapping;
}

async function parseFile(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];
    const allRows = data
      .map((r) => (r as unknown[]).map((c) => String(c ?? "").trim()))
      .filter((r) => r.some((c) => c !== ""));
    if (allRows.length === 0) throw new Error("The file appears to be empty.");
    return { headers: allRows[0], rows: allRows.slice(1) };
  }
  // CSV
  const text = await file.text();
  const allRows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (allRows.length === 0) throw new Error("The file appears to be empty.");
  return { headers: allRows[0], rows: allRows.slice(1) };
}

function getCell(
  row: string[],
  headers: string[],
  columnHeader: string | undefined
): string {
  if (!columnHeader) return "";
  const idx = headers.indexOf(columnHeader);
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

type Props = {
  projectSlug: string;
  target: "talent" | "line-items";
  userList: UserEntry[];
  onComplete: () => void;
  onClose: () => void;
};

export function SpreadsheetImporter({
  projectSlug,
  target,
  userList,
  onComplete,
  onClose,
}: Props) {
  const fields = target === "talent" ? TALENT_FIELDS : LINE_ITEM_FIELDS;
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const [talentRows, setTalentRows] = useState<TalentPreviewRow[]>([]);
  const [lineItemRows, setLineItemRows] = useState<LineItemPreviewRow[]>([]);
  const [buildingPreview, setBuildingPreview] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);

  // Column exclusivity: a column used by one field can't be picked by another
  function availableHeaders(forField: string): string[] {
    if (!sheet) return [];
    const usedBy = Object.entries(mapping)
      .filter(([k, v]) => k !== forField && v)
      .map(([, v]) => v);
    return sheet.headers.filter((h) => !usedBy.includes(h));
  }

  function mappingComplete(): boolean {
    return fields.filter((f) => f.required).every((f) => !!mapping[f.key]);
  }

  async function handleFileChange(file: File) {
    setParseErr(null);
    setParsing(true);
    try {
      const parsed = await parseFile(file);
      const dataRows = parsed.rows;
      if (dataRows.length > ROW_LIMIT) {
        throw new Error(
          `This file has ${dataRows.length} data rows, which exceeds the ${ROW_LIMIT}-row limit. Please split it into smaller files.`
        );
      }
      if (dataRows.length === 0) {
        throw new Error("The file has a header row but no data rows.");
      }
      setSheet(parsed);
      setMapping(guessMapping(parsed.headers, fields));
      setStep("map");
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : "Failed to parse file.");
    } finally {
      setParsing(false);
    }
  }

  async function buildPreview() {
    if (!sheet) return;
    setBuildingPreview(true);
    try {
      if (target === "talent") {
        const nameCol = mapping["name"];
        const roleCol = mapping["role"];
        const rateCol = mapping["rate"];
        const contactCol = mapping["externalContact"];

        const rows: TalentPreviewRow[] = sheet.rows.map((r) => {
          const nameVal = getCell(r, sheet.headers, nameCol);
          const roleVal = getCell(r, sheet.headers, roleCol);
          const rateVal = getCell(r, sheet.headers, rateCol);
          const contactVal = getCell(r, sheet.headers, contactCol);

          const matched = userList.find(
            (u) =>
              (u.displayName ?? u.email).trim().toLowerCase() ===
              nameVal.trim().toLowerCase()
          );

          const rate = rateVal ? parseFloat(rateVal) : undefined;

          return {
            name: nameVal,
            role: roleVal,
            rate: rate !== undefined && !isNaN(rate) ? rate : undefined,
            externalContact: contactVal || undefined,
            personId: matched?.id,
            externalName: matched ? undefined : nameVal,
            matched: !!matched,
            excluded: false,
          };
        });
        setTalentRows(rows);
      } else {
        // Fetch catalog for matching
        let catalog: CatalogEntry[] = [];
        try {
          const r = await fetch("/api/billing/catalog", { credentials: "same-origin" });
          if (r.ok) {
            const d = await r.json();
            catalog = Array.isArray(d.items) ? (d.items as CatalogEntry[]) : [];
          }
        } catch {
          // If catalog fetch fails, proceed without matching
        }

        const descCol = mapping["description"];
        const qtyCol = mapping["quantity"];
        const priceCol = mapping["unitPrice"];
        const catCol = mapping["catalogItemId"];

        const rows: LineItemPreviewRow[] = sheet.rows.map((r) => {
          const desc = getCell(r, sheet.headers, descCol);
          const qtyStr = getCell(r, sheet.headers, qtyCol);
          const priceStr = getCell(r, sheet.headers, priceCol);
          const catName = getCell(r, sheet.headers, catCol);

          const qty = parseFloat(qtyStr);
          const price = parseFloat(priceStr);

          let catalogItemId: string | undefined;
          let catalogMatched = false;
          if (catName) {
            const found = catalog.find(
              (c) => c.name.trim().toLowerCase() === catName.trim().toLowerCase()
            );
            if (found) {
              catalogItemId = found.id;
              catalogMatched = true;
            }
          }

          return {
            description: desc,
            quantity: isNaN(qty) ? 0 : qty,
            unitPrice: isNaN(price) ? 0 : price,
            catalogItemId,
            catalogMatched,
            excluded: false,
          };
        });
        setLineItemRows(rows);
      }
      setStep("preview");
    } finally {
      setBuildingPreview(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      if (target === "talent") {
        const rows = talentRows
          .filter((r) => !r.excluded)
          .map((r) => ({
            personId: r.personId,
            externalName: r.externalName,
            externalContact: r.externalContact,
            role: r.role,
            rate: r.rate,
          }));
        const res = await fetch(`/api/projects/${projectSlug}/import-talent`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        });
        const d = await res.json();
        setResults(Array.isArray(d.results) ? (d.results as ImportResult[]) : []);
      } else {
        const rows = lineItemRows
          .filter((r) => !r.excluded)
          .map((r) => ({
            description: r.description,
            quantity: r.quantity,
            unitPrice: r.unitPrice,
            catalogItemId: r.catalogItemId,
          }));
        const res = await fetch(`/api/projects/${projectSlug}/import-line-items`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        });
        const d = await res.json();
        setResults(Array.isArray(d.results) ? (d.results as ImportResult[]) : []);
      }
      setStep("result");
      onComplete();
    } catch {
      setResults([{ ok: false, error: "Request failed. Please try again." }]);
      setStep("result");
    } finally {
      setSubmitting(false);
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  const activeRows =
    target === "talent"
      ? talentRows.filter((r) => !r.excluded)
      : lineItemRows.filter((r) => !r.excluded);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-3xl rounded-2xl border border-white/15 bg-[#111] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">
            Import from spreadsheet —{" "}
            {target === "talent" ? "Talent" : "Line Items"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 border-b border-white/10 px-5 py-3">
          {(["upload", "map", "preview", "result"] as Step[]).map((s, i) => {
            const labels = { upload: "Upload", map: "Map columns", preview: "Preview", result: "Done" };
            const active = step === s;
            const done =
              (s === "upload" && ["map", "preview", "result"].includes(step)) ||
              (s === "map" && ["preview", "result"].includes(step)) ||
              (s === "preview" && step === "result");
            return (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-slate-600" />}
                <span
                  className={`text-xs ${active ? "text-white font-medium" : done ? "text-emerald-400" : "text-slate-600"}`}
                >
                  {labels[s]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {/* ── Step: Upload ── */}
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Upload a <strong className="text-white">.csv</strong>,{" "}
                <strong className="text-white">.xlsx</strong>, or{" "}
                <strong className="text-white">.xls</strong> file. The first row must
                be column headers. Maximum {ROW_LIMIT} data rows.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/15 px-8 py-12 text-center">
                <Upload className="h-8 w-8 text-slate-500" />
                <p className="text-sm text-slate-400">
                  Drop a file or click to browse
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileChange(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={parsing}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-60"
                >
                  {parsing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
                    </>
                  ) : (
                    "Choose file"
                  )}
                </button>
              </div>
              {parseErr && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {parseErr}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Map ── */}
          {step === "map" && sheet && (
            <div className="space-y-5">
              {/* 5-row preview */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  File preview (first 5 rows)
                </p>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        {sheet.headers.map((h) => (
                          <th
                            key={h}
                            className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-400"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {sheet.rows.slice(0, 5).map((row, ri) => (
                        <tr key={ri}>
                          {sheet.headers.map((h, ci) => (
                            <td
                              key={ci}
                              className="whitespace-nowrap px-3 py-2 text-slate-300"
                            >
                              {row[ci] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {sheet.rows.length} data row{sheet.rows.length !== 1 ? "s" : ""} total
                </p>
              </div>

              {/* Field mapping */}
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Map columns to fields
                </p>
                <div className="space-y-3">
                  {fields.map((field) => (
                    <div key={field.key} className="grid items-center gap-3 sm:grid-cols-2">
                      <label className="text-sm text-slate-300">
                        {field.label}
                        {field.required && (
                          <span className="ml-1 text-xs text-red-400">*</span>
                        )}
                      </label>
                      <select
                        value={mapping[field.key] ?? ""}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/40"
                      >
                        <option value="">— not mapped —</option>
                        {availableHeaders(field.key).map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                        {/* keep current value selectable even if "used" */}
                        {mapping[field.key] &&
                          !availableHeaders(field.key).includes(mapping[field.key]) && (
                            <option value={mapping[field.key]}>{mapping[field.key]}</option>
                          )}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={!mappingComplete() || buildingPreview}
                  onClick={() => void buildPreview()}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80 disabled:opacity-50"
                >
                  {buildingPreview ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Building preview…
                    </>
                  ) : (
                    "Preview →"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("upload")}
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Preview ── */}
          {step === "preview" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Review the rows below. Uncheck any you want to skip, then confirm to
                import.
              </p>

              {target === "talent" && (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-left">
                        <th className="px-3 py-2 text-slate-500">Include</th>
                        <th className="px-3 py-2 text-slate-500">Name</th>
                        <th className="px-3 py-2 text-slate-500">Role</th>
                        <th className="px-3 py-2 text-slate-500">Rate</th>
                        <th className="px-3 py-2 text-slate-500">Contact</th>
                        <th className="px-3 py-2 text-slate-500">Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {talentRows.map((row, i) => (
                        <tr key={i} className={row.excluded ? "opacity-40" : ""}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={!row.excluded}
                              onChange={(e) =>
                                setTalentRows((prev) =>
                                  prev.map((r, j) =>
                                    j === i ? { ...r, excluded: !e.target.checked } : r
                                  )
                                )
                              }
                              className="accent-brand"
                            />
                          </td>
                          <td className="px-3 py-2 text-white">{row.name || <span className="text-red-400">missing</span>}</td>
                          <td className="px-3 py-2 text-slate-300">{row.role || <span className="text-red-400">missing</span>}</td>
                          <td className="px-3 py-2 text-slate-300">
                            {row.rate !== undefined ? `$${row.rate.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{row.externalContact ?? "—"}</td>
                          <td className="px-3 py-2">
                            {row.matched ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <Check className="h-3 w-3" /> Staff
                              </span>
                            ) : (
                              <span className="text-slate-500">External</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {target === "line-items" && (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-left">
                        <th className="px-3 py-2 text-slate-500">Include</th>
                        <th className="px-3 py-2 text-slate-500">Description</th>
                        <th className="px-3 py-2 text-right text-slate-500">Qty</th>
                        <th className="px-3 py-2 text-right text-slate-500">Unit price</th>
                        <th className="px-3 py-2 text-right text-slate-500">Total</th>
                        <th className="px-3 py-2 text-slate-500">Catalog</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {lineItemRows.map((row, i) => (
                        <tr key={i} className={row.excluded ? "opacity-40" : ""}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={!row.excluded}
                              onChange={(e) =>
                                setLineItemRows((prev) =>
                                  prev.map((r, j) =>
                                    j === i ? { ...r, excluded: !e.target.checked } : r
                                  )
                                )
                              }
                              className="accent-brand"
                            />
                          </td>
                          <td className="px-3 py-2 text-white">
                            {row.description || <span className="text-red-400">missing</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300">{row.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-300">
                            ${row.unitPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300">
                            ${(row.quantity * row.unitPrice).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {row.catalogItemId ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <Check className="h-3 w-3" /> Linked
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-slate-500">
                {activeRows.length} row{activeRows.length !== 1 ? "s" : ""} selected for
                import
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={submitting || activeRows.length === 0}
                  onClick={() => void submit()}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand/80 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                    </>
                  ) : (
                    `Import ${activeRows.length} row${activeRows.length !== 1 ? "s" : ""}`
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("map")}
                  disabled={submitting}
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Result ── */}
          {step === "result" && (
            <div className="space-y-4">
              <div
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${failCount === 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}
              >
                {failCount === 0 ? (
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {successCount} row{successCount !== 1 ? "s" : ""} imported
                    {failCount > 0 ? `, ${failCount} failed` : " successfully"}.
                  </p>
                </div>
              </div>

              {failCount > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-left">
                        <th className="px-3 py-2 text-slate-500">Row</th>
                        <th className="px-3 py-2 text-slate-500">Status</th>
                        <th className="px-3 py-2 text-slate-500">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {results.map((r, i) =>
                        !r.ok ? (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2 text-red-400">Failed</td>
                            <td className="px-3 py-2 text-slate-300">{r.error}</td>
                          </tr>
                        ) : null
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
