"use client";

import { buttonVariants, Card, KhmioMark, cn } from "@khmio/ui";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { mockMerchant, mockStore } from "@/mock/mock-data";
import { mockPlatformProducts } from "@/mock/mock-site";
import { STATUS_STYLES } from "../admin/admin-ui";
import { useMerchantProfile } from "../merchant-profile-context";
import { useMerchantSubscription } from "../merchant-subscription-context";

const WAITLIST_KEY = "khmio:mockup-waitlist";

/** The products this device has joined the waitlist for (the mockup's waitlist form keeps them here). */
function useJoinedWaitlists(): Set<string> {
  const [joined, setJoined] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(WAITLIST_KEY) ?? "[]") as { product?: string }[];
      setJoined(new Set(saved.map((entry) => entry.product ?? "")));
    } catch {
      // Nothing readable: no waitlists joined.
    }
  }, []);
  return joined;
}

// H1. My apps (design/screens.md H1): a card per Khmio product — the Shop
// with its plan and status, the others with their waitlist.
export default function AccountAppsPage() {
  const t = useTranslations("Account");
  const tPlans = useTranslations("Plans");
  const tBilling = useTranslations("Billing");
  const locale = useLocale() === "en" ? "en" : "km";
  const profile = useMerchantProfile();
  const { subscription } = useMerchantSubscription();
  const joined = useJoinedWaitlists();
  const shopName = profile.hasProfile ? profile.shopName : locale === "km" ? mockStore.nameKm : mockStore.nameEn;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold leading-normal">{t("hello", { name: mockMerchant.firstName })}</h1>
        <p className="text-sm text-muted">{t("appsIntro")}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {mockPlatformProducts.map((product) => {
          const live = product.status === "live";
          return (
            <li key={product.id}>
              <Card className={cn("flex h-full flex-col gap-3 p-5", live && "border-brand/40")}>
                <div className="flex items-start gap-3">
                  <KhmioMark size={40} className={cn(!live && "opacity-40")} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold">{product.name}</span>
                    <span className="text-sm text-brand">{product.subtitle[locale]}</span>
                  </div>
                  {!live && <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">{t("comingSoon")}</span>}
                </div>

                {product.id === "shop" ? (
                  <>
                    {profile.hasProfile ? (
                      <div className="flex flex-col gap-2 text-sm">
                        <span className="font-semibold">{shopName}</span>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-muted">{t("plan")}:</span>
                          <span className="font-medium">{tPlans(subscription.plan)}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[subscription.status])}>
                            {tBilling(`status_${subscription.status}`)}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted">{t("noShopYet")}</p>
                    )}
                    <Link
                      href={profile.hasProfile ? `/${locale}/mockup/dashboard` : `/${locale}/mockup/onboarding`}
                      className={cn(buttonVariants({ variant: "primary", fullWidth: true }), "mt-auto")}
                    >
                      {profile.hasProfile ? t("openDashboard") : t("setUpShop")}
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted">{product.line[locale]}</p>
                    {joined.has(product.id) ? (
                      <div className="mt-auto flex flex-col gap-1">
                        <span className="flex min-h-touch items-center justify-center gap-2 rounded-DEFAULT bg-success/10 font-semibold text-success">
                          <Check className="h-4 w-4" aria-hidden="true" />
                          {t("onWaitlist")}
                        </span>
                        <span className="text-center text-xs text-muted">{t("onWaitlistHint")}</span>
                      </div>
                    ) : (
                      <Link
                        href={`/${locale}/mockup/site/products/${product.id}#waitlist`}
                        className={cn(buttonVariants({ variant: "secondary", fullWidth: true }), "mt-auto")}
                      >
                        {t("joinWaitlist")}
                      </Link>
                    )}
                  </>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
