export function parseCsv(text: string, maxRows = 2000, maxBytes = 2_000_000): { headers: string[]; rows: Array<Record<string, string>> } {
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error("CSV exceeds 2 MB limit");
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (!lines.length || lines.length > maxRows + 1) throw new Error("CSV must contain a header and at most 2,000 data rows");
  const parse = (line: string) => { const result: string[] = []; let value = ""; let quoted = false; for (let i=0;i<line.length;i++) { const c=line[i]; if (c === '"' && line[i+1] === '"') { value += '"'; i++; } else if (c === '"') quoted=!quoted; else if (c === "," && !quoted) { result.push(value.trim()); value=""; } else value += c; } if (quoted) throw new Error("Unclosed CSV quote"); result.push(value.trim()); return result; };
  const headers = parse(lines[0]).map((h) => h.trim()); if (!headers.length || headers.some((h) => !/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(h))) throw new Error("Invalid CSV headers");
  return { headers, rows: lines.slice(1).map((line) => { const values=parse(line); if (values.length !== headers.length) throw new Error("CSV row has the wrong number of columns"); return Object.fromEntries(headers.map((h,i)=>[h, values[i]])); }) };
}
export function csvCell(value: unknown): string { const raw = String(value ?? ""); const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw; return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; }
export function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string { return [headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\r\n") + "\r\n"; }
