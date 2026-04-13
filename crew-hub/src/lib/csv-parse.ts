/** Minimal RFC-style CSV line parser (handles quoted fields with commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  pushField();
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
    pushRow();
  }
  return rows;
}

export function rowToMap(headers: string[], cells: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let j = 0; j < headers.length; j++) {
    const key = headers[j]?.trim().toLowerCase() ?? "";
    if (!key) continue;
    o[key] = cells[j]?.trim() ?? "";
  }
  return o;
}
