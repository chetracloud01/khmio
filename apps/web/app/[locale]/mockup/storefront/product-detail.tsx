"use client";

import { formatKhr, formatUsd, maxOrderQuantity } from "@khmio/shared";
import { BottomSheet, Button, cn, DiscountBadge, PriceTag } from "@khmio/ui";
import { Check, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { getDiscountedUnitAmount, getUnitKhr, getUnitUsdCents, lineKey, type MockProduct } from "@/mock/mock-data";
import { useCart } from "../cart-context";
import { useOnlineStock } from "../online-stock";
import { shareOrCopyLink } from "@/components/share-link";
import { StockNote } from "@/components/buyer/stock-note";
import { Stepper } from "../shared-ui";
import { useStoreSettings } from "../store-settings-context";

/** Swipe on a phone, arrows with a mouse. Products without photos show their colour block. */
function PhotoCarousel({
  photos,
  fallbackColor,
  dimmed,
  previousLabel,
  nextLabel,
  positionLabel,
}: {
  photos: string[];
  fallbackColor: string;
  dimmed: boolean;
  previousLabel: string;
  nextLabel: string;
  positionLabel: (current: number, total: number) => string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return <div className={cn("aspect-[3/2] w-full md:aspect-square rounded-DEFAULT", fallbackColor, dimmed && "opacity-40 grayscale")} />;
  }

  function goTo(next: number) {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  }

  const arrow =
    "absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/85 text-fg shadow-card backdrop-blur disabled:opacity-0 sm:flex";

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={(event) => {
          const track = event.currentTarget;
          setIndex(Math.round(track.scrollLeft / track.clientWidth));
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-DEFAULT"
      >
        {photos.map((photo, photoIndex) => (
          // eslint-disable-next-line @next/next/no-img-element -- merchant's own upload preview, not a remote image
          <img
            key={photoIndex}
            src={photo}
            alt=""
            className={cn("aspect-[3/2] w-full md:aspect-square shrink-0 snap-center object-cover", dimmed && "opacity-40 grayscale")}
          />
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" aria-label={previousLabel} disabled={index === 0} onClick={() => goTo(index - 1)} className={cn(arrow, "left-2")}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={nextLabel}
            disabled={index === photos.length - 1}
            onClick={() => goTo(index + 1)}
            className={cn(arrow, "right-2")}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden="true">
            {photos.map((_, dotIndex) => (
              <span
                key={dotIndex}
                className={cn("h-1.5 rounded-full shadow-card transition-all motion-reduce:transition-none", dotIndex === index ? "w-4 bg-bg" : "w-1.5 bg-bg/60")}
              />
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            {positionLabel(index + 1, photos.length)}
          </span>
        </>
      )}
    </div>
  );
}

// Buyer's product page (design/screens.md B2): a bottom sheet on a phone, a
// centred window from tablet up. The buyer picks an option and a quantity
// here, and nothing reaches the cart until the button is pressed.
export function ProductDetail({ product, onClose }: { product: MockProduct; onClose: () => void }) {
  const t = useTranslations("Storefront");
  const locale = useLocale();
  const { quantities, setQuantities, currency } = useCart();
  const { rate } = useStoreSettings();
  const { stateFor } = useOnlineStock();

  const title = locale === "km" ? product.titleKm : product.titleEn;
  const description = (locale === "km" ? product.descriptionKm || product.descriptionEn : product.descriptionEn || product.descriptionKm) ?? "";
  const variants = product.variants ?? [];
  const inCartOf = (variantId?: string) => quantities[lineKey(product.id, variantId)] ?? 0;

  // Opens on what the buyer already has in the cart, else on the first option still in stock.
  const [variantId, setVariantId] = useState<string | undefined>(
    () =>
      (
        variants.find((variant) => inCartOf(variant.id) > 0) ??
        variants.find((variant) => stateFor(product.id, variant.id).kind !== "sold_out") ??
        variants[0]
      )?.id,
  );
  const variant = variants.find((item) => item.id === variantId);
  const key = lineKey(product.id, variantId);
  const inCart = inCartOf(variantId);
  const [qty, setQty] = useState(inCart > 0 ? inCart : 1);
  const [expanded, setExpanded] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "manual">("idle");

  const stock = stateFor(product.id, variantId);
  const max = maxOrderQuantity(stock);
  const soldOut = stock.kind === "sold_out";
  // Already in the cart: the stepper may go to 0, which takes it out again.
  const min = inCart > 0 ? 0 : 1;
  const chosenQty = max === null ? qty : Math.min(qty, max);

  const format = (amount: number) => (currency === "USD" ? formatUsd(amount) : formatKhr(amount));
  const unitAmount = getDiscountedUnitAmount(product, currency, rate, variant) ?? 0;
  // One line, already rounded per unit — the same number the cart will show.
  const amount = format(unitAmount * chosenQty);

  const longDescription = description.length > 140 || description.split("\n").length > 3;
  const shareUrl = () => `${window.location.origin}/${locale}/mockup/storefront?product=${encodeURIComponent(product.id)}`;

  function selectVariant(id: string) {
    setVariantId(id);
    const already = inCartOf(id);
    setQty(already > 0 ? already : 1);
  }

  function handleSubmit() {
    setQuantities((prev) => ({ ...prev, [key]: chosenQty }));
    onClose();
  }

  async function handleShare() {
    const outcome = await shareOrCopyLink(title, shareUrl());
    if (outcome === "manual") setShareState("manual");
    if (outcome === "copied") {
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    }
  }

  const buttonLabel =
    soldOut && inCart === 0
      ? t("soldOut")
      : inCart > 0 && chosenQty === 0
        ? t("removeFromCart")
        : inCart > 0
          ? t("updateCart", { amount })
          : t("addToCart", { amount });

  return (
    <BottomSheet
      open
      onClose={onClose}
      closeLabel={t("close")}
      title={title}
      placement="center"
      wide
      footer={
        <Button variant="primary" className="w-full" onClick={handleSubmit} disabled={soldOut && inCart === 0}>
          {buttonLabel}
        </Button>
      }
    >
      {/* Phone: photo on top. Tablet and desktop: photo on the left, details on the right. */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start md:gap-6">
        <div className="relative">
          <PhotoCarousel
            photos={product.photoDataUrls ?? []}
            fallbackColor={product.photoColor}
            dimmed={soldOut}
            previousLabel={t("previousPhoto")}
            nextLabel={t("nextPhoto")}
            positionLabel={(current, total) => t("photoPosition", { current, total })}
          />
          {product.discountPercent ? <DiscountBadge percent={product.discountPercent} className="absolute left-2 top-2" /> : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">

          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <PriceTag
                usdCents={getUnitUsdCents(product, variant)}
                khr={getUnitKhr(product, variant)}
                originalUsdCents={product.discountPercent ? (variant ?? product).retailPriceUsdCents : undefined}
                originalKhr={product.discountPercent ? (variant ?? product).retailPriceKhr : undefined}
                primary={currency}
                className="text-lg"
              />
              <StockNote state={stock} labels={{ soldOut: t("soldOut"), onlyLeft: (count) => t("onlyLeft", { count }) }} />
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="flex min-h-touch shrink-0 items-center gap-2 rounded-full border border-border px-3 text-sm font-medium"
            >
              {shareState === "copied" ? (
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden="true" />
              )}
              {shareState === "copied" ? t("linkCopied") : t("share")}
            </button>
            <span className="sr-only" role="status">
              {shareState === "copied" ? t("linkCopied") : ""}
            </span>
          </div>

          {shareState === "manual" && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted">{t("copyLinkManually")}</span>
              <input
                readOnly
                value={shareUrl()}
                onFocus={(event) => event.currentTarget.select()}
                className="min-h-touch w-full rounded-DEFAULT border border-border bg-bg px-3 text-base text-fg"
              />
            </label>
          )}

          {description && (
            <div className="flex flex-col items-start">
              <p className={cn("whitespace-pre-line text-sm leading-relaxed text-muted", longDescription && !expanded && "line-clamp-3")}>
                {description}
              </p>
              {longDescription && (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  aria-expanded={expanded}
                  className="flex min-h-touch items-center text-sm font-medium text-brand"
                >
                  {expanded ? t("showLess") : t("showMore")}
                </button>
              )}
            </div>
          )}

          {variants.length > 0 && (
            <div className="flex flex-col gap-2">
              <p id={`options-${product.id}`} className="text-sm font-medium">
                {t("chooseOption")}
              </p>
              <div role="radiogroup" aria-labelledby={`options-${product.id}`} className="flex flex-wrap gap-2">
                {variants.map((option) => {
                  const optionStock = stateFor(product.id, option.id);
                  const optionSoldOut = optionStock.kind === "sold_out";
                  const optionInCart = inCartOf(option.id);
                  const selected = option.id === variantId;
                  const price = getDiscountedUnitAmount(product, currency, rate, option);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      // A sold-out option stays tappable only to let the buyer take it out of the cart.
                      disabled={optionSoldOut && optionInCart === 0}
                      onClick={() => selectVariant(option.id)}
                      className={cn(
                        "flex min-h-touch min-w-[88px] flex-col items-start justify-center rounded-DEFAULT border px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        selected ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-border",
                      )}
                    >
                      <span className="text-sm font-medium">{locale === "km" ? option.labelKm : option.labelEn}</span>
                      <span className="text-xs tabular-nums text-muted">{price != null ? format(price) : ""}</span>
                      {optionSoldOut ? (
                        <span className="text-xs font-semibold text-danger">{t("soldOut")}</span>
                      ) : optionInCart > 0 ? (
                        <span className="text-xs font-medium text-brand">{t("inCart", { count: optionInCart })}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!(soldOut && inCart === 0) && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{t("quantity")}</span>
              <Stepper
                qty={chosenQty}
                onDecrease={() => setQty(Math.max(min, chosenQty - 1))}
                onIncrease={() => setQty(chosenQty + 1)}
                decreaseLabel={t("decrease", { title })}
                increaseLabel={t("increase", { title })}
                increaseDisabled={max !== null && chosenQty >= max}
                className="w-36"
              />
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
