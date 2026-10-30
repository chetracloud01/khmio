"use client";

import { formatKhmerPhoneLocal, WAITLIST_BUSINESS_TYPES } from "@khmio/shared";
import { Button, Card, EmptyState } from "@khmio/ui";
import { ListChecks } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { adminWaitlistSchema, type AdminWaitlist } from "@/lib/admin-api";
import { api, ApiError } from "@/lib/api";
import { PLATFORM_PRODUCT_NAMES, SITE_SOLUTIONS } from "@/site/content";
import { useDateText } from "@/components/use-date-text";
import { LoadState, PageHeader, Pill } from "../admin-ui";

type Signup = AdminWaitlist["signups"][number];
/** The coming-soon solutions: one chip each, for the businesses waiting for them. */
const COMING_SOON = SITE_SOLUTIONS.filter((solution) => solution.status === "coming_soon");
/** Loaded at a time; the grid searches and filters what's loaded, "Load older" adds the next page. */
const BATCH = 500;

// A14. The website waitlist (design/screens.md): who asked to hear when a
// coming-soon business solution opens, and how many per solution — the
// evidence for which business to switch on next (docs/blueprint.md "Business
// roadmap"). Sign-ups made for Khmio Class and Rent before they left the
// website stay listed.
// Read-only. Owner and support only: it holds phone numbers.
export default function WaitlistPage() {
  const t = useTranslations("AdminApp");
  const tAdmin = useTranslations("Admin");
  const tSite = useTranslations("Site");
  const locale = useLocale() === "en" ? "en" : "km";
  const { dateTime } = useDateText();
  const [data, setData] = useState<AdminWaitlist | null>(null);
  const [failed, setFailed] = useState(false);
  const [notAllowed, setNotAllowed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback((before?: string) => {
    setFailed(false);
    const query = new URLSearchParams({ limit: String(BATCH), ...(before ? { before } : {}) }).toString();
    return api(`/admin/waitlist?${query}`, adminWaitlistSchema).then(
      (page) => setData((previous) => (before && previous ? { ...page, signups: [...previous.signups, ...page.signups] } : page)),
      (error: unknown) => (error instanceof ApiError && error.status === 403 ? setNotAllowed(true) : setFailed(true)),
    );
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  /** The older Class and Rent types by their words; a solution by its name. */
  const businessType = (type: Signup["businessType"]): string => {
    switch (type) {
      case "teacher":
        return tSite("waitlistTeacher");
      case "school":
        return tSite("waitlistSchool");
      case "landlord":
        return tSite("waitlistLandlord");
      case "other":
        return tSite("waitlistOther");
      default:
        return SITE_SOLUTIONS.find((solution) => solution.id === type)?.name[locale] ?? type;
    }
  };

  const columns: DataGridColumn<Signup>[] = [
    {
      key: "when",
      header: tAdmin("colWhen"),
      sortable: true,
      value: (signup) => Date.parse(signup.createdAt),
      exportValue: (signup) => signup.createdAt,
      cell: (signup) => <span className="whitespace-nowrap tabular-nums text-muted">{dateTime(signup.createdAt)}</span>,
    },
    { key: "name", header: t("waitlistColName"), hideable: false, sortable: true, value: (signup) => signup.name, cell: (signup) => <span className="font-medium">{signup.name}</span> },
    {
      key: "phone",
      header: t("waitlistColPhone"),
      value: (signup) => formatKhmerPhoneLocal(signup.phone),
      cell: (signup) => (
        <a href={`tel:+${signup.phone}`} onClick={(event) => event.stopPropagation()} className="inline-flex min-h-touch items-center tabular-nums text-brand hover:underline">
          {formatKhmerPhoneLocal(signup.phone)}
        </a>
      ),
    },
    { key: "type", header: t("waitlistColType"), sortable: true, value: (signup) => businessType(signup.businessType), cell: (signup) => businessType(signup.businessType) },
    {
      key: "product",
      header: t("waitlistColProduct"),
      sortable: true,
      value: (signup) => PLATFORM_PRODUCT_NAMES[signup.product],
      cell: (signup) => <Pill tone="brand">{PLATFORM_PRODUCT_NAMES[signup.product]}</Pill>,
    },
  ];

  return (
    <>
      <PageHeader title={t("waitlistTitle")} description={t("waitlistDescription")} />
      {notAllowed ? (
        <Card className="p-8 text-center text-sm text-muted">{t("waitlistNotAllowed")}</Card>
      ) : !data ? (
        <LoadState failed={failed} onRetry={() => void load()} />
      ) : data.signups.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("waitlistEmpty")} />
      ) : (
        <>
          <DataGrid
            rows={data.signups}
            getRowId={(signup) => signup.id}
            columns={columns}
            searchText={(signup) => `${signup.name} ${signup.phone} ${formatKhmerPhoneLocal(signup.phone)}`}
            searchPlaceholder={t("waitlistSearch")}
            chips={COMING_SOON.map((solution) => ({ value: solution.id, label: solution.name[locale], predicate: (signup: Signup) => signup.businessType === solution.id }))}
            filters={[
              {
                key: "type",
                label: t("waitlistColType"),
                options: WAITLIST_BUSINESS_TYPES.map((type) => ({ value: type, label: businessType(type) })),
                predicate: (signup, value) => signup.businessType === value,
              },
            ]}
            initialSort={{ key: "when", direction: "desc" }}
            renderCard={(signup) => (
              <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{signup.name}</span>
                  <Pill tone="brand">{businessType(signup.businessType)}</Pill>
                </div>
                <span className="text-sm text-muted">
                  {PLATFORM_PRODUCT_NAMES[signup.product]} · {dateTime(signup.createdAt)}
                </span>
              </div>
            )}
            renderCardAction={(signup) => (
              <a href={`tel:+${signup.phone}`} className="inline-flex min-h-touch items-center px-4 font-medium tabular-nums text-brand">
                {formatKhmerPhoneLocal(signup.phone)}
              </a>
            )}
            exportFileName="waitlist"
            storageKey="admin-live-waitlist"
            emptyTitle={tAdmin("noMatches")}
          />
          {data.more && (
            <Button
              variant="secondary"
              className="self-center"
              loading={loadingMore}
              onClick={() => {
                setLoadingMore(true);
                void load(data.signups[data.signups.length - 1]?.createdAt).finally(() => setLoadingMore(false));
              }}
            >
              {t("older")}
            </Button>
          )}
        </>
      )}
    </>
  );
}
