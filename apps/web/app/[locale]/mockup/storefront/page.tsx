"use client";

import { formatKhr, formatUsd, isStorefrontOpen, maxOrderQuantity, type Currency } from "@khmio/shared";
import { Badge, Button, cn, SegmentedControl, Skeleton, ThemeSwitcher } from "@khmio/ui";
import { ChevronRight, Clock, Info, SearchX, ShoppingBag, Store, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BuyerColumns, BuyerShell } from "@/components/buyer-shell";
import { CartPanel } from "@/components/buyer/cart-panel";
import { BrowseToolbar } from "@/components/buyer/browse-toolbar";
import { ShopHero } from "@/components/buyer/shop-hero";
import { useProductBrowse, type BrowseAccessors } from "@/components/buyer/use-product-browse";
import { TrackOrderCard } from "@/components/invoice/track-order-card";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getStartingVariant, getStoreMaxDiscountPercent, getUnitUsdCents, mockStore, parseLineKey, type MockProduct } from "@/mock/mock-data";
import { useAdmin } from "../admin-context";
import { useCart } from "../cart-context";
import { useDeliverySettings } from "../delivery-settings-context";
import { useMerchantSubscription } from "../merchant-subscription-context";
import { useOnlineStock } from "../online-stock";
import { useCheckoutTotal } from "../use-checkout-total";
import { useThemeLabels } from "@/components/use-theme-labels";
import { ProductCard } from "../shared-ui";
import { useShopIdentity } from "../shop-identity";
import { useShopProducts } from "../shop-products";
import { ProductDetail } from "./product-detail";
import { ShopInfo } from "./shop-info";

// A paused store (trial ended or subscription unpaid) keeps its link working
// but takes no orders — see docs/blueprint.md "Subscription life cycle".
export default function StorefrontMockupPage() {
  const { hydrated, subscription } = useMerchantSubscription();
  const { hydrated: stockReady } = useOnlineStock();
  const { hydrated: productsReady } = useShopProducts();
  const { hydrated: identityReady } = useShopIdentity();
  const { hydrated: deliveryReady } = useDeliverySettings();
  // Waits for saved stock, products and shop details too, so nothing flashes in (or out) after the page appears.
  if (!hydrated || !stockReady || !productsReady || !identityReady || !deliveryReady) return <StorefrontSkeleton />;
  if (!isStorefrontOpen(subscription.status)) return <StoreClosed />;
  // useSearchParams (the ?product= link) needs a Suspense boundary for Next's static prerender.
  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <Storefront />
    </Suspense>
  );
}

/** The shop's shape in grey blocks while its data loads — never a blank page or a spinner. */
function StorefrontSkeleton() {
  const t = useTranslations("Storefront");
  return (
    <div className="min-h-dvh bg-canvas" aria-busy="true">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col bg-bg md:border-x md:border-border">
        <Skeleton className="h-32 w-full rounded-none sm:h-44" />
        <div className="flex flex-col gap-2 px-4 pt-9">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-1 h-11 w-full" />
        </div>
        <div className="flex gap-2 px-4 pt-5">
          <Skeleton className="h-11 w-16 rounded-full" />
          <Skeleton className="h-11 w-24 rounded-full" />
          <Skeleton className="h-11 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 px-4 pt-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StoreClosed() {
  const t = useTranslations("Storefront");
  const { name: storeName } = useShopIdentity();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4 text-fg">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-3 rounded-2xl bg-bg p-8 text-center shadow-card">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-border/30">
          <Store className="h-8 w-8 text-muted" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-semibold">{storeName}</h1>
        <p className="text-sm text-muted">{t("temporarilyClosed")}</p>
      </div>
    </div>
  );
}

