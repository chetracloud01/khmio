import type { Metadata } from "next";
import { loadPublicOrder } from "@/lib/public-order";
import { OrderView } from "./order-view";

// The buyer's order page (design/screens.md B6). The link's random token is
// the only key — the order number alone opens nothing.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OrderView order={await loadPublicOrder(token)} token={token} />;
}
