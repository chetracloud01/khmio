import { notFound } from "next/navigation";
import { SitePageView } from "../../site-shell";

// P3. Product page for a product not built yet — Class and Rent share it
// (design/screens.md "Platform website"). Khmio Shop has its own page.
export default function SiteComingSoonMockupPage({ params }: { params: { product: string } }) {
  const id = params.product;
  if (id !== "class" && id !== "rent") notFound();
  return <SitePageView pageKey={id} />;
}
