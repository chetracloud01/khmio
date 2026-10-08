"use client";

import type { Currency } from "@khmio/shared";
import { Button, Card, cn, DiscountBadge, PriceTag, SearchInput, SegmentedControl, ThemeSwitcher } from "@khmio/ui";
import { Check, ChevronLeft, ChevronRight, ImageOff, SearchX, Share2, ShoppingBag, Store, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BuyerColumns, BuyerShell } from "@/components/buyer-shell";
import { CartPanel } from "@/components/buyer/cart-panel";
import { ShopHero } from "@/components/buyer/shop-hero";
import { formatMoney } from "@/components/order-ui";
import { useThemeLabels } from "@/components/use-theme-labels";
import { shareOrCopyLink } from "@/components/share-link";
import type { Product, ProductVariant, PublicShop } from "@/lib/api";
import { cartLines, cartTotal, useShopCart } from "@/lib/cart";
import { discounted, startingVariant } from "@/lib/product-price";
import { isTakingOrders } from "@/lib/shop-ordering";
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
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  // The open product lives in the link (?product=…), so one product can be shared and Back closes it.
  const productParam = useSearchParams().get("product");
  const open = productParam ? (products.find((product) => product.id === productParam) ?? null) : null;
  // The browser's own history (Next keeps useSearchParams in step): no trip to the server on every open.
  const setOpen = (product: Product | null) => window.history.replaceState(null, "", product ? `${pathname}?product=${encodeURIComponent(product.id)}` : pathname);
  const cart = useShopCart(store.slug);
  const ordering = isTakingOrders(shop);
  const currency: Currency = cart.currency ?? store.defaultCurrency;

  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);
  // Only categories with something to buy get a chip.
  const shownCategories = categories.filter((entry) => products.some((product) => product.categoryId === entry.id));
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    // Both languages: a buyer may type "coffee" on the Khmer page.
    return products.filter(
      (product) => (category === "all" || product.categoryId === category) && `${product.titleKm} ${product.titleEn}`.toLowerCase().includes(words),
    );
  }, [products, category, query]);

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

        <div className="sticky top-0 z-20 flex flex-col gap-2 border-b border-border bg-bg py-2">
          <div className="px-4">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
              clearLabel={t("clearSearch")}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
            />
          </div>
          {shownCategories.length > 1 && (
            <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4">
              {[{ id: "all", label: t("categoryAll") }, ...shownCategories.map((entry) => ({ id: entry.id, label: text(entry.nameKm, entry.nameEn) }))].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setCategory(chip.id)}
                  aria-pressed={category === chip.id}
                  className={cn(
                    "min-h-touch shrink-0 snap-start whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors",
                    category === chip.id ? "border-brand bg-brand text-on-brand" : "border-border bg-bg text-muted hover:text-fg",
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {shown.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            {shown.map((product) => (
              <ProductCard
                key={product.id}
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
            <p className="text-sm text-muted">{query.trim() ? t("noResultsFor", { query: query.trim() }) : t("noProducts")}</p>
            {(query || category !== "all") && (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
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

/** − 2 + : the buyer's quantity, 44px buttons. */
function Stepper({ quantity, title, onAdjust }: { quantity: number; title: string; onAdjust: (delta: number) => void }) {
  const t = useTranslations("Storefront");
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={t("decrease", { title })}
        onClick={() => onAdjust(-1)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-lg font-bold text-muted transition-transform active:scale-95"
      >
        −
      </button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={t("increase", { title })}
        onClick={() => onAdjust(1)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg font-bold text-on-brand transition-transform active:scale-95"
      >
        +
      </button>
    </div>
  );
}

function ProductCard({
  product,
  title,
  shop,
  currency,
  ordering,
  quantity,
  onOpen,
  onAdjust,
}: {
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
  return (
    <Card className="flex h-full flex-col gap-2 p-2">
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col gap-2 text-left">
        <span className="relative block">
          {product.photos[0] ? (
            <PhotoThumb photo={product.photos[0]} lazy className="aspect-square w-full rounded-DEFAULT object-cover" />
          ) : (
            <span className="flex aspect-square w-full items-center justify-center rounded-DEFAULT bg-border/30">
              <ImageOff className="h-6 w-6 text-muted" aria-hidden="true" />
            </span>
          )}
          {product.discountPercent ? <DiscountBadge percent={product.discountPercent} className="absolute left-1 top-1" /> : null}
        </span>
        <span className="line-clamp-2 text-sm font-medium">{title}</span>
        {product.hasOptions && <span className="text-xs text-muted">{t("startingFrom")}</span>}
        {variant && <VariantPrice product={product} variant={variant} currency={currency} />}
      </button>
      {ordering &&
        (product.hasOptions ? (
          <Button variant={quantity > 0 ? "secondary" : "primary"} className="w-full" onClick={onOpen}>
            {quantity > 0 ? t("inCart", { count: quantity }) : t("chooseOption")}
          </Button>
        ) : quantity > 0 ? (
          <div className="flex justify-center">
            <Stepper quantity={quantity} title={title} onAdjust={onAdjust} />
          </div>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => onAdjust(1)}>
            {t("add")}
          </Button>
        ))}
    </Card>
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
                  {ordering &&
                    (quantity > 0 ? (
                      <Stepper quantity={quantity} title={label} onAdjust={(delta) => onSetQuantity(variant.id, quantity + delta)} />
                    ) : (
                      <Button variant="primary" onClick={() => onSetQuantity(variant.id, 1)}>
                        {t("add")}
                      </Button>
                    ))}
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
