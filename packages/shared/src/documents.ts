// Numbered documents (docs/blueprint.md "Cost price", suppliers and bills):
// each kind counts 1, 2, 3… on its own in each shop (the database's
// document_counters), and is shown with its prefix: BILL-0001, RET-0001,
// PAY-0001, CNT-0001 (a stock count). The prefix is only how it's shown; the number is what's saved.

export const DOCUMENT_SERIES = ["bill", "return", "payment", "count"] as const;
export type DocumentSeries = (typeof DOCUMENT_SERIES)[number];

/** Each series' prefix, as printed and typed in a search. Codes, not words: the same in Khmer and English. */
export const DOCUMENT_PREFIXES: Record<DocumentSeries, string> = { bill: "BILL", return: "RET", payment: "PAY", count: "CNT" };

/** Numbers below this many digits are padded with zeros (BILL-0007); bigger ones just grow (BILL-12345). */
export const DOCUMENT_NUMBER_DIGITS = 4;

/** "BILL-0007". */
export function formatDocumentNumber(series: DocumentSeries, number: number): string {
  return `${DOCUMENT_PREFIXES[series]}-${String(number).padStart(DOCUMENT_NUMBER_DIGITS, "0")}`;
}

/**
 * A document number as a seller types it in a search: "BILL-7", "bill 0007",
 * "#7" or "7". The series is known only when a prefix was typed. Anything
 * else is null (searched as text instead).
 */
export function parseDocumentNumber(text: string): { series: DocumentSeries | null; number: number } | null {
  const match = /^(?:([a-z]+)[\s-]*|#)?0*(\d{1,9})$/i.exec(text.trim());
  if (!match?.[2]) return null;
  const typed = match[1]?.toUpperCase();
  if (!typed) return { series: null, number: Number(match[2]) };
  const series = DOCUMENT_SERIES.find((entry) => DOCUMENT_PREFIXES[entry] === typed);
  return series ? { series, number: Number(match[2]) } : null;
}
