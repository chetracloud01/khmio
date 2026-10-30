import { buttonVariants, cn } from "@khmio/ui";
import { Boxes } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** "Stock" at the top of Products and Orders on a phone: its bottom bar has no room (laptops have it in the side menu, under Orders). */
export function StockLink({ href }: { href: string }) {
  const t = useTranslations("Stock");
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "secondary" }), "md:hidden")}>
      <Boxes className="h-4 w-4" aria-hidden="true" />
      {t("title")}
    </Link>
  );
}
