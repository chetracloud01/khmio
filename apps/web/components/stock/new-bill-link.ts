import { MAX_PURCHASE_LINES } from "@khmio/shared";

// "Create bill" from the Stock list: the New bill page opens already filled
// with what to order. Nothing is saved until the seller saves the bill, so
// the list travels in the address (?lines=<option>:<how many>,…&supplier=…).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The New bill page's address for these items, each at its suggested order (1 without one), from their one last supplier when they share it. */
export function newBillHref(locale: string, items: readonly { variantId: string; suggested: number | null; lastSupplierId: string | null }[]): string {
  const lines = items.slice(0, MAX_PURCHASE_LINES).map((item) => `${item.variantId}:${item.suggested ?? 1}`).join(",");
  const suppliers = new Set(items.map((item) => item.lastSupplierId));
  const [supplier] = suppliers.size === 1 ? [...suppliers] : [];
  return `/${locale}/m/purchases/new?lines=${encodeURIComponent(lines)}${supplier ? `&supplier=${supplier}` : ""}`;
}

/** The address's lines back, keeping only well-formed ones (anything else is dropped, never trusted). */
export function billLinesFromAddress(lines: string | null): { variantId: string; quantity: number }[] {
  if (!lines) return [];
  return lines
    .split(",")
    .slice(0, MAX_PURCHASE_LINES)
    .flatMap((entry) => {
      const [variantId = "", quantity = ""] = entry.split(":");
      return UUID.test(variantId) && /^\d{1,7}$/.test(quantity) && Number(quantity) > 0 ? [{ variantId, quantity: Number(quantity) }] : [];
    });
}

/** The address's supplier, when it's an id. */
export const billSupplierFromAddress = (supplier: string | null): string | null => (supplier && UUID.test(supplier) ? supplier : null);
