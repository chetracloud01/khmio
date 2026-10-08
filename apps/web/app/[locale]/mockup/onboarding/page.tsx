"use client";

import { BUSINESS_TYPES, SHARE_REQUIREMENTS, shopNameSchema, shopSlugSchema, suggestShopSlug, toFieldErrors, type BusinessType, type ShareRequirement } from "@khmio/shared";
import { Button, cn, Input, Mio, SegmentedControl, ThemeSwitcher } from "@khmio/ui";
import { Check, LayoutGrid, Store, Upload, UtensilsCrossed, Wrench, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { mockTakenSlugs, slugify } from "@/mock/mock-data";
import { ACCEPTED_IMAGE_TYPES, compressImage } from "@/components/compress-image";
import { useFormErrorText } from "@/components/form-ui";
import { ShopLinkCard } from "@/components/shop-link-card";
import { NextSteps, OnboardingSteps, ShopPreview, SignUpFrame } from "@/components/sign-up-frame";
import { useThemeLabels } from "@/components/use-theme-labels";
import { useMerchantAccount } from "../merchant-account-context";
import { useMerchantProfile } from "../merchant-profile-context";
import { useShopReadiness, useStartNewShop } from "../new-shop";

/** Where each thing a shop needs before sharing is done. */
const REQUIREMENT_HREF: Record<ShareRequirement, string> = {
  products: "dashboard/products/new",
  phone: "dashboard/profile#details",
  delivery: "dashboard/delivery",
  payment: "dashboard/profile#payments",
};

type SlugStatus = "idle" | "checking" | "available" | "taken";

const BUSINESS_TYPE_ICONS: Record<BusinessType, LucideIcon> = {
  shop: Store,
  restaurant: UtensilsCrossed,
  service: Wrench,
  other: LayoutGrid,
};

/**
 * Two short questions, then the shop is live (docs/blueprint.md "Merchant
 * onboarding"): ① business type, ② shop name and link (with a preview of
 * the shop page on a laptop), ③ "Your shop is ready" — the link and QR, an
 * optional logo, and what's still needed before sharing. Getting paid and
 * the rest are finished from the dashboard, so a new seller is never blocked.
 */
export default function OnboardingMockupPage() {
  const t = useTranslations("Onboarding");
  const tSignUp = useTranslations("SignUp");
  const tType = useTranslations("BusinessType");
  const tReady = useTranslations("Readiness");
  const tMascot = useTranslations("Mascot");
  const themeLabels = useThemeLabels();
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [done, setDone] = useState(false);

  // ① business type — only pre-fills defaults, see handleFinish.
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);

  // ② shop name and link.
  const [shopName, setShopName] = useState("");
  const [shopNameError, setShopNameError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [slugError, setSlugError] = useState<string | null>(null);
  const errorText = useFormErrorText();

  const merchantProfile = useMerchantProfile();
  const { logins } = useMerchantAccount();
  const startNewShop = useStartNewShop();
  const readiness = useShopReadiness();

  // A link can only use English letters, so a name in Khmer gives none: then
  // the seller gets one from their login instead of an empty box.
  const nameGivesNoLink = shopName.trim().length > 0 && slugify(shopName) === "";
  const loginSlug = suggestShopSlug({
    telegramUsername: logins.find((login) => login.method === "telegram")?.account,
    phone: logins.find((login) => login.method === "phone")?.account,
  });
  useEffect(() => {
    if (slugTouched) return;
    const fromName = slugify(shopName);
    setSlug(fromName || (shopName.trim() ? loginSlug : ""));
  }, [shopName, slugTouched, loginSlug]);

  // Mocks a real uniqueness lookup against the DB with a short debounce.
  // Only a link that passes the shared rule is worth looking up.
  useEffect(() => {
    if (!shopSlugSchema.safeParse(slug).success) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const timer = setTimeout(() => {
      setSlugStatus(mockTakenSlugs.includes(slug) ? "taken" : "available");
    }, 500);
    return () => clearTimeout(timer);
  }, [slug]);

  /** ③ The optional logo: in the mockup straight into the sample profile. */
  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    compressImage(file, 512)
      .then(merchantProfile.setLogoDataUrl)
      .catch(() => undefined);
  }

  // Same rules as the shop profile and the API (packages/shared store.ts).
  // Carries what onboarding collected into the shared profile; everything
  // else (Bakong ID, phone, area, description) is added later from the dashboard.
  function handleFinish() {
    const nameOk = shopNameSchema.safeParse(shopName).success;
    const slugResult = shopSlugSchema.safeParse(slug);
    setShopNameError(nameOk ? null : t("shopNameError"));
    // An empty link gets its own message: "too short" would send the seller to the wrong box.
    setSlugError(slug === "" ? t("slugRequired") : slugResult.success ? null : (errorText(toFieldErrors(slugResult.error)[""]) ?? null));
    if (!nameOk || !slugResult.success || slugStatus !== "available") return;

    const type = businessType ?? "other";
    merchantProfile.setBusinessType(type);
    // The seller's own shop starts empty — the sample shop's products, orders and drivers aren't theirs.
    startNewShop(type);
    // Logged in with a phone number: that's the shop's phone until they change it.
    const loginPhone = logins.find((login) => login.method === "phone")?.account;
    if (loginPhone && !merchantProfile.phone) merchantProfile.setPhone(loginPhone);
    merchantProfile.setShopName(shopName.trim());
    merchantProfile.setSlug(slug);
    merchantProfile.setLogoDataUrl(null);
    setDone(true);
  }

  const controls = (
    <>
      <SegmentedControl
        value={locale}
        onChange={(next) => router.push(`/${next}/mockup/onboarding`)}
        options={[
          { value: "km", label: "ខ្មែរ" },
          { value: "en", label: "EN" },
        ]}
      />
      <ThemeSwitcher labels={themeLabels} />
    </>
  );
  const initial = shopName.trim().charAt(0).toUpperCase() || "?";

  if (done) {
    const base = `/${locale}/mockup/`;
    const logo = merchantProfile.logoDataUrl;
    return (
      <SignUpFrame controls={controls}>
        <OnboardingSteps current={3} />
        <div className="flex flex-col items-center gap-2 text-center">
          <Mio pose="coin" size={96} label={tMascot("label")} />
          <h1 className="text-2xl font-bold leading-normal">{t("doneTitle")}</h1>
        </div>

        {/* The shop, with its optional logo (added here: the shop exists now). */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of the merchant's own logo
            <img src={logo} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-on-brand">{initial}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{shopName}</p>
            <p className="truncate text-sm text-muted">/s/{slug}</p>
            <label className="mt-1 inline-flex min-h-touch cursor-pointer items-center gap-2 text-sm font-medium text-brand">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {logo ? tSignUp("changeLogo") : tSignUp("addLogo")}
              <input type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleLogoChange} />
            </label>
          </div>
        </div>

        {/* Sharing waits until a buyer who opens the link can actually order (packages/shared shop-readiness.ts). */}
        {readiness.ready ? (
          <ShopLinkCard url={`${window.location.origin}/s/${slug}`} shopName={shopName} qrFileName={`${slug}-qr.png`} onShared={() => merchantProfile.setLinkShared(true)} />
        ) : (
          <NextSteps
            items={SHARE_REQUIREMENTS.map((requirement) => ({
              key: requirement,
              label: tReady(requirement === "products" && businessType === "service" ? "req_products_service" : `req_${requirement}`),
              href: base + REQUIREMENT_HREF[requirement],
              done: !readiness.missing.includes(requirement),
            }))}
          />
        )}

        <Link href={`/${locale}/mockup/dashboard`} className="block">
          <Button variant="primary" className="w-full">
            {t("goToDashboard")}
          </Button>
        </Link>
      </SignUpFrame>
    );
  }

  return (
    <SignUpFrame controls={controls} wide={step === 2}>
      <OnboardingSteps current={step} />

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold leading-normal">{t("businessStepTitle")}</h1>
            <p className="text-sm text-muted">{t("businessStepHint")}</p>
          </div>
          <div role="radiogroup" aria-label={t("businessStepTitle")} className="grid grid-cols-2 gap-3">
            {BUSINESS_TYPES.map((type) => {
              const Icon = BUSINESS_TYPE_ICONS[type];
              const selected = businessType === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setBusinessType(type)}
                  className={cn(
                    "relative flex min-h-touch flex-col items-start gap-3 rounded-2xl border-2 bg-bg p-4 text-left transition-colors",
                    selected ? "border-brand bg-brand/5" : "border-border hover:bg-border/10",
                  )}
                >
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-DEFAULT", selected ? "bg-brand text-on-brand" : "bg-brand/10 text-brand")}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">{tType(type)}</span>
                    <span className="text-sm text-muted">{tType(`${type}Hint`)}</span>
                  </span>
                  {selected && <Check className="absolute right-3 top-3 h-5 w-5 text-brand" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold leading-normal">{t("nameStepTitle")}</h1>
              <p className="text-sm text-muted">{t("nameStepHint")}</p>
            </div>
            <Input
              label={t("shopNameLabel")}
              placeholder={t("shopNamePlaceholder")}
              autoFocus
              value={shopName}
              onChange={(e) => {
                setShopName(e.target.value);
                setShopNameError(null);
                setSlugError(null);
              }}
              onBlur={() => setShopNameError(shopNameSchema.safeParse(shopName).success ? null : t("shopNameError"))}
              error={shopNameError ?? undefined}
            />
            <div className="flex flex-col gap-1.5">
              <Input
                label={t("slugLabel")}
                prefix="/s/"
                autoCapitalize="none"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                  setSlugError(null);
                }}
                error={slugError ?? (slugStatus === "taken" ? t("slugTaken") : undefined)}
              />
              {nameGivesNoLink && !slugTouched && slug !== "" && <p className="text-sm text-muted">{t("slugFromKhmerHint")}</p>}
              {slugStatus === "checking" && <p className="text-sm text-muted">{t("slugChecking")}</p>}
              {slugStatus === "available" && !slugError && (
                <p className="flex items-center gap-1 text-sm text-success">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {t("slugAvailable")}
                </p>
              )}
            </div>
          </section>
          <div className="hidden lg:block">
            <ShopPreview name={shopName.trim()} link={`/s/${slug || "…"}`} logo={initial} />
          </div>
        </div>
      )}

      {/* Phone: pinned to the bottom; laptop: at the end of the form. */}
      <div className="fixed inset-x-0 bottom-0 z-20 lg:static lg:z-auto">
        <div className="pb-safe mx-auto flex max-w-[480px] gap-3 border-t border-border bg-bg px-4 pt-3 lg:max-w-[440px] lg:border-0 lg:bg-transparent lg:p-0">
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep(1)} className="w-full">
              {t("back")}
            </Button>
          )}
          {step === 1 ? (
            <Button variant="primary" onClick={() => setStep(2)} disabled={!businessType} className="w-full">
              {t("next")}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleFinish} className="w-full">
              {t("finish")}
            </Button>
          )}
        </div>
      </div>
      {/* Room for the pinned buttons on a phone. */}
      <div className="h-20 lg:hidden" aria-hidden="true" />
    </SignUpFrame>
  );
}
