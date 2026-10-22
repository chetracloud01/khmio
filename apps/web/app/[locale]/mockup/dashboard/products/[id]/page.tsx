"use client";

import {
  canAddProduct,
  getMinimumPlanFor,
  getMinimumPlanForProductCount,
  MAX_PRODUCT_DESCRIPTION_LENGTH,
  parseKhrInput,
  parseUsdInput,
  planHasFeature,
  productInputSchema,
  toFieldErrors,
  usdInputText,
  type FormErrorCode,
  type ProductFormInput,
} from "@khmio/shared";
import { Button, Card, Input, Select, Switch, Textarea } from "@khmio/ui";
import { History, Languages, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { MoneyInput } from "@/components/money-input";
import { FormActions, FormSection, focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { mockBusinessTypeDefaults, slugify, type MockProduct, type MockVariant } from "@/mock/mock-data";
import { useMerchantProducts } from "../../../merchant-products-context";
import { useMerchantProfile } from "../../../merchant-profile-context";
import { useMerchantSubscription } from "../../../merchant-subscription-context";
import { useStoreSettings } from "../../../store-settings-context";
import { UpgradePrompt } from "../../upgrade-prompt";

const NEW_VALUE = "__new__";
const MAX_PHOTOS = 6;

interface VariantDraft {
  id: string;
  labelKm: string;
  labelEn: string;
  sku: string;
  retailUsd: string;
  retailKhr: string;
  wholesaleUsd: string;
  wholesaleKhr: string;
}

let draftCounter = 0;
/** Unique across page loads too: a restored draft keeps the option ids it was saved with. */
function nextDraftId(): string {
  draftCounter += 1;
  return `draft-${Date.now()}-${draftCounter}`;
}

// A new product is kept on this device while it's being typed, so a phone
// call or a closed tab doesn't lose it. Photos are left out: they're too big
// for browser storage. The real app saves the draft (photos included) on the server.
const DRAFT_STORAGE_KEY = "khmio:mockup-product-draft";

interface ProductDraft {
  titleKm: string;
  titleEn: string;
  descriptionKm: string;
  descriptionEn: string;
  visible: boolean;
  categoryId: string;
  brandId: string;
  uomId: string;
  retailUsd: string;
  retailKhr: string;
  wholesaleUsd: string;
  wholesaleKhr: string;
  discountPercent: string;
  variantDrafts: VariantDraft[];
}

function readDraft(): Partial<ProductDraft> | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<ProductDraft>) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Storage unavailable — there was no draft to clear.
  }
}

/** Blank discount box = no discount; anything else must read as a whole number (the schema checks the range). */
function parseDiscountInput(text: string): number | undefined {
  const value = text.trim();
  if (!value) return undefined;
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

function NewEntryForm({
  kmLabel,
  enLabel,
  km,
  en,
  onKmChange,
  onEnChange,
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel,
}: {
  kmLabel: string;
  enLabel: string;
  km: string;
  en: string;
  onKmChange: (value: string) => void;
  onEnChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  cancelLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-DEFAULT border border-dashed border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <Input label={kmLabel} value={km} onChange={(e) => onKmChange(e.target.value)} />
        <Input label={enLabel} value={en} onChange={(e) => onEnChange(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} className="w-full">
          {cancelLabel}
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={!km.trim() || !en.trim()} className="w-full">
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

// The form copies saved values into its own state once, when it mounts — so
// it must not mount until saved data has loaded, or it starts empty and a
// save would overwrite the real product with blanks.
export default function DashboardProductFormMockupPage() {
  const t = useTranslations("ProductForm");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const tUp = useTranslations("Upgrade");
  const { hydrated: productsReady, products } = useMerchantProducts();
  const { hydrated: profileReady } = useMerchantProfile();
  const { hydrated: subscriptionReady, subscription } = useMerchantSubscription();
  // "Discard draft" starts the form again from blank.
  const [resetCount, setResetCount] = useState(0);

  if (!productsReady || !profileReady || !subscriptionReady) return null;

  if (params.id === "new" && !canAddProduct(subscription.plan, products.length)) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-5 p-4 text-fg">
        <h1 className="text-lg font-semibold">{t("newTitle")}</h1>
        <UpgradePrompt
          title={tUp("productLimitTitle", { count: products.length })}
          body={tUp("productLimitBody")}
          plan={getMinimumPlanForProductCount(products.length)}
        />
      </div>
    );
  }

  if (params.id !== "new" && !products.some((product) => product.id === params.id)) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-3 p-4 pt-16 text-center text-fg">
        <p className="font-semibold">{t("notFound")}</p>
        <Link href={`/${locale}/mockup/dashboard/products`}>
          <Button variant="secondary">{t("backToProducts")}</Button>
        </Link>
      </div>
    );
  }

  return <ProductForm key={`${params.id}-${resetCount}`} onReset={() => setResetCount((count) => count + 1)} />;
}

