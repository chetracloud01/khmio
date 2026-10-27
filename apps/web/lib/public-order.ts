import { apiBaseUrl, type PublicOrder, publicOrderSchema } from "./api";

/**
 * The buyer's order by its link's token, read on the server for the order
 * and pay pages; null when no order has it. Never cached: the status changes
 * as the shop, and the payment check, move it on.
 */
export async function loadPublicOrder(token: string): Promise<PublicOrder | null> {
  const response = await fetch(`${apiBaseUrl()}/public/orders/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`order page: API answered ${response.status}`);
  return publicOrderSchema.parse(await response.json());
}
