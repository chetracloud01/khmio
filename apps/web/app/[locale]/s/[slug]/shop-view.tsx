"use client";

import type { Currency } from "@khmio/shared";
import { Button, PriceTag, SegmentedControl, ThemeSwitcher } from "@khmio/ui";
import { Check, ChevronLeft, ChevronRight, ImageOff, SearchX, Share2, ShoppingBag, Store, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BuyerColumns, BuyerShell } from "@/components/buyer-shell";
import { CartPanel } from "@/components/buyer/cart-panel";
import { BrowseToolbar } from "@/components/buyer/browse-toolbar";
import { ProductTile, type ProductView } from "@/components/buyer/product-tile";
import { QuantityControl } from "@/components/buyer/quantity-control";
import { ShopHero } from "@/components/buyer/shop-hero";
import { useProductBrowse, type BrowseAccessors } from "@/components/buyer/use-product-browse";
import { formatMoney } from "@/components/order-ui";
import { useThemeLabels } from "@/components/use-theme-labels";
import { shareOrCopyLink } from "@/components/share-link";
import type { Product, ProductVariant, PublicShop } from "@/lib/api";
import { cartLines, cartTotal, useShopCart } from "@/lib/cart";
import { discounted, startingVariant, usdValue } from "@/lib/product-price";
import { isTakingOrders } from "@/lib/shop-ordering";
import { BuyerOrderLinks } from "@/components/invoice/track-order-card";
import { ShopInfo } from "./shop-info";
import { PhotoThumb } from "@/components/photo-thumb";

// What a buyer sees at /s/<link>: the shop, its categories and its visible
// products, a product's own page for photos, description and options, and
// the cart (kept on the buyer's phone) once the shop takes orders.
export function ShopView({ shop }: { shop: PublicShop }) {
  // A paused shop keeps its link but takes no orders (blueprint "Subscription life cycle").
  if (!shop.open) return <ShopClosed shop={shop} />;
  return <OpenShop shop={shop} />;
}

function ShopClosed({ shop }: { shop: PublicShop }) {
  const t = useTranslations("Storefront");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4 text-fg">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-3 rounded-2xl bg-bg p-8 text-center shadow-card">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-border/30">
          {shop.store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the shop's own uploaded logo
            <img src={shop.store.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Store className="h-8 w-8 text-muted" aria-hidden="true" />
          )}
        </span>
        <h1 className="text-lg font-semibold">{shop.store.name}</h1>
        <p className="text-sm text-muted">{t("temporarilyClosed")}</p>
      </div>
    </div>
  );
}