function ProductForm({ onReset }: { onReset: () => void }) {
  const t = useTranslations("ProductForm");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const {
    products,
    addProduct,
    updateProduct,
    categories,
    addCategory,
    brands,
    addBrand,
    uoms,
    addUom,
  } = useMerchantProducts();
  const { businessType } = useMerchantProfile();
  const { rate } = useStoreSettings();
  const tUp = useTranslations("Upgrade");
  const { subscription } = useMerchantSubscription();
  // Hidden, not cleared: any wholesale prices already saved stay in state and
  // are written back unchanged on save, so they return after an upgrade.
  const canWholesale = planHasFeature(subscription.plan, "wholesalePrice");
  const wholesaleLockedPrompt = (
    <UpgradePrompt compact title={tUp("wholesaleTitle")} plan={getMinimumPlanFor("wholesalePrice")} />
  );

  const isNew = params.id === "new";
  const existingProduct = useMemo(() => products.find((p) => p.id === params.id), [products, params.id]);

  const [photos, setPhotos] = useState<string[]>(existingProduct?.photoDataUrls ?? []);
  const [titleKm, setTitleKm] = useState(existingProduct?.titleKm ?? "");
  const [titleEn, setTitleEn] = useState(existingProduct?.titleEn ?? "");
  const [descriptionKm, setDescriptionKm] = useState(existingProduct?.descriptionKm ?? "");
  const [descriptionEn, setDescriptionEn] = useState(existingProduct?.descriptionEn ?? "");
  const [visible, setVisible] = useState(!existingProduct?.isHidden);
  const [draftRestored, setDraftRestored] = useState(false);
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const errorText = useFormErrorText();
  const formRef = useRef<HTMLDivElement>(null);
  const [translating, setTranslating] = useState(false);

  const [categoryId, setCategoryId] = useState(existingProduct?.categoryId ?? categories[0]?.id ?? "");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryKm, setNewCategoryKm] = useState("");
  const [newCategoryEn, setNewCategoryEn] = useState("");

  const [brandId, setBrandId] = useState(existingProduct?.brandId ?? "");
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrandKm, setNewBrandKm] = useState("");
  const [newBrandEn, setNewBrandEn] = useState("");

  const defaultUomId = mockBusinessTypeDefaults[businessType].uomId;
  const [uomId, setUomId] = useState(
    existingProduct?.uomId ?? (uoms.some((uom) => uom.id === defaultUomId) ? defaultUomId : (uoms[0]?.id ?? "")),
  );
  const [addingUom, setAddingUom] = useState(false);
  const [newUomKm, setNewUomKm] = useState("");
  const [newUomEn, setNewUomEn] = useState("");

  const [retailUsd, setRetailUsd] = useState(usdInputText(existingProduct?.retailPriceUsdCents));
  const [retailKhr, setRetailKhr] = useState(existingProduct?.retailPriceKhr?.toString() ?? "");
  const [wholesaleUsd, setWholesaleUsd] = useState(usdInputText(existingProduct?.wholesalePriceUsdCents));
  const [wholesaleKhr, setWholesaleKhr] = useState(existingProduct?.wholesalePriceKhr?.toString() ?? "");
  const [discountPercent, setDiscountPercent] = useState(existingProduct?.discountPercent?.toString() ?? "");

  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>(
    existingProduct?.variants?.map((variant) => ({
      id: variant.id,
      labelKm: variant.labelKm,
      labelEn: variant.labelEn,
      sku: variant.sku,
      retailUsd: usdInputText(variant.retailPriceUsdCents),
      retailKhr: variant.retailPriceKhr?.toString() ?? "",
      wholesaleUsd: usdInputText(variant.wholesalePriceUsdCents),
      wholesaleKhr: variant.wholesalePriceKhr?.toString() ?? "",
    })) ?? [],
  );

  const hasVariants = variantDrafts.length > 0;

  // Everything the merchant can change, so Save/Cancel only light up after a real edit.
  const snapshot = JSON.stringify({
    photos,
    titleKm,
    titleEn,
    descriptionKm,
    descriptionEn,
    visible,
    categoryId,
    brandId,
    uomId,
    retailUsd,
    retailKhr,
    wholesaleUsd,
    wholesaleKhr,
    discountPercent,
    variantDrafts,
  });
  const [savedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  // A new product picks up where the seller left off.
  useEffect(() => {
    if (!isNew) return;
    const draft = readDraft();
    if (!draft) return;
    const text = (value: unknown, apply: (next: string) => void) => {
      if (typeof value === "string") apply(value);
    };
    text(draft.titleKm, setTitleKm);
    text(draft.titleEn, setTitleEn);
    text(draft.descriptionKm, setDescriptionKm);
    text(draft.descriptionEn, setDescriptionEn);
    if (typeof draft.visible === "boolean") setVisible(draft.visible);
    text(draft.categoryId, (id) => {
      if (categories.some((category) => category.id === id)) setCategoryId(id);
    });
    text(draft.brandId, setBrandId);
    text(draft.uomId, setUomId);
    text(draft.retailUsd, setRetailUsd);
    text(draft.retailKhr, setRetailKhr);
    text(draft.wholesaleUsd, setWholesaleUsd);
    text(draft.wholesaleKhr, setWholesaleKhr);
    text(draft.discountPercent, setDiscountPercent);
    if (Array.isArray(draft.variantDrafts)) setVariantDrafts(draft.variantDrafts);
    setDraftRestored(true);
    // Runs once, when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // …and is saved a moment after each change.
  useEffect(() => {
    if (!isNew || !dirty) return;
    const timer = setTimeout(() => {
      const draft: ProductDraft = {
        titleKm,
        titleEn,
        descriptionKm,
        descriptionEn,
        visible,
        categoryId,
        brandId,
        uomId,
        retailUsd,
        retailKhr,
        wholesaleUsd,
        wholesaleKhr,
        discountPercent,
        variantDrafts,
      };
      try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // Storage full or unavailable — the draft just isn't kept this time.
      }
    }, 400);
    return () => clearTimeout(timer);
    // The snapshot changes whenever any of the fields above does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, dirty, snapshot]);

  const error = (key: string) => errorText(errors[key]);

  function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () =>
        setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, reader.result as string]));
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // Mocks a real translation API — there's no backend to call yet, so this
  // just marks where that result would land once one exists.
  function handleAutoTranslate() {
    if (!titleKm.trim()) return;
    setTranslating(true);
    setTimeout(() => {
      setTitleEn((prev) => prev || titleKm);
      setTranslating(false);
    }, 700);
  }

  function handleCategoryChange(value: string) {
    if (value === NEW_VALUE) {
      setAddingCategory(true);
      return;
    }
    setCategoryId(value);
  }

  function handleAddCategory() {
    if (!newCategoryKm.trim() || !newCategoryEn.trim()) return;
    const id = slugify(newCategoryEn) || slugify(newCategoryKm);
    addCategory({ id, labelKm: newCategoryKm.trim(), labelEn: newCategoryEn.trim() });
    setCategoryId(id);
    setNewCategoryKm("");
    setNewCategoryEn("");
    setAddingCategory(false);
  }

  function handleBrandChange(value: string) {
    if (value === NEW_VALUE) {
      setAddingBrand(true);
      return;
    }
    setBrandId(value);
  }

  function handleAddBrand() {
    if (!newBrandKm.trim() || !newBrandEn.trim()) return;
    const id = slugify(newBrandEn) || slugify(newBrandKm);
    addBrand({ id, nameKm: newBrandKm.trim(), nameEn: newBrandEn.trim() });
    setBrandId(id);
    setNewBrandKm("");
    setNewBrandEn("");
    setAddingBrand(false);
  }

  function handleUomChange(value: string) {
    if (value === NEW_VALUE) {
      setAddingUom(true);
      return;
    }
    setUomId(value);
  }

  function handleAddUom() {
    if (!newUomKm.trim() || !newUomEn.trim()) return;
    const id = slugify(newUomEn) || slugify(newUomKm);
    addUom({ id, labelKm: newUomKm.trim(), labelEn: newUomEn.trim() });
    setUomId(id);
    setNewUomKm("");
    setNewUomEn("");
    setAddingUom(false);
  }

  function addVariantRow() {
    setVariantDrafts((prev) => [
      ...prev,
      { id: nextDraftId(), labelKm: "", labelEn: "", sku: "", retailUsd: "", retailKhr: "", wholesaleUsd: "", wholesaleKhr: "" },
    ]);
  }

  function updateVariantRow(id: string, patch: Partial<VariantDraft>) {
    setVariantDrafts((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeVariantRow(id: string) {
    setVariantDrafts((prev) => prev.filter((row) => row.id !== id));
  }

  /**
   * The form as the shared schema sees it. On a plan without wholesale the
   * wholesale boxes are hidden, so they're left out of the check (a problem
   * the merchant can't see would block saving) and re-attached unchanged on save.
   */
  function buildInput(): ProductFormInput {
    const wholesale = (usd: string, khr: string) =>
      canWholesale ? { wholesalePriceUsdCents: parseUsdInput(usd), wholesalePriceKhr: parseKhrInput(khr) } : {};
    return {
      titleKm,
      titleEn,
      descriptionKm,
      descriptionEn,
      isVisible: visible,
      categoryId,
      brandId: brandId || undefined,
      uomId: uomId || undefined,
      discountPercent: parseDiscountInput(discountPercent),
      ...(hasVariants
        ? {
            options: variantDrafts.map((row) => ({
              id: row.id,
              sku: row.sku,
              labelKm: row.labelKm,
              labelEn: row.labelEn,
              retailPriceUsdCents: parseUsdInput(row.retailUsd),
              retailPriceKhr: parseKhrInput(row.retailKhr),
              ...wholesale(row.wholesaleUsd, row.wholesaleKhr),
            })),
          }
        : {
            retailPriceUsdCents: parseUsdInput(retailUsd),
            retailPriceKhr: parseKhrInput(retailKhr),
            ...wholesale(wholesaleUsd, wholesaleKhr),
          }),
    };
  }

  /** On leaving a field: re-check just the fields named, leave every other message alone. */
  function checkFields(...keys: string[]) {
    const result = productInputSchema.safeParse(buildInput());
    const found = result.success ? {} : toFieldErrors(result.error);
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        if (found[key]) next[key] = found[key];
        else delete next[key];
      }
      return next;
    });
  }

  /** Editing a field clears its message until the next check. */
  function clearErrors(...keys: string[]) {
    if (!keys.some((key) => errors[key])) return;
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  function handleSave() {
    const result = productInputSchema.safeParse(buildInput());
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(formRef.current);
      return;
    }
    setErrors({});
    const input = result.data;
    const savedVariant = (id: string) => existingProduct?.variants?.find((variant) => variant.id === id);

    const variants: MockVariant[] | undefined = input.options?.map((option) => ({
      id: option.id,
      sku: option.sku || slugify(`${input.titleEn || input.titleKm}-${option.labelEn || option.labelKm}`).toUpperCase(),
      labelKm: option.labelKm || option.labelEn,
      labelEn: option.labelEn || option.labelKm,
      retailPriceUsdCents: option.retailPriceUsdCents,
      retailPriceKhr: option.retailPriceKhr,
      wholesalePriceUsdCents: canWholesale
        ? option.wholesalePriceUsdCents
        : savedVariant(option.id)?.wholesalePriceUsdCents,
      wholesalePriceKhr: canWholesale ? option.wholesalePriceKhr : savedVariant(option.id)?.wholesalePriceKhr,
    }));

    const product: MockProduct = {
      id: existingProduct?.id ?? `p-${Date.now()}`,
      categoryId: input.categoryId,
      brandId: input.brandId,
      uomId: input.uomId,
      titleKm: input.titleKm,
      titleEn: input.titleEn || input.titleKm,
      descriptionKm: input.descriptionKm || undefined,
      descriptionEn: input.descriptionEn || undefined,
      isHidden: input.isVisible ? undefined : true,
      photoColor: existingProduct?.photoColor ?? "bg-slate-200",
      photoDataUrls: photos.length ? photos : undefined,
      retailPriceUsdCents: variants ? undefined : input.retailPriceUsdCents,
      retailPriceKhr: variants ? undefined : input.retailPriceKhr,
      wholesalePriceUsdCents: variants
        ? undefined
        : canWholesale
          ? input.wholesalePriceUsdCents
          : existingProduct?.wholesalePriceUsdCents,
      wholesalePriceKhr: variants
        ? undefined
        : canWholesale
          ? input.wholesalePriceKhr
          : existingProduct?.wholesalePriceKhr,
      discountPercent: input.discountPercent || undefined,
      variants,
    };

    if (isNew) {
      addProduct(product);
      clearDraft();
    } else updateProduct(product);
    router.push(`/${locale}/mockup/dashboard/products`);
  }

  function handleCancel() {
    if (isNew) clearDraft();
    router.push(`/${locale}/mockup/dashboard/products`);
  }

  return (
    <div ref={formRef} className="mx-auto flex max-w-[720px] flex-col gap-5 p-4 text-fg md:p-6">
      <h1 className="text-lg font-semibold">{isNew ? t("newTitle") : t("editTitle")}</h1>

      {draftRestored && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-DEFAULT border border-info/40 bg-info/5 p-3 text-sm">
          <History className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
          <p className="min-w-0 flex-1 basis-48">
            <span className="font-medium">{t("draftRestoredTitle")}</span> {t("draftRestoredBody")}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              clearDraft();
              onReset();
            }}
          >
            {t("discardDraft")}
          </Button>
        </div>
      )}

      <Card className="flex flex-col p-4 md:p-6">
      <FormSection stacked title={t("photosLabel")} description={t("photosHint")}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <div key={index} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- local FileReader preview, not a remote image */}
              <img src={photo} alt="" className="h-full w-full rounded-DEFAULT object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                aria-label={t("removePhoto")}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-bg"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-DEFAULT border border-dashed border-border text-muted">
              <Upload className="h-5 w-5" aria-hidden="true" />
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotosChange} />
            </label>
          )}
        </div>
      </FormSection>

      <FormSection stacked title={t("detailsTitle")} description={t("detailsHelp")}>
        <Input
          label={t("titleKmLabel")}
          placeholder={t(`titleKmPlaceholder_${businessType}`)}
          value={titleKm}
          onChange={(e) => {
            setTitleKm(e.target.value);
            clearErrors("titleKm");
          }}
          onBlur={() => checkFields("titleKm")}
          error={error("titleKm")}
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label={t("titleEnLabel")}
            placeholder={t(`titleEnPlaceholder_${businessType}`)}
            value={titleEn}
            onChange={(e) => {
              setTitleEn(e.target.value);
              clearErrors("titleEn");
            }}
            onBlur={() => checkFields("titleEn")}
            error={error("titleEn")}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">{t("translateNote")}</p>
            <button
              type="button"
              onClick={handleAutoTranslate}
              disabled={translating || !titleKm.trim()}
              className="flex min-h-touch shrink-0 items-center gap-1 text-sm font-medium text-brand disabled:opacity-50"
            >
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              {translating ? t("translating") : t("autoTranslate")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select
            label={t("categoryLabel")}
            value={categoryId}
            onChange={(e) => {
              handleCategoryChange(e.target.value);
              clearErrors("categoryId");
            }}
            error={error("categoryId")}
            options={[
              ...categories.map((category) => ({
                value: category.id,
                label: locale === "km" ? category.labelKm : category.labelEn,
              })),
              { value: NEW_VALUE, label: t("addNewCategory") },
            ]}
          />
          <Select
            label={t("brandLabel")}
            value={brandId}
            onChange={(e) => handleBrandChange(e.target.value)}
            placeholder={t("noBrand")}
            options={[
              ...brands.map((brand) => ({
                value: brand.id,
                label: locale === "km" ? brand.nameKm : brand.nameEn,
              })),
              { value: NEW_VALUE, label: t("addNewBrand") },
            ]}
          />
        </div>

        {addingCategory && (
          <NewEntryForm
            kmLabel={t("newCategoryKmLabel")}
            enLabel={t("newCategoryEnLabel")}
            km={newCategoryKm}
            en={newCategoryEn}
            onKmChange={setNewCategoryKm}
            onEnChange={setNewCategoryEn}
            onCancel={() => {
              setAddingCategory(false);
              setNewCategoryKm("");
              setNewCategoryEn("");
            }}
            onConfirm={handleAddCategory}
            confirmLabel={t("addCategory")}
            cancelLabel={t("cancel")}
          />
        )}

        {addingBrand && (
          <NewEntryForm
            kmLabel={t("newBrandKmLabel")}
            enLabel={t("newBrandEnLabel")}
            km={newBrandKm}
            en={newBrandEn}
            onKmChange={setNewBrandKm}
            onEnChange={setNewBrandEn}
            onCancel={() => {
              setAddingBrand(false);
              setNewBrandKm("");
              setNewBrandEn("");
            }}
            onConfirm={handleAddBrand}
            confirmLabel={t("addBrand")}
            cancelLabel={t("cancel")}
          />
        )}

        <Select
          label={t("uomLabel")}
          value={uomId}
          onChange={(e) => handleUomChange(e.target.value)}
          options={[
            ...uoms.map((uom) => ({
              value: uom.id,
              label: locale === "km" ? uom.labelKm : uom.labelEn,
            })),
            { value: NEW_VALUE, label: t("addNewUom") },
          ]}
        />

        {addingUom && (
          <NewEntryForm
            kmLabel={t("newUomKmLabel")}
            enLabel={t("newUomEnLabel")}
            km={newUomKm}
            en={newUomEn}
            onKmChange={setNewUomKm}
            onEnChange={setNewUomEn}
            onCancel={() => {
              setAddingUom(false);
              setNewUomKm("");
              setNewUomEn("");
            }}
            onConfirm={handleAddUom}
            confirmLabel={t("addUom")}
            cancelLabel={t("cancel")}
          />
        )}

        <Input
          label={t("discountLabel")}
          inputMode="numeric"
          value={discountPercent}
          onChange={(e) => {
            setDiscountPercent(e.target.value);
            clearErrors("discountPercent");
          }}
          onBlur={() => checkFields("discountPercent")}
          error={error("discountPercent")}
        />
      </FormSection>

      <FormSection stacked title={t("descriptionTitle")} description={t("descriptionHelp")}>
        <Textarea
          label={t("descriptionKmLabel")}
          placeholder={t(`descriptionPlaceholder_${businessType}`)}
          maxLength={MAX_PRODUCT_DESCRIPTION_LENGTH}
          value={descriptionKm}
          onChange={(e) => {
            setDescriptionKm(e.target.value);
            clearErrors("descriptionKm");
          }}
          onBlur={() => checkFields("descriptionKm")}
          error={error("descriptionKm")}
          counter={`${descriptionKm.length} / ${MAX_PRODUCT_DESCRIPTION_LENGTH}`}
        />
        <Textarea
          label={t("descriptionEnLabel")}
          maxLength={MAX_PRODUCT_DESCRIPTION_LENGTH}
          value={descriptionEn}
          onChange={(e) => {
            setDescriptionEn(e.target.value);
            clearErrors("descriptionEn");
          }}
          onBlur={() => checkFields("descriptionEn")}
          error={error("descriptionEn")}
          counter={`${descriptionEn.length} / ${MAX_PRODUCT_DESCRIPTION_LENGTH}`}
        />
        {/* Placeholder for the AI writer (Phase 3): it will draft both languages from the first photo. */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t("writeForMe")}
          </Button>
          <span className="rounded-full bg-border/40 px-2.5 py-1 text-xs font-semibold text-muted">{t("comingSoon")}</span>
        </div>
      </FormSection>

      <FormSection stacked title={t("visibilityTitle")} description={t("visibilityHelp")}>
        <Switch
          checked={visible}
          onChange={setVisible}
          label={t("visibleLabel")}
          description={visible ? t("visibleOn") : t("visibleOff")}
        />
      </FormSection>

      {!hasVariants && (
        <FormSection stacked title={t("priceTitle")} description={t("priceHelp")}>
          <p className="text-sm font-medium text-fg">{t("retailPriceTitle")}</p>
          <MoneyInput
            usd={retailUsd}
            khr={retailKhr}
            usdLabel={t("priceUsdLabel")}
            khrLabel={t("priceKhrLabel")}
            onUsdChange={(text) => {
              setRetailUsd(text);
              clearErrors("retailPriceUsdCents", "retailPrice");
            }}
            onKhrChange={(text) => {
              setRetailKhr(text);
              clearErrors("retailPriceKhr", "retailPrice");
            }}
            autoFillRate={rate}
            onUsdBlur={() => checkFields("retailPriceUsdCents", "wholesalePrice")}
            onKhrBlur={() => checkFields("retailPriceKhr", "wholesalePrice")}
            usdError={error("retailPriceUsdCents") ?? error("retailPrice")}
            khrError={error("retailPriceKhr")}
          />
          <p className="text-xs text-muted">{t("autoFillNote")}</p>

          {canWholesale ? (
            <>
              <p className="text-sm font-medium text-fg">{t("wholesalePriceTitle")}</p>
              <MoneyInput
                usd={wholesaleUsd}
                khr={wholesaleKhr}
                usdLabel={t("priceUsdLabel")}
                khrLabel={t("priceKhrLabel")}
                onUsdChange={(text) => {
                  setWholesaleUsd(text);
                  clearErrors("wholesalePriceUsdCents", "wholesalePrice");
                }}
                onKhrChange={(text) => {
                  setWholesaleKhr(text);
                  clearErrors("wholesalePriceKhr", "wholesalePrice");
                }}
                autoFillRate={rate}
                onUsdBlur={() => checkFields("wholesalePriceUsdCents", "wholesalePrice")}
                onKhrBlur={() => checkFields("wholesalePriceKhr", "wholesalePrice")}
                usdError={error("wholesalePriceUsdCents") ?? error("wholesalePrice")}
                khrError={error("wholesalePriceKhr")}
              />
              <p className="text-xs text-muted">{t("wholesaleHint")}</p>
            </>
          ) : (
            wholesaleLockedPrompt
          )}
        </FormSection>
      )}

      <FormSection stacked title={t("variantsTitle")} description={t("variantsHint")}>
        {hasVariants && !canWholesale && wholesaleLockedPrompt}

        {variantDrafts.map((row, index) => {
          const key = (field: string) => `options.${index}.${field}`;
          return (
            <div key={row.id} className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label={t("optionLabelKm")}
                  value={row.labelKm}
                  onChange={(e) => {
                    updateVariantRow(row.id, { labelKm: e.target.value });
                    clearErrors(key("label"));
                  }}
                  error={error(key("label")) ?? error(key("labelKm"))}
                />
                <Input
                  label={t("optionLabelEn")}
                  value={row.labelEn}
                  onChange={(e) => {
                    updateVariantRow(row.id, { labelEn: e.target.value });
                    clearErrors(key("label"));
                  }}
                  error={error(key("labelEn"))}
                />
              </div>
              <Input
                label={t("optionSku")}
                value={row.sku}
                onChange={(e) => {
                  updateVariantRow(row.id, { sku: e.target.value });
                  clearErrors(key("sku"));
                }}
                onBlur={() => checkFields(key("sku"))}
                error={error(key("sku"))}
              />
              <p className="text-xs font-medium text-muted">{t("retailPriceTitle")}</p>
              <MoneyInput
                className="gap-2"
                usd={row.retailUsd}
                khr={row.retailKhr}
                usdLabel={t("optionPriceUsd")}
                khrLabel={t("optionPriceKhr")}
                onUsdChange={(text) => {
                  updateVariantRow(row.id, { retailUsd: text });
                  clearErrors(key("retailPriceUsdCents"), key("retailPrice"));
                }}
                onKhrChange={(text) => {
                  updateVariantRow(row.id, { retailKhr: text });
                  clearErrors(key("retailPriceKhr"), key("retailPrice"));
                }}
                autoFillRate={rate}
                usdError={error(key("retailPriceUsdCents")) ?? error(key("retailPrice"))}
                khrError={error(key("retailPriceKhr"))}
              />
              {canWholesale && (
                <>
                  <p className="text-xs font-medium text-muted">{t("wholesalePriceTitle")}</p>
                  <MoneyInput
                    className="gap-2"
                    usd={row.wholesaleUsd}
                    khr={row.wholesaleKhr}
                    usdLabel={t("optionPriceUsd")}
                    khrLabel={t("optionPriceKhr")}
                    onUsdChange={(text) => {
                      updateVariantRow(row.id, { wholesaleUsd: text });
                      clearErrors(key("wholesalePriceUsdCents"), key("wholesalePrice"));
                    }}
                    onKhrChange={(text) => {
                      updateVariantRow(row.id, { wholesaleKhr: text });
                      clearErrors(key("wholesalePriceKhr"), key("wholesalePrice"));
                    }}
                    usdError={error(key("wholesalePriceUsdCents")) ?? error(key("wholesalePrice"))}
                    khrError={error(key("wholesalePriceKhr"))}
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  removeVariantRow(row.id);
                  // Messages are keyed by position, so they'd point at the wrong option now.
                  setErrors({});
                }}
                className="flex min-h-touch items-center gap-1 self-start text-xs font-medium text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("removeOption")}
              </button>
            </div>
          );
        })}

        <Button variant="secondary" onClick={addVariantRow} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("addOption")}
        </Button>
      </FormSection>

      <FormActions
        dirty={dirty}
        canCancel
        onCancel={handleCancel}
        onSave={handleSave}
        saveLabel={t("saveProduct")}
        cancelLabel={t("cancel")}
        status={dirty ? t(isNew ? "draftSaved" : "unsavedChanges") : undefined}
        className="bottom-above-nav -mb-4 rounded-b-DEFAULT md:bottom-0 md:-mb-6"
      />
      </Card>
    </div>
  );
}
