import { buttonVariants } from "@khmio/ui";
import { Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** "Customers" at the top of the Orders page: how a phone gets there (its bottom bar has no room); laptops also have it in the side menu. */
export function CustomersLink({ href }: { href: string }) {
  const t = useTranslations("Customers");
  return (
    <Link href={href} className={buttonVariants({ variant: "secondary" })}>
      <Users className="h-4 w-4" aria-hidden="true" />
      {t("title")}
    </Link>
  );
}
