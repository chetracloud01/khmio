"use client";

import { Button, Skeleton } from "@khmio/ui";
import { Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { BuyerShell } from "@/components/buyer-shell";

/** The cart and checkout pages while the shop loads: their shape in grey blocks. */
export function BuyerLoading() {
  const t = useTranslations("Storefront");
  return (
    <BuyerShell className="gap-4 p-4" >
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
    </BuyerShell>
  );
}

/** No shop has this link, or the server can't be reached. */
export function BuyerProblem({ kind, onRetry }: { kind: "not_found" | "offline"; onRetry: () => void }) {
  const tApp = useTranslations("App");
  const tOrders = useTranslations("Orders");
  const locale = useLocale();
  return (
    <BuyerShell className="items-center justify-center gap-3 p-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-border/30">
        <Store className="h-8 w-8 text-muted" aria-hidden="true" />
      </span>
      {kind === "offline" ? (
        <>
          <p className="font-semibold">{tApp("offlineTitle")}</p>
          <p className="text-sm text-muted">{tApp("offlineBody")}</p>
          <Button variant="primary" onClick={onRetry}>
            {tApp("retry")}
          </Button>
        </>
      ) : (
        <>
          <p className="font-semibold">{tApp("shopNotFound")}</p>
          <Link href={`/${locale}`}>
            <Button variant="secondary">{tOrders("backToShop")}</Button>
          </Link>
        </>
      )}
    </BuyerShell>
  );
}
