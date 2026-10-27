import type { Metadata } from "next";
import { loadPublicOrder } from "@/lib/public-order";
import { PayView } from "./pay-view";

// Paying an order by KHQR (design/screens.md B5), reached from checkout or
// the order page's "Pay now". Same key as the order page: the link's token.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PayView initial={await loadPublicOrder(token)} token={token} />;
}