function OpenShop({ shop }: { shop: PublicShop }) {
  const t = useTranslations("Storefront");
  const tCheckout = useTranslations("Checkout");
  const tCart = useTranslations("Cart");
  const themeLabels = useThemeLabels();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { store, categories, products } = shop;
  // The open product lives in the link (?product=…), so one product can be shared and Back closes it.
  const productParam = useSearchParams().get("product");
  const open = productParam ? (products.find((product) => product.id === productParam) ?? null) : null;
  // The browser's own history (Next keeps useSearchParams in step): no trip to the server on every open.
  const setOpen = (product: Product | null) => window.history.replaceState(null, "", product ? `${pathname}?product=${encodeURIComponent(product.id)}` : pathname);
  const cart = useShopCart(store.slug);
  const ordering = isTakingOrders(shop);
  const currency: Currency = cart.currency ?? store.defaultCurrency;

  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);
  // The list's search, category, sort and grid-or-list (shared with the mockup: components/buyer).
  const browseAccessors = useMemo<BrowseAccessors<Product>>(
    () => ({
      text: (product) => `${product.titleKm} ${product.titleEn}`,
      category: (product) => product.categoryId,
      price: (product) => {
        const variant = startingVariant(product, store.usdToKhrRate);
        return variant ? discounted(usdValue(variant, store.usdToKhrRate), product.discountPercent) : 0;
      },
      discount: (product) => product.discountPercent ?? 0,
    }),
    [store.usdToKhrRate],
  );
  const browse = useProductBrowse(products, browseAccessors, store.slug);
  const browseCategories = categories.map((entry) => ({ id: entry.id, label: text(entry.nameKm, entry.nameEn) }));

  const lines = cart.ready ? cartLines(shop, cart.quantities) : [];
  const goods = lines.length ? cartTotal(shop, lines, currency, null) : null;

  const logo = store.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- the shop's own uploaded logo
    <img src={store.logoUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    store.name.charAt(0).toUpperCase()
  );

  const cartHref = `/${locale}/s/${store.slug}/cart`;
  // Each line's amount from the same shared calculation as the cart and checkout.
  const lineAmounts = new Map(goods?.lines.map((line) => [line.key, line.lineTotal]) ?? []);
  const panelLines = lines.map((line) => ({
    key: line.variant.id,
    name: line.product.variants.length > 1 ? `${text(line.product.titleKm, line.product.titleEn)} · ${text(line.variant.labelKm, line.variant.labelEn)}` : text(line.product.titleKm, line.product.titleEn),
    qty: line.quantity,
    amount: formatMoney(lineAmounts.get(line.variant.id) ?? 0, currency),
  }));

  return (
    <BuyerShell wide className="pb-32 lg:pb-0">
      <BuyerColumns
        aside={
          ordering ? (
            <CartPanel
              title={tCart("yourCart")}
              lines={panelLines}
              totalLabel={t("goodsTotal")}
              total={formatMoney(goods?.goods ?? 0, currency)}
              checkoutHref={cartHref}
              checkoutLabel={tCart("checkout")}
              emptyText={t("panelEmpty")}
            />
          ) : undefined
        }
      >
        <ShopHero
          name={store.name}
          logo={logo}
          openLabel={t("openNow")}
          controls={
            <>
              <SegmentedControl
                value={locale}
                onChange={(next) => router.replace(pathname.replace(/^\/(km|en)/, `/${next}`))}
                options={[
                  { value: "km", label: "ខ្មែរ" },
                  { value: "en", label: "EN" },
                ]}
              />
              <ThemeSwitcher labels={themeLabels} />
            </>
          }
          facts={store.description ? <span>{store.description}</span> : undefined}
          info={
            <div className="flex flex-col gap-2">
              <ShopInfo shop={shop} currency={currency} />
              {!ordering && <p className="rounded-DEFAULT bg-info/5 p-3 text-sm text-muted">{tCheckout("noPaymentMethods")}</p>}
            </div>
          }
        />

        {/* For buyers without Telegram: their tracking code and phone open the order again (design/screens.md B8). */}
        <div className="px-4 pb-3">
          <BuyerOrderLinks myOrdersHref={`/${locale}/orders`} trackHref={`/${locale}/track`} />
        </div>

        <BrowseToolbar browse={browse} categories={browseCategories} />

        {browse.shown.length > 0 ? (
          <div className={browse.view === "grid" ? "grid grid-cols-2 gap-3 p-4 sm:grid-cols-3" : "flex flex-col gap-3 p-4"}>
            {browse.shown.map((product) => (
              <ShopProductTile
                key={product.id}
                view={browse.view}
                product={product}
                title={text(product.titleKm, product.titleEn)}
                shop={shop}
                currency={currency}
                ordering={ordering}
                quantity={product.variants.reduce((sum, variant) => sum + (cart.quantities[variant.id] ?? 0), 0)}
                onOpen={() => setOpen(product)}
                onAdjust={(delta) => {
                  const variant = product.variants[0];
                  if (variant) cart.setQuantity(variant.id, (cart.quantities[variant.id] ?? 0) + delta);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-border/30">
              <SearchX className="h-7 w-7 text-muted" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted">{browse.query.trim() ? t("noResultsFor", { query: browse.query.trim() }) : t("noProducts")}</p>
            {(browse.query || browse.category !== "all") && (
              <Button
                variant="secondary"
                onClick={() => {
                  browse.setQuery("");
                  browse.setCategory("all");
                }}
              >
                {t("showAllProducts")}
              </Button>
            )}
          </div>
        )}
      </BuyerColumns>

      {open && (
        <ProductSheet
          product={open}
          title={text(open.titleKm, open.titleEn)}
          description={text(open.descriptionKm, open.descriptionEn)}
          shop={shop}
          ordering={ordering}
          quantities={cart.quantities}
          onSetQuantity={cart.setQuantity}
          onClose={() => setOpen(null)}
        />
      )}

      {ordering && goods && goods.itemCount > 0 && !open && (
        <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pt-3 lg:hidden">
          <Link
            key={goods.itemCount}
            href={cartHref}
            className="pointer-events-auto mx-auto flex min-h-[56px] w-full max-w-[520px] animate-bump items-center justify-between gap-3 rounded-2xl bg-brand px-4 py-2 text-on-brand shadow-raised motion-reduce:animate-none"
          >
            <span className="flex items-center gap-3">
              <span className="relative">
                <ShoppingBag className="h-6 w-6" aria-hidden="true" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-bg px-1 text-xs font-bold text-brand">{goods.itemCount}</span>
              </span>
              <span className="flex flex-col items-start">
                <span className="text-xs opacity-90">{t("itemCount", { count: goods.itemCount })}</span>
                <span className="text-base font-semibold">{formatMoney(goods.goods, currency)}</span>
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

function VariantPrice({ product, variant, currency }: { product: Product; variant: ProductVariant; currency: Currency }) {
  return (
    <PriceTag
      primary={currency}
      usdCents={variant.priceUsdCents != null ? discounted(variant.priceUsdCents, product.discountPercent) : undefined}
      khr={variant.priceKhr != null ? discounted(variant.priceKhr, product.discountPercent) : undefined}
      originalUsdCents={product.discountPercent ? (variant.priceUsdCents ?? undefined) : undefined}
      originalKhr={product.discountPercent ? (variant.priceKhr ?? undefined) : undefined}
    />
  );
}

/** One product in the list, as the shared tile draws it (components/buyer/product-tile). */
function ShopProductTile({
  view,
  product,
  title,
  shop,
  currency,
  ordering,
  quantity,
  onOpen,
  onAdjust,
}: {
  view: ProductView;
  product: Product;
  title: string;
  shop: PublicShop;
  currency: Currency;
  ordering: boolean;
  quantity: number;
  onOpen: () => void;
  onAdjust: (delta: number) => void;
}) {
  const t = useTranslations("Storefront");
  const variant = startingVariant(product, shop.store.usdToKhrRate);
  const optionCount = product.hasOptions ? product.variants.length : 0;
  return (
    <ProductTile
      view={view}
      title={title}
      photo={product.photos[0] ? <PhotoThumb photo={product.photos[0]} lazy className="h-full w-full object-cover" /> : null}
      discountPercent={product.discountPercent}
      optionCount={optionCount}
      price={variant ? <VariantPrice product={product} variant={variant} currency={currency} /> : null}
      quantity={quantity}
      ordering={ordering}
      labels={{
        add: t("addTitle", { title }),
        decrease: t("decrease", { title }),
        increase: t("increase", { title }),
        from: t("startingFrom"),
        options: t("optionCount", { count: optionCount }),
        inCart: t("inCart", { count: quantity }),
        soldOut: t("soldOut"),
      }}
      onOpen={onOpen}
      onAdjust={onAdjust}
    />
  );
}

/** The product's own page, as a sheet over the shop: photos, description, and each option with its own quantity. */
function ProductSheet({
  product,
  title,
  description,
  shop,
  ordering,
  quantities,
  onSetQuantity,
  onClose,
}: {
  product: Product;
  title: string;
  description: string;
  shop: PublicShop;
  ordering: boolean;
  quantities: Record<string, number>;
  onSetQuantity: (variantId: string, quantity: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Storefront");
  const locale = useLocale();
  const [photo, setPhoto] = useState(0);
  const count = product.photos.length;
  const currency = shop.store.defaultCurrency;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-fg/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-[560px] flex-col overflow-y-auto rounded-t-2xl bg-bg pb-safe sm:rounded-2xl"
      >
        <div className="relative">
          {count > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element -- the seller's uploaded photo
            <img src={product.photos[photo]?.url} alt="" className="aspect-square w-full object-cover sm:rounded-t-2xl" />
          ) : (
            <span className="flex aspect-[2/1] w-full items-center justify-center bg-border/30">
              <ImageOff className="h-8 w-8 text-muted" aria-hidden="true" />
            </span>
          )}
          <button type="button" onClick={onClose} aria-label={t("close")} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-bg/85 shadow-card">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          {count > 1 && (
            <>
              <button type="button" onClick={() => setPhoto((photo + count - 1) % count)} aria-label={t("previousPhoto")} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/85 shadow-card">
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setPhoto((photo + 1) % count)} aria-label={t("nextPhoto")} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/85 shadow-card">
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-fg/70 px-2 py-0.5 text-xs text-bg">{t("photoPosition", { current: photo + 1, total: count })}</span>
            </>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold leading-normal">{title}</h2>
            <ShareProduct title={title} />
          </div>
          {description && <p className="whitespace-pre-line text-sm text-muted">{description}</p>}
          <ul className="flex flex-col gap-2">
            {product.variants.map((variant) => {
              const label = product.hasOptions ? (locale === "km" ? variant.labelKm || variant.labelEn : variant.labelEn || variant.labelKm) : title;
              const quantity = quantities[variant.id] ?? 0;
              return (
                <li key={variant.id} className="flex min-h-touch items-center justify-between gap-3 rounded-DEFAULT border border-border px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{label}</span>
                    <VariantPrice product={product} variant={variant} currency={currency} />
                  </span>
                  {ordering && (
                    <QuantityControl
                      quantity={quantity}
                      addLabel={t("addTitle", { title: label })}
                      decreaseLabel={t("decrease", { title: label })}
                      increaseLabel={t("increase", { title: label })}
                      onChange={(next) => onSetQuantity(variant.id, next)}
                      className="shrink-0"
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {ordering && product.variants.some((variant) => (quantities[variant.id] ?? 0) > 0) && (
            <Button variant="secondary" className="w-full" onClick={onClose}>
              {t("close")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shares this product's own link (the shop link with ?product=…), for a Facebook or TikTok post. */
function ShareProduct({ title }: { title: string }) {
  const t = useTranslations("Storefront");
  const [done, setDone] = useState(false);
  async function share() {
    const outcome = await shareOrCopyLink(title, window.location.href);
    if (outcome === "shared" || outcome === "copied") setDone(true);
  }
  return (
    <button type="button" onClick={() => void share()} aria-label={t("share")} className="flex h-11 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-sm font-medium hover:bg-border/10">
      {done ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      {done ? t("linkCopied") : t("share")}
    </button>
  );
}
