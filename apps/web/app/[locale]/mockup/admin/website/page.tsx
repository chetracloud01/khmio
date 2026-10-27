"use client";

import { buttonVariants, Card } from "@khmio/ui";
import { ChevronRight, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { SITE_PAGE_INFO, SITE_PAGE_KEYS, useWebsite } from "../../website-context";
import { PageHeader, Pill } from "../admin-ui";
import { useTimeAgo } from "../use-admin-data";
import { minutesSince } from "./site-form";

// A10. Website pages: every page of khmio.com, whether it has unpublished
// changes, and when it was last published (design/screens.md A10).
export default function AdminWebsitePagesPage() {
  const t = useTranslations("SiteEditor");
  const tNav = useTranslations("AdminNav");
  const locale = useLocale();
  const website = useWebsite();
  const timeAgo = useTimeAgo();

  return (
    <>
      <PageHeader title={tNav("website")} description={tNav("websiteDescription")} />
      <Card className="divide-y divide-border p-0">
        {SITE_PAGE_KEYS.map((key) => {
          const state = website.pages[key];
          const last = state.history[0];
          const changes = website.hasChanges(key);
          const sitePath = SITE_PAGE_INFO[key].path;
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t(`page_${key}`)}</span>
                  <Pill className={changes ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}>
                    {changes ? t("statusChanges") : t("statusPublished")}
                  </Pill>
                </div>
                <span className="font-mono text-xs text-muted">khmio.com{sitePath === "/" ? "" : sitePath}</span>
                {last && (
                  <span className="text-xs text-muted">
                    {t("colPublished")}: {t("publishedBy", { time: timeAgo(minutesSince(last.at)), name: last.by })}
                  </span>
                )}
              </div>
              <a
                href={`/${locale}/mockup/site${sitePath === "/" ? "" : sitePath}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("viewLive")}
                title={t("viewLive")}
                className="flex h-11 w-11 items-center justify-center rounded-DEFAULT text-muted hover:bg-border/30 hover:text-fg"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link href={`/${locale}/mockup/admin/website/${key}`} className={buttonVariants({ variant: "secondary" })}>
                {t("edit")}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          );
        })}
      </Card>
    </>
  );
}
