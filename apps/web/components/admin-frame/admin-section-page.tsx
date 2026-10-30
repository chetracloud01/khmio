"use client";

import { Button, Card } from "@khmio/ui";
import { Construction } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { adminBase, ADMIN_NAV_ITEMS, isComingSoon } from "./admin-nav";

/**
 * The admin's [section] page: a menu entry not built yet shows the standard
 * "coming soon" page; any other URL shows "not found" inside the frame, so
 * the menu stays usable. A real page folder always wins over this route.
 */
export function AdminSectionPage() {
  const t = useTranslations("AdminNav");
  const tAdmin = useTranslations("Admin");
  const locale = useLocale();
  const { section } = useParams<{ section: string }>();
  const item = ADMIN_NAV_ITEMS.find((candidate) => candidate.segment === section && isComingSoon(candidate));

  if (!item) {
    return (
      <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="font-medium text-fg">{tAdmin("pageNotFound")}</p>
        <p className="max-w-sm text-sm text-muted">{tAdmin("pageNotFoundBody")}</p>
        <Link href={adminBase(locale)}>
          <Button variant="primary">{tAdmin("backToOverview")}</Button>
        </Link>
      </Card>
    );
  }

  return (
    <>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-fg">{t(item.key)}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t(`${item.key}Description`)}</p>
      </div>
      <Card className="flex flex-col items-center gap-3 px-4 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-border/20">
          <Construction className="h-6 w-6 text-muted" aria-hidden="true" />
        </span>
        <p className="font-semibold text-fg">{t("soonLiveTitle")}</p>
        <p className="max-w-md text-sm text-muted">{t("soonLiveBody")}</p>
      </Card>
    </>
  );
}
