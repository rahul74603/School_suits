// =============================================================================
// School Guardian Suite — CSV / file download helper (v1.7 FIN)
// -----------------------------------------------------------------------------
// Backup/Export workstream ka chhota sa shared helper: pages ke paas jo
// data pehle se loaded hai, usei se CSV banana aur file download karana.
// Koi library nahi — Blob + <a download> ka seedha tareeka.
//
// SEEMA (imaandari se): Capacitor (Android) WebView me <a download> +
// blob URL par browser jaisa pakka download nahi hota — kuch WebView
// versions me click bina kuch kiye reh sakta hai ya file app ke cache
// me utarti hai, Downloads folder me nahi. Desktop/Electron aur aam
// mobile browser me ye tareeka theek chalta hai. Android par pakka
// download (@capacitor/filesystem + share) selling-phase ka kaam hai —
// NOTES.md me laal nishaan se flag hai.
// =============================================================================

// Ek CSV cell: comma, quote ya nayi line ho to double-quote me band
// karo aur andar ke quotes dohre kar do (RFC 4180 wala aam niyam).
export function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// Headers + rows (har row = cells ki array) se poori CSV string.
// Pehli line headers ki hai. Excel Hindi/Unicode naam sahi khole,
// isliye download ke samay UTF-8 BOM jodna caller ka kaam hai
// (downloadCsv wahi karta hai).
export function rowsToCsv(
  headers: string[],
  rows: Array<Array<unknown>>,
): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvCell).join(","),
  );
  return lines.join("\r\n");
}

// Text ko file banakar download karo (CSV, JSON — koi bhi text).
export function downloadTextFile(
  filename: string,
  text: string,
  mimeType: string,
): void {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Turant revoke karne se kuch browsers me download rukk sakta hai,
  // isliye chhoti si der baad saaf karo.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// CSV download — UTF-8 BOM ke saath taaki Excel me Hindi naam aur
// baaki Unicode akshar bigdein nahi.
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<unknown>>,
): void {
  downloadTextFile(filename, "\uFEFF" + rowsToCsv(headers, rows), "text/csv");
}

// File naamo ke liye aaj ki tareekh: "2026-11-11".
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