function Storefront() {
  const t = useTranslations("Storefront");
  const { demoKycStatus } = useAdmin();
  const themeLabels = useThemeLabels();
  const locale = useLocale();
  const router = useRouter();
  const { quantities, setQuantities, currency } = useCart();
  const { name: storeName, initial: storeInitial, logoDataUrl } = useShopIdentity();
  // The seller's logo once they've added one; the shop's first letter until then.
  const logo = logoDataUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- merchant's own upload preview, not a remote image
    <img src={logoDataUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    storeInitial
  );
  const ratingCountLabel = locale === "km" ? mockStore.ratingCountLabelKm : mockStore.ratingCountLabelEn;

  const { products, categories } = useShopProducts();

  // The open product lives in the link (?product=p1), so a product can be
  // shared on Facebook or TikTok and the phone's Back button closes it.
  const pathname = usePathname();
  const productParam = useSearchParams().get("product");
  const detailProduct = productParam ? (products.find((product) => product.id === productParam) ?? null) : null;
  const openedHere = useRef(false);

  function openProduct(product: MockProduct) {
    openedHere.current = true;
    router.push(`${pathname}?product=${encodeURIComponent(product.id)}`, { scroll: false });
  }

  /** Back if the buyer opened it from this page; a buyer who arrived by a shared link stays in the shop. */
  function closeProduct() {
    if (openedHere.current) {
      openedHere.current = false;
      router.back();
    } else {
      router.replace(pathname, { scroll: false });
    }
  }

  // Once the banner has scrolled away, the pinned search bar shows the shop's
  // initial so the buyer still knows whose shop this is.
  const identityRef = useRef<HTMLDivElement>(null);
  const [identityHidden, setIdentityHidden] = useState(false);
  useEffect(() => {
    const target = identityRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setIdentityHidden(!entry?.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const maxDiscount = getStoreMaxDiscountPercent(products);
  const specialOfferProducts = products.filter((product) => (product.discountPercent ?? 0) > 0);
  // Only categories with something to buy get a chip.
  const shownCategories = categories.filter((category) => products.some((product) => product.categoryId === category.id));

  // The list's search, category, sort and grid-or-list — the same block as the live shop (components/buyer).
  const browseAccessors = useMemo<BrowseAccessors<MockProduct>>(
    () => ({
      text: (product) => `${product.titleKm} ${product.titleEn}`,
      category: (product) => product.categoryId,
      price: (product) => getUnitUsdCents(product, product.variants?.length ? getStartingVariant(product) : undefined) ?? 0,
      discount: (product) => product.discountPercent ?? 0,
    }),
    [],
  );
  const browse = useProductBrowse(products, browseAccessors, mockStore.slug);
  const visibleProducts = browse.shown;
  const showSpecialOffers = browse.category === "all" && !browse.query && browse.sort === "newest" && specialOfferProducts.length > 0;

  // The cart bar shows the goods total in the buyer's currency — the same
  // round-each-line-then-sum numbers checkout uses.
  const tCart = useTranslations("Cart");
  const { itemCount, lines } = useCheckoutTotal(quantities, locale, null, currency);
  const goodsTotal = lines.reduce((sum, line) => sum + line.discounted * line.qty, 0);
  const format = (amount: number, cur: Currency) => (cur === "USD" ? formatUsd(amount) : formatKhr(amount));

  const { stateFor } = useOnlineStock();
  const stockLabels = { soldOut: t("soldOut"), onlyLeft: (count: number) => t("onlyLeft", { count }) };

  /** Adds or removes one, never beyond what the shop has in stock (Pro and Advance). */
  function adjustQuantity(key: string, delta: number) {
    const { productId, variantId } = parseLineKey(key);
    const max = maxOrderQuantity(stateFor(productId, variantId));
    setQuantities((prev) => {
      const wanted = Math.max(0, (prev[key] ?? 0) + delta);
      return { ...prev, [key]: max === null ? wanted : Math.min(wanted, max) };
    });
  }

  function clearFilters() {
    browse.setQuery("");
    browse.setCategory("all");
  }

  const cardProps = {
    locale,
    currency,
    quantities,
    stockFor: stateFor,
    stockLabels,
    onAdjustQuantity: adjustQuantity,
    onOpen: openProduct,
    addLabel: t("add"),
    startingFromLabel: t("startingFrom"),
    decreaseLabelFor: (title: string) => t("decrease", { title }),
    increaseLabelFor: (title: string) => t("increase", { title }),
  };

  const cartHref = `/${locale}/mockup/cart`;

  return (
    <BuyerShell wide className="pb-32 lg:pb-0">
      <BuyerColumns
        aside={
          <CartPanel
            title={tCart("yourCart")}
            lines={lines.map((line) => ({ key: line.key, name: line.title, qty: line.qty, amount: format(line.discounted * line.qty, currency) }))}
            totalLabel={t("goodsTotal")}
            total={format(goodsTotal, currency)}
            checkoutHref={cartHref}
            checkoutLabel={tCart("checkout")}
            emptyText={t("panelEmpty")}
          />
        }
      >
        <div ref={identityRef}>
          <ShopHero
            name={storeName}
            logo={logo}
            openLabel={t("openNow")}
            highlight={maxDiscount > 0 ? t("upTo", { percent: maxDiscount }) : undefined}
            controls={
              <>
                <SegmentedControl
                  value={locale}
                  onChange={(next) => router.push(`/${next}/mockup/storefront`)}
                  options={[
                    { value: "km", label: "ខ្មែរ" },
                    { value: "en", label: "EN" },
                  ]}
                />
                <ThemeSwitcher labels={themeLabels} />
              </>
            }
            facts={
              <>
                {/* Only after the super admin approved the owner's ID — the badge is a promise to buyers. */}
                {demoKycStatus === "approved" && <Badge>{t("verified")}</Badge>}
                <span>{t("rating", { value: mockStore.ratingValue, count: ratingCountLabel })}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {t("deliveryTime", { min: mockStore.deliveryEtaMinMinutes, max: mockStore.deliveryEtaMaxMinutes })}
                </span>
              </>
            }
            info={<ShopInfo />}
          />
        </div>

        {/* For buyers without Telegram (design/screens.md B8). */}
        <div className="px-4 pb-3">
          <TrackOrderCard href={`/${locale}/mockup/track`} />
        </div>

        {/* Only search and categories stay pinned — the rest of the screen is for products. */}
        <BrowseToolbar
          browse={browse}
          categories={shownCategories.map((category) => ({ id: category.id, label: locale === "km" ? category.labelKm : category.labelEn }))}
          leading={
            <span
              aria-hidden="true"
              className={cn(
                "flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-sm font-bold text-on-brand transition-all duration-200 motion-reduce:transition-none",
                identityHidden ? "w-9 opacity-100" : "w-0 opacity-0",
              )}
            >
              {logo}
            </span>
          }
        />

        {productParam && !detailProduct && (
          <div role="status" className="mx-4 mt-4 flex items-center gap-3 rounded-DEFAULT border border-border bg-canvas p-3 text-sm">
            <Info className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <p className="flex-1">{t("productUnavailable")}</p>
            <button
              type="button"
              onClick={closeProduct}
              aria-label={t("close")}
              className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-border/30"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {showSpecialOffers && (
          <section className="flex flex-col gap-3 pt-4">
            <h2 className="px-4 text-base font-semibold">{t("specialOffers")}</h2>
            <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-1">
              {specialOfferProducts.map((product) => (
                <ProductCard key={product.id} product={product} className="w-40 shrink-0 snap-start sm:w-44" {...cardProps} />
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-1 flex-col gap-3 pt-4">
          {showSpecialOffers && <h2 className="px-4 text-base font-semibold">{t("allProducts")}</h2>}
          {visibleProducts.length > 0 ? (
            <div className={browse.view === "grid" ? "grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3" : "flex flex-col gap-3 px-4 pb-4"}>
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} view={browse.view} {...cardProps} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-border/30">
                <SearchX className="h-7 w-7 text-muted" aria-hidden="true" />
              </span>
              <p className="text-sm text-muted">
                {browse.query.trim() ? t("noResultsFor", { query: browse.query.trim() }) : t("noProducts")}
              </p>
              <Button variant="secondary" onClick={clearFilters}>
                {t("showAllProducts")}
              </Button>
            </div>
          )}
        </section>
      </BuyerColumns>

      {detailProduct && <ProductDetail key={detailProduct.id} product={detailProduct} onClose={closeProduct} />}

      {itemCount > 0 && (
        <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pt-3 lg:hidden">
          <Link
            // Re-mounting on each change replays the small "bump", so adding an item is felt.
            key={itemCount}
            href={cartHref}
            className="pointer-events-auto mx-auto flex min-h-[56px] w-full max-w-[520px] animate-bump items-center justify-between gap-3 rounded-2xl bg-brand px-4 py-2 text-on-brand shadow-raised motion-reduce:animate-none"
          >
            <span className="flex items-center gap-3">
              <span className="relative">
                <ShoppingBag className="h-6 w-6" aria-hidden="true" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-bg px-1 text-xs font-bold text-brand">
                  {itemCount}
                </span>
              </span>
              <span className="flex flex-col items-start">
                <span className="text-xs opacity-90">{t("itemCount", { count: itemCount })}</span>
                <span className="text-base font-semibold">{format(goodsTotal, currency)}</span>
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold">
              {t("viewCart")}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        </div>
      )}
    </BuyerShell>
  );
}
