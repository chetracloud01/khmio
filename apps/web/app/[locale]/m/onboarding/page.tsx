"use client";

import {
  BUSINESS_TYPES,
  createStoreInputSchema,
  getMissingForSharing,
  SHARE_REQUIREMENTS,
  slugify,
  suggestShopSlug,
  toFieldErrors,
  type BusinessType,
  type FormErrorCode,
  type ShareRequirement,
} from "@khmio/shared";
import { Button, cn, Input, Mio, SegmentedControl, ThemeSwitcher } from "@khmio/ui";
import { Car, Check, LayoutGrid, Store, Upload, UtensilsCrossed, Wrench, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { ACCEPTED_IMAGE_TYPES, compressImageToBlob } from "@/components/compress-image";
import { ShopLinkCard } from "@/components/shop-link-card";
import { NextSteps, OnboardingSteps, ShopPreview, SignUpFrame } from "@/components/sign-up-frame";
import { useThemeLabels } from "@/components/use-theme-labels";
import { api, ApiError, getMe, uploadPhoto, type Me, type StoreDetails } from "@/lib/api";
import { AppLoading, AppOffline } from "../app-frame";

const ICONS: Record<BusinessType, LucideIcon> = { shop: Store, restaurant: UtensilsCrossed, service: Wrench, garage: Car, other: LayoutGrid };
type SlugState = "idle" | "checking" | "available" | "taken" | "invalid";

// Real onboarding (roadmap step 2, redesigned with the approved mockup):
// ① business type, ② shop name and link (the shop page previewed beside them
// on a laptop), then the shop is created and ③ "Your shop is ready" shows its
// link, an optional logo and what's still needed before sharing. Phone,
// delivery and payment come from the dashboard checklist.
export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const tSignUp = useTranslations("SignUp");
  const tType = useTranslations("BusinessType");
  const tError = useTranslations("FormErrors");
  const tApp = useTranslations("App");
  const tReady = useTranslations("Readiness");
  const tMascot = useTranslations("Mascot");
  const themeLabels = useThemeLabels();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"checking" | "ready" | "offline">("checking");
  const [step, setStep] = useState<1 | 2>(1);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [busy, setBusy] = useState(false);
  // ③: the shop once it's created.
  const [store, setStore] = useState<StoreDetails | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const load = useCallback(() => {
    setState("checking");
    getMe()
      .then((result) => {
        if (!result) return router.replace(`/${locale}/m/login`);
        if (result.store) return router.replace(`/${locale}/m`);
        setMe(result);
        setState("ready");
      })
      .catch(() => setState("offline"));
  }, [locale, router]);
  useEffect(load, [load]);

  // A name in Khmer gives no link (links use English letters): suggest one from the Telegram username.
  const nameGivesNoLink = shopName.trim().length > 0 && slugify(shopName) === "";
  useEffect(() => {
    if (slugTouched) return;
    const fromName = slugify(shopName);
    setSlug(fromName || (shopName.trim() ? suggestShopSlug({ telegramUsername: me?.merchant.telegramUsername ?? undefined }) : ""));
  }, [shopName, slugTouched, me]);

  // Ask the API whether the link is free, a moment after the seller stops typing.
  useEffect(() => {
    if (!slug || store) return setSlugState("idle");
    setSlugState("checking");
    const timer = setTimeout(() => {
      api<{ available: boolean; reason?: "taken" | "invalid" }>(`/stores/slug-available?slug=${encodeURIComponent(slug)}`)
        .then((result) => setSlugState(result.available ? "available" : (result.reason ?? "invalid")))
        .catch(() => setSlugState("idle"));
    }, 400);
    return () => clearTimeout(timer);
  }, [slug, store]);

  async function finish() {
    const input = { businessType, shopName, slug };
    const parsed = createStoreInputSchema.safeParse(input);
    if (!parsed.success) {
      const found = toFieldErrors(parsed.error);
      setErrors(slug === "" ? { ...found, slug: undefined } : found);
      return;
    }
    if (slugState === "taken") return setErrors({ slug: "slug_taken" });
    setBusy(true);
    try {
      await api("/stores", { method: "POST", body: parsed.data });
      setStore(await api<StoreDetails>("/store"));
    } catch (caught) {
      setBusy(false);
      if (caught instanceof ApiError && caught.code === "invalid_input") return setErrors(caught.fields);
      if (caught instanceof ApiError && caught.status === 409) return router.replace(`/${locale}/m`);
      setErrors({ form: "required" });
    }
  }

  /** ③ The optional logo: uploaded, then saved with the shop's details (as on the My shop page). */
  async function addLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !store) return;
    setLogoBusy(true);
    setLogoFailed(false);
    try {
      const uploaded = await uploadPhoto(await compressImageToBlob(file, 512));
      const saved = await api<StoreDetails>("/store", {
        method: "PUT",
        body: { shopName: store.name, businessType: store.businessType, phone: store.phone, area: store.area, description: store.description, bakongId: store.bakongId, logoKey: uploaded.key },
      });
      setStore(saved);
    } catch {
      setLogoFailed(true);
    } finally {
      setLogoBusy(false);
    }
  }

  if (state === "checking") return <AppLoading />;
  if (state === "offline") return <AppOffline onRetry={load} />;

  const controls = (
    <>
      <SegmentedControl
        value={locale}
        onChange={(next) => router.replace(pathname.replace(/^\/(km|en)(?=\/|$)/, `/${next}`))}
        options={[
          { value: "km", label: "ខ្មែរ" },
          { value: "en", label: "EN" },
        ]}
      />
      <ThemeSwitcher labels={themeLabels} />
    </>
  );
  const initial = shopName.trim().charAt(0).toUpperCase() || "?";

  if (store) {
    const base = `/${locale}/m`;
    const missing = getMissingForSharing({ businessType: store.businessType, shopPhone: store.phone, ...store.readiness });
    // The same four steps and links as the dashboard's setup checklist.
    const href: Record<ShareRequirement, string> = {
      products: `${base}/products/new`,
      phone: `${base}/settings#details`,
      delivery: `${base}/delivery`,
      payment: `${base}/store-settings`,
    };
    return (
      <SignUpFrame controls={controls}>
        <OnboardingSteps current={3} />
        <div className="flex flex-col items-center gap-2 text-center">
          <Mio pose="coin" size={96} label={tMascot("label")} />
          <h1 className="text-2xl font-bold leading-normal">{t("doneTitle")}</h1>
        </div>

        {/* The shop, with its optional logo (it can be uploaded now the shop exists). */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-4">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the shop's own uploaded logo
            <img src={store.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-on-brand">{store.name.charAt(0).toUpperCase()}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{store.name}</p>
            <p className="truncate text-sm text-muted">/s/{store.slug}</p>
            <label className={cn("mt-1 inline-flex min-h-touch cursor-pointer items-center gap-2 text-sm font-medium text-brand", logoBusy && "pointer-events-none opacity-60")}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              {store.logoUrl ? tSignUp("changeLogo") : tSignUp("addLogo")}
              <input type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" disabled={logoBusy} onChange={(event) => void addLogo(event)} />
            </label>
            {logoFailed && (
              <p role="alert" className="text-sm text-danger">
                {tSignUp("logoFailed")}
              </p>
            )}
          </div>
        </div>

        {/* Sharing waits until a buyer who opens the link can actually order (packages/shared shop-readiness.ts). */}
        {missing.length === 0 ? (
          <ShopLinkCard url={`${window.location.origin}/${locale}/s/${store.slug}`} shopName={store.name} qrFileName={`${store.slug}-qr.png`} />
        ) : (
          <NextSteps
            items={SHARE_REQUIREMENTS.map((requirement) => ({
              key: requirement,
              label: tReady(requirement === "products" && store.businessType === "service" ? "req_products_service" : `req_${requirement}`),
              href: href[requirement],
              done: !missing.includes(requirement),
            }))}
          />
        )}

        <Link href={base} className="block">
          <Button variant="primary" className="w-full">
            {t("goToDashboard")}
          </Button>
        </Link>
      </SignUpFrame>
    );
  }

  const slugError = slug === "" && errors.slug === undefined && Object.keys(errors).length > 0 ? t("slugRequired") : errors.slug ? tError(errors.slug) : slugState === "taken" ? t("slugTaken") : undefined;

  return (
    <SignUpFrame controls={controls} wide={step === 2}>
      <OnboardingSteps current={step} />

      {step === 1 ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold leading-normal">{t("businessStepTitle")}</h1>
            <p className="text-sm text-muted">{t("businessStepHint")}</p>
          </div>
          <div role="radiogroup" aria-label={t("businessStepTitle")} className="grid grid-cols-2 gap-3">
            {BUSINESS_TYPES.map((type) => {
              const Icon = ICONS[type];
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
      ) : (
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
                setErrors({});
              }}
              error={errors.shopName ? t("shopNameError") : undefined}
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
                  setErrors({});
                }}
                error={slugError}
              />
              {nameGivesNoLink && !slugTouched && slug !== "" && <p className="text-sm text-muted">{t("slugFromKhmerHint")}</p>}
              {slugState === "checking" && <p className="text-sm text-muted">{t("slugChecking")}</p>}
              {slugState === "available" && !slugError && (
                <p className="flex items-center gap-1 text-sm text-success">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {t("slugAvailable")}
                </p>
              )}
            </div>
            {errors.form && (
              <p role="alert" className="text-sm text-danger">
                {tApp("saveFailed")}
              </p>
            )}
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
            <Button variant="primary" disabled={!businessType} onClick={() => setStep(2)} className="w-full">
              {t("next")}
            </Button>
          ) : (
            <Button variant="primary" loading={busy} disabled={busy} onClick={() => void finish()} className="w-full">
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
