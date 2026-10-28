"use client";

import {
  choicePickSchema,
  currencySchema,
  hasModule,
  MAX_CHOICE_GROUPS,
  MAX_PRODUCT_DESCRIPTION_LENGTH,
  MAX_PRODUCT_PHOTOS,
  MAX_VARIANT_GROUPS,
  planHasFeature,
  productInputSchema,
  toFieldErrors,
  variantLabel,
  type Currency,
  type CustomValue,
  type FormErrorCode,
  type ProductFormInput,
} from "@khmio/shared";
import { Button, Card, FileButton, IconButton, Input, Notice, PageHeader, Select, Switch, Textarea } from "@khmio/ui";
import { Grid3x3, History, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { z } from "zod";
import { ACCEPTED_IMAGE_TYPES, compressImageToBlob } from "@/components/compress-image";
import { FormActions, FormSection, focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import {
  choiceGroupDrafts,
  nextDraftId,
  rowsForCombinations,
  toChoiceGroupInput,
  toVariantGroupInput,
  variantGroupDrafts,
  type OptionGroupDraft,
} from "@/components/product-form/option-groups";
import { OptionGroupsEditor } from "@/components/product-form/option-groups-editor";
import {
  CostCurrencyChoice,
  costCurrencyOf,
  EMPTY_PRICE_TEXTS,
  pickPriceTexts,
  PriceInputs,
  priceInput,
  priceTextsOf,
  type PriceKind,
  type PriceTexts,
} from "@/components/product-form/price-inputs";
import { SELLER_FORM, SELLER_FORM_BAR } from "@/components/seller-frame/seller-frame";
import { CustomFieldInput, valuesForSave } from "@/components/custom-fields/custom-field-input";
import {
  api,
  ApiError,
  apiSend,
  type Catalog,
  type CatalogName,
  catalogNameSchema,
  catalogSchema,
  type CustomField,
  customFieldsAnswerSchema,
  type Product,
  productSchema,
  uploadPhoto,
} from "@/lib/api";
import { readStored, writeStored } from "@/lib/device-storage";
import { useMerchant } from "../../merchant-context";

/** The small copy of each photo, for the shop grid and lists. */
const THUMB_SIDE = 400;

const NEW_VALUE = "__new__";

/** The price boxes' text; cost came later, so a draft kept before it has none. */
const priceTextsShape = {
  retailUsd: z.string(),
  retailKhr: z.string(),
  wholesaleUsd: z.string(),
  wholesaleKhr: z.string(),
  cost: z.string().default(""),
};

const variantDraftSchema = z.object({
  id: z.string(),
  labelKm: z.string(),
  labelEn: z.string(),
  /** With variant groups: this row's value in each group. */
  valueIds: z.array(z.string()).default([]),
  sku: z.string(),
  ...priceTextsShape,
});
type VariantDraft = z.infer<typeof variantDraftSchema>;

/** A photo in the form: shrunk and uploading, uploaded (has a key), or failed. */
interface PhotoSlot {
  id: string;
  key?: string;
  url: string;
  status: "uploading" | "ready" | "failed";
}

const groupDraftSchema = z.object({
  id: z.string(),
  nameKm: z.string(),
  nameEn: z.string(),
  pick: choicePickSchema,
  required: z.boolean(),
  values: z.array(z.object({ id: z.string(), labelKm: z.string(), labelEn: z.string(), extraUsd: z.string(), extraKhr: z.string() })),
});

// A new product is kept on this device while it's being typed, so a phone
// call or a closed tab doesn't lose it — photos too, as their uploaded keys.
const productDraftSchema = z.object({
  titleKm: z.string(),
  titleEn: z.string(),
  descriptionKm: z.string(),
  descriptionEn: z.string(),
  visible: z.boolean(),
  categoryId: z.string(),
  brandId: z.string(),
  uomId: z.string(),
  prices: z.object(priceTextsShape),
  costCurrency: currencySchema,
  discountPercent: z.string(),
  variantDrafts: z.array(variantDraftSchema),
  variantGroups: z.array(groupDraftSchema),
  choiceGroups: z.array(groupDraftSchema),
  photos: z.array(z.object({ key: z.string(), url: z.string() })),
});
type ProductDraft = z.infer<typeof productDraftSchema>;

const draftStorageKey = (slug: string) => `khmio:product-draft:${slug}`;

/** The kept draft; a field kept by an older version that no longer fits is left out. */
function readDraft(slug: string): Partial<ProductDraft> | null {
  return readStored(draftStorageKey(slug), productDraftSchema.partial());
}

function clearDraft(slug: string) {
  writeStored(draftStorageKey(slug), null);
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
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel,
  busy,
  error,
}: {
  kmLabel: string;
  enLabel: string;
  onCancel: () => void;
  onConfirm: (names: { nameKm: string; nameEn: string }) => void;
  confirmLabel: string;
  cancelLabel: string;
  busy: boolean;
  error?: string;
}) {
  const [km, setKm] = useState("");
  const [en, setEn] = useState("");
  return (
    <div className="flex flex-col gap-2 rounded-DEFAULT border border-dashed border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <Input label={kmLabel} value={km} onChange={(e) => setKm(e.target.value)} />
        <Input label={enLabel} value={en} onChange={(e) => setEn(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} className="w-full">
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          onClick={() => onConfirm({ nameKm: km.trim(), nameEn: en.trim() })}
          disabled={!km.trim() || !en.trim()}
          loading={busy}
          className="w-full"
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

// Loads what the form needs (the lists, and the product when editing) before
// the form mounts: the form copies values into its own state once, so it
// must not start from blanks and then save them over the real product.
export default function ProductFormPage() {
  const t = useTranslations("ProductForm");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "offline">("loading");
  // "Discard draft" starts the form again from blank.
  const [resetCount, setResetCount] = useState(0);

  const load = () => {
    setState("loading");
    Promise.all([
      api("/catalog", catalogSchema),
      isNew ? Promise.resolve(null) : api(`/products/${params.id}`, productSchema),
      // The shop's own product fields (Features › customFields); none to show when it's off.
      api("/custom-fields", customFieldsAnswerSchema),
    ])
      .then(([names, existing, own]) => {
        setCatalog(names);
        setProduct(existing);
        setFields(own.fields.filter((field) => field.target === "product"));
        setState("ready");
      })
      .catch((error: unknown) => setState(error instanceof ApiError && (error.status === 404 || error.status === 400) ? "not_found" : "offline"));
  };
  // Loads once per product; `load` is recreated every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [params.id]);

  if (state === "offline") {
    return (
      <div className="flex flex-col items-center gap-3 p-4 py-16 text-center" role="alert">
        <p className="font-semibold">{tApp("offlineTitle")}</p>
        <Button variant="primary" onClick={load}>
          {tApp("retry")}
        </Button>
      </div>
    );
  }
  if (state === "not_found") {
    return (
      <div className="flex flex-col items-center gap-3 p-4 pt-16 text-center">
        <p className="font-semibold">{t("notFound")}</p>
        <Link href={`/${locale}/m/products`}>
          <Button variant="secondary">{t("backToProducts")}</Button>
        </Link>
      </div>
    );
  }
  if (state === "loading" || !catalog) {
    return (
      <div className="flex flex-col gap-3 p-4" aria-busy="true">
        <span className="sr-only" role="status">
          {tApp("loading")}
        </span>
        <div className="h-7 w-48 animate-pulse rounded-DEFAULT bg-border/40 motion-reduce:animate-none" />
        <div className="h-64 animate-pulse rounded-2xl bg-border/40 motion-reduce:animate-none" />
      </div>
    );
  }
  return (
    <ProductForm
      key={`${params.id}-${resetCount}`}
      catalog={catalog}
      existing={product}
      fields={fields}
      onReset={() => setResetCount((count) => count + 1)}
    />
  );
}

function ProductForm({ catalog, existing, fields, onReset }: { catalog: Catalog; existing: Product | null; fields: CustomField[]; onReset: () => void }) {
  const t = useTranslations("ProductForm");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const router = useRouter();
  const { store, refreshStore } = useMerchant();
  const rate = store.usdToKhrRate;
  const businessType = store.businessType;
  const isNew = existing === null;
  // Hidden, not cleared: wholesale prices already saved stay on the server
  // (the API keeps them on plans without wholesale) and return after an upgrade.
  const canWholesale = planHasFeature(store.plan, "wholesalePrice");
  // Cost is on every plan (the profit report built on it is Pro).
  const priceKinds: PriceKind[] = canWholesale ? ["retail", "wholesale", "cost"] : ["retail", "cost"];
  // Features for my business: switched off, the groups are hidden and kept as they are by the API.
  const optionsOn = hasModule(store.modules, "options");
  const choicesOn = hasModule(store.modules, "choices");
  const fieldsOn = hasModule(store.modules, "customFields") && fields.length > 0;
  const servicesOn = hasModule(store.modules, "services");

  const [categories, setCategories] = useState<CatalogName[]>(catalog.categories);
  const [brands, setBrands] = useState<CatalogName[]>(catalog.brands);
  const [units, setUnits] = useState<CatalogName[]>(catalog.units);

  const simple = existing && !existing.hasOptions ? existing.variants[0] : undefined;
  const [photos, setPhotos] = useState<PhotoSlot[]>(existing?.photos.map((photo) => ({ id: photo.key, key: photo.key, url: photo.url, status: "ready" })) ?? []);
  const [titleKm, setTitleKm] = useState(existing?.titleKm ?? "");
  const [titleEn, setTitleEn] = useState(existing?.titleEn ?? "");
  const [descriptionKm, setDescriptionKm] = useState(existing?.descriptionKm ?? "");
  const [descriptionEn, setDescriptionEn] = useState(existing?.descriptionEn ?? "");
  const [visible, setVisible] = useState(existing?.isVisible ?? true);
  const [isService, setIsService] = useState(existing?.kind === "service");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? catalog.categories[0]?.id ?? "");
  const [brandId, setBrandId] = useState(existing?.brandId ?? "");
  const [uomId, setUomId] = useState(existing ? (existing.unitId ?? "") : (catalog.defaultUnitId ?? ""));
  const [prices, setPrices] = useState<PriceTexts>(priceTextsOf(simple));
  // One cost currency for the whole product (docs/blueprint.md "Cost price"); a new product starts on the shop's main currency.
  const [costCurrency, setCostCurrency] = useState<Currency>(costCurrencyOf(existing?.variants, store.defaultCurrency));
  const [discountPercent, setDiscountPercent] = useState(existing?.discountPercent?.toString() ?? "");
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>(
    existing?.hasOptions
      ? existing.variants.map((variant) => ({
          id: variant.id,
          labelKm: variant.labelKm,
          labelEn: variant.labelEn,
          valueIds: variant.valueIds,
          sku: variant.sku,
          ...priceTextsOf(variant),
        }))
      : [],
  );
  const [variantGroups, setVariantGroups] = useState<OptionGroupDraft[]>(variantGroupDrafts(existing?.variantGroups ?? []));
  const [choiceGroups, setChoiceGroups] = useState<OptionGroupDraft[]>(choiceGroupDrafts(existing?.choiceGroups ?? []));
  const [customValues, setCustomValues] = useState<Record<string, CustomValue>>(existing?.customValues ?? {});
  const [adding, setAdding] = useState<"categories" | "brands" | "units" | null>(null);
  const [addingBusy, setAddingBusy] = useState(false);
  const [addingError, setAddingError] = useState<string>();
  const [draftRestored, setDraftRestored] = useState(false);
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorText = useFormErrorText();
  const formRef = useRef<HTMLDivElement>(null);

  const hasVariants = variantDrafts.length > 0;
  // With variant groups, each row is a combination of their values and is named by them.
  const grouped = optionsOn && variantGroups.length > 0;
  const uploading = photos.some((photo) => photo.status === "uploading");
  const readyPhotos = photos.filter((photo): photo is PhotoSlot & { key: string } => photo.status === "ready" && !!photo.key);

  // Everything the merchant can change, so Save/Cancel only light up after a real edit.
  const snapshot = JSON.stringify({
    photos: photos.map((photo) => photo.key ?? photo.id),
    titleKm,
    titleEn,
    descriptionKm,
    descriptionEn,
    visible,
    categoryId,
    brandId,
    uomId,
    prices,
    costCurrency,
    discountPercent,
    variantDrafts,
    variantGroups,
    choiceGroups,
    customValues,
    isService,
  });
  const [savedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  // A new product picks up where the seller left off.
  useEffect(() => {
    if (!isNew) return;
    const draft = readDraft(store.slug);
    if (!draft) return;
    const text = (value: unknown, apply: (next: string) => void) => {
      if (typeof value === "string") apply(value);
    };
    const known = (list: CatalogName[]) => (id: string) => id === "" || list.some((entry) => entry.id === id);
    text(draft.titleKm, setTitleKm);
    text(draft.titleEn, setTitleEn);
    text(draft.descriptionKm, setDescriptionKm);
    text(draft.descriptionEn, setDescriptionEn);
    if (typeof draft.visible === "boolean") setVisible(draft.visible);
    text(draft.categoryId, (id) => known(categories)(id) && id && setCategoryId(id));
    text(draft.brandId, (id) => known(brands)(id) && setBrandId(id));
    text(draft.uomId, (id) => known(units)(id) && setUomId(id));
    if (draft.prices) setPrices(draft.prices);
    if (draft.costCurrency) setCostCurrency(draft.costCurrency);
    text(draft.discountPercent, setDiscountPercent);
    if (Array.isArray(draft.variantDrafts)) setVariantDrafts(draft.variantDrafts);
    if (Array.isArray(draft.variantGroups)) setVariantGroups(draft.variantGroups);
    if (Array.isArray(draft.choiceGroups)) setChoiceGroups(draft.choiceGroups);
    if (Array.isArray(draft.photos)) setPhotos(draft.photos.map((photo) => ({ id: photo.key, key: photo.key, url: photo.url, status: "ready" })));
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
        prices,
        costCurrency,
        discountPercent,
        variantDrafts,
        variantGroups,
        choiceGroups,
        photos: readyPhotos.map(({ key, url }) => ({ key, url })),
      };
      writeStored(draftStorageKey(store.slug), draft); // not kept this time when storage refuses
    }, 400);
    return () => clearTimeout(timer);
    // The snapshot changes whenever any of the fields above does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, dirty, snapshot]);

  const error = (key: string) => errorText(errors[key]);
  const photosError = Object.keys(errors).some((key) => key.startsWith("photoKeys")) ? errorText("photo_required") : undefined;
  const name = (entry: CatalogName) => (locale === "km" ? entry.nameKm : entry.nameEn);

  /** Each photo is shrunk on the phone, shown at once, and uploaded in the background. */
  function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PRODUCT_PHOTOS - photos.length);
    event.target.value = "";
    clearErrors(...Object.keys(errors).filter((key) => key.startsWith("photoKeys")));
    for (const file of files) {
      const id = nextDraftId();
      const preview = URL.createObjectURL(file);
      setPhotos((previous) => (previous.length >= MAX_PRODUCT_PHOTOS ? previous : [...previous, { id, url: preview, status: "uploading" }]));
      Promise.all([compressImageToBlob(file), compressImageToBlob(file, THUMB_SIDE, 0.75)])
        .then(([photo, thumb]) => uploadPhoto(photo, thumb))
        .then((uploaded) => {
          setPhotos((previous) => previous.map((photo) => (photo.id === id ? { id, key: uploaded.key, url: uploaded.url, status: "ready" } : photo)));
          URL.revokeObjectURL(preview);
        })
        .catch(() => setPhotos((previous) => previous.map((photo) => (photo.id === id ? { ...photo, status: "failed" } : photo))));
    }
  }

  function removePhoto(id: string) {
    setPhotos((previous) => previous.filter((photo) => photo.id !== id));
  }

  function handleSelect(kind: "categories" | "brands" | "units", value: string, apply: (id: string) => void) {
    if (value === NEW_VALUE) {
      setAddingError(undefined);
      setAdding(kind);
      return;
    }
    apply(value);
  }

  /** "+ Add new …": saved on the server straight away, then picked. */
  async function handleAddEntry(names: { nameKm: string; nameEn: string }) {
    if (!adding) return;
    setAddingBusy(true);
    setAddingError(undefined);
    try {
      const entry = await api(`/catalog/${adding}`, catalogNameSchema, { method: "POST", body: names });
      if (adding === "categories") {
        setCategories((previous) => [...previous, entry]);
        setCategoryId(entry.id);
        clearErrors("categoryId");
      } else if (adding === "brands") {
        setBrands((previous) => [...previous, entry]);
        setBrandId(entry.id);
      } else {
        setUnits((previous) => [...previous, entry]);
        setUomId(entry.id);
      }
      setAdding(null);
    } catch (failure) {
      setAddingError(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setAddingBusy(false);
    }
  }

  function addVariantRow() {
    setVariantDrafts((previous) => [
      ...previous,
      { id: nextDraftId(), labelKm: "", labelEn: "", valueIds: [], sku: "", ...EMPTY_PRICE_TEXTS },
    ]);
  }

  /** "Make all combinations": one row per combination of the groups' values, keeping the prices already typed. */
  function makeCombinations() {
    setVariantDrafts((previous) =>
      rowsForCombinations(variantGroups, previous, (valueIds, copyFrom) => ({
        id: nextDraftId(),
        labelKm: "",
        labelEn: "",
        valueIds,
        sku: "",
        ...(copyFrom ? pickPriceTexts(copyFrom) : EMPTY_PRICE_TEXTS),
      })),
    );
    // Messages are keyed by position, so they'd point at the wrong option now.
    setErrors({});
  }

  function updateVariantRow(id: string, patch: Partial<VariantDraft>) {
    setVariantDrafts((previous) => previous.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeVariantRow(id: string) {
    setVariantDrafts((previous) => previous.filter((row) => row.id !== id));
  }

  /**
   * The form as the shared schema sees it. On a plan without wholesale the
   * wholesale boxes are hidden, so they're left out (the API keeps what was saved).
   */
  function buildInput(): ProductFormInput {
    return {
      titleKm,
      titleEn,
      descriptionKm,
      descriptionEn,
      isVisible: visible,
      // Only while services are on; switched off, the API keeps the kind the product has.
      kind: servicesOn && isService ? "service" : "item",
      categoryId,
      brandId: brandId || undefined,
      uomId: uomId || undefined,
      discountPercent: parseDiscountInput(discountPercent),
      costCurrency,
      // Only while the module is on: switched off, the API keeps what the product has.
      variantGroups: grouped ? toVariantGroupInput(variantGroups) : [],
      choiceGroups: choicesOn ? toChoiceGroupInput(choiceGroups) : [],
      customValues: fieldsOn ? valuesForSave(fields, customValues) : {},
      ...(hasVariants
        ? {
            options: variantDrafts.map((row) => ({
              id: row.id,
              sku: row.sku,
              labelKm: row.labelKm,
              labelEn: row.labelEn,
              ...(grouped ? { valueIds: row.valueIds } : {}),
              ...priceInput(row, priceKinds, costCurrency),
            })),
          }
        : priceInput(prices, priceKinds, costCurrency)),
    };
  }

  /** On leaving a field: re-check just the fields named, leave every other message alone. */
  function checkFields(...keys: string[]) {
    const result = productInputSchema.safeParse(buildInput());
    const found = result.success ? {} : toFieldErrors(result.error);
    setErrors((previous) => {
      const next = { ...previous };
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
    setErrors((previous) => {
      const next = { ...previous };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  async function handleSave() {
    setSaveError(null);
    const result = productInputSchema.safeParse(buildInput());
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(formRef.current);
      return;
    }
    if (photos.some((photo) => photo.status === "failed")) {
      setSaveError(tApp("photoUploadFailed"));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const body = { product: result.data, photoKeys: readyPhotos.map((photo) => photo.key) };
      if (isNew) await apiSend("/products", { method: "POST", body });
      else await apiSend(`/products/${existing.id}`, { method: "PUT", body });
      if (isNew) clearDraft(store.slug);
      await refreshStore().catch(() => undefined);
      router.push(`/${locale}/m/products`);
    } catch (failure) {
      setSaving(false);
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) {
        setErrors(failure.fields);
        focusFirstInvalidField(formRef.current);
        return;
      }
      const code = failure instanceof ApiError ? failure.code : "";
      setSaveError(code === "plan_limit" ? tApp("productLimitSave") : code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    }
  }

  function handleCancel() {
    if (isNew) clearDraft(store.slug);
    router.push(`/${locale}/m/products`);
  }

  const newEntryLabels = {
    categories: { km: t("newCategoryKmLabel"), en: t("newCategoryEnLabel"), confirm: t("addCategory") },
    brands: { km: t("newBrandKmLabel"), en: t("newBrandEnLabel"), confirm: t("addBrand") },
    units: { km: t("newUomKmLabel"), en: t("newUomEnLabel"), confirm: t("addUom") },
  };
  const newEntryForm = (kind: "categories" | "brands" | "units") =>
    adding === kind && (
      <NewEntryForm
        kmLabel={newEntryLabels[kind].km}
        enLabel={newEntryLabels[kind].en}
        confirmLabel={newEntryLabels[kind].confirm}
        cancelLabel={t("cancel")}
        busy={addingBusy}
        error={addingError}
        onCancel={() => setAdding(null)}
        onConfirm={(names) => void handleAddEntry(names)}
      />
    );

  return (
    <div ref={formRef} className={`${SELLER_FORM} gap-5`}>
      <PageHeader title={isNew ? t("newTitle") : t("editTitle")} />

      {draftRestored && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-DEFAULT border border-info/40 bg-info/5 p-3 text-sm">
          <History className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
          <p className="min-w-0 flex-1 basis-48">
            <span className="font-medium">{t("draftRestoredTitle")}</span> {t("draftRestoredBody")}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              clearDraft(store.slug);
              onReset();
            }}
          >
            {t("discardDraft")}
          </Button>
        </div>
      )}

      <Card className="flex flex-col p-4">
        <FormSection stacked title={t("photosLabel")} description={t("photosHint")}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element -- the seller's own photo (local preview while it uploads) */}
                <img
                  src={photo.url}
                  alt=""
                  className={`h-full w-full rounded-DEFAULT object-cover ${photo.status === "ready" ? "" : "opacity-50"} ${photo.status === "failed" ? "ring-2 ring-danger" : ""}`}
                />
                {photo.status === "uploading" && (
                  <span className="absolute inset-0 flex items-center justify-center" role="status">
                    <Loader2 className="h-6 w-6 animate-spin text-fg motion-reduce:animate-none" aria-hidden="true" />
                    <span className="sr-only">{tApp("photoUploading")}</span>
                  </span>
                )}
                {photo.status === "failed" && (
                  <span className="absolute inset-x-1 bottom-1 rounded bg-danger px-1 text-center text-xs font-medium text-bg">{tApp("photoFailedShort")}</span>
                )}
                <IconButton icon={X} look="badge" label={t("removePhoto")} onClick={() => removePhoto(photo.id)} className="absolute -right-3.5 -top-3.5" />
              </div>
            ))}
            {photos.length < MAX_PRODUCT_PHOTOS && (
              <FileButton look="tile" accept={ACCEPTED_IMAGE_TYPES} multiple invalid={Boolean(photosError)} onChange={handlePhotosChange}>
                {t("photosLabel")}
              </FileButton>
            )}
          </div>
          {photosError && <p className="text-sm text-danger">{photosError}</p>}
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
            <p className="text-xs text-muted">{t("translateNote")}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select
              label={t("categoryLabel")}
              value={categoryId}
              onChange={(e) => {
                handleSelect("categories", e.target.value, setCategoryId);
                clearErrors("categoryId");
              }}
              error={error("categoryId")}
              options={[...categories.map((entry) => ({ value: entry.id, label: name(entry) })), { value: NEW_VALUE, label: t("addNewCategory") }]}
            />
            <Select
              label={t("brandLabel")}
              value={brandId}
              onChange={(e) => handleSelect("brands", e.target.value, setBrandId)}
              placeholder={t("noBrand")}
              error={error("brandId")}
              options={[...brands.map((entry) => ({ value: entry.id, label: name(entry) })), { value: NEW_VALUE, label: t("addNewBrand") }]}
            />
          </div>
          {newEntryForm("categories")}
          {newEntryForm("brands")}

          <Select
            label={t("uomLabel")}
            value={uomId}
            onChange={(e) => handleSelect("units", e.target.value, setUomId)}
            error={error("uomId")}
            options={[...units.map((entry) => ({ value: entry.id, label: name(entry) })), { value: NEW_VALUE, label: t("addNewUom") }]}
          />
          {newEntryForm("units")}

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

        {fieldsOn && (
          <FormSection stacked title={t("moreDetailsTitle")} description={t("moreDetailsHelp")}>
            {fields.map((field) => (
              <CustomFieldInput
                key={field.id}
                field={field}
                value={customValues[field.id]}
                onChange={(value) => {
                  setCustomValues((current) => {
                    const next = { ...current };
                    if (value === undefined) delete next[field.id];
                    else next[field.id] = value;
                    return next;
                  });
                  clearErrors(`customValues.${field.id}`);
                }}
                error={error(`customValues.${field.id}`)}
              />
            ))}
          </FormSection>
        )}

        {servicesOn && (
          <FormSection stacked title={t("kindTitle")} description={t("kindHelp")}>
            <Switch checked={isService} onChange={setIsService} label={t("isServiceLabel")} description={t("isServiceHint")} />
          </FormSection>
        )}

        <FormSection stacked title={t("visibilityTitle")} description={t("visibilityHelp")}>
          <Switch checked={visible} onChange={setVisible} label={t("visibleLabel")} description={visible ? t("visibleOn") : t("visibleOff")} />
        </FormSection>

        {!hasVariants && (
          <FormSection stacked title={t("priceTitle")} description={t("priceHelp")}>
            <PriceInputs
              texts={prices}
              onChange={(box, text) => setPrices((previous) => ({ ...previous, [box]: text }))}
              kinds={priceKinds}
              usdToKhrRate={rate}
              costCurrency={costCurrency}
              onCostCurrencyChange={setCostCurrency}
              error={error}
              clearErrors={clearErrors}
              checkFields={checkFields}
            />
          </FormSection>
        )}

        <FormSection stacked title={t("variantsTitle")} description={t(optionsOn ? "variantGroupsHint" : "variantsHint")}>
          {optionsOn && (
            <>
              <OptionGroupsEditor
                kind="variant"
                field="variantGroups"
                groups={variantGroups}
                onChange={setVariantGroups}
                max={MAX_VARIANT_GROUPS}
                error={error}
                usdToKhrRate={rate}
              />
              {variantGroups.length > 0 && (
                <Button variant="secondary" onClick={makeCombinations} className="self-start">
                  <Grid3x3 className="h-4 w-4" aria-hidden="true" />
                  {t("makeCombinations")}
                </Button>
              )}
            </>
          )}
          {hasVariants && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-fg">{t("costCurrencyLabel")}</p>
              <CostCurrencyChoice value={costCurrency} onChange={setCostCurrency} />
            </div>
          )}
          {variantDrafts.map((row, index) => {
            const key = (field: string) => `options.${index}.${field}`;
            return (
              <div key={row.id} className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
                {grouped ? (
                  <div>
                    <p className="font-medium">{variantLabel(variantGroups, row.valueIds, locale === "km" ? "km" : "en") || t("combinationMissing")}</p>
                    {error(key("valueIds")) && <p className="text-sm text-danger">{error(key("valueIds"))}</p>}
                  </div>
                ) : (
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
                )}
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
                <PriceInputs
                  compact
                  texts={row}
                  onChange={(box, text) => updateVariantRow(row.id, { [box]: text })}
                  kinds={priceKinds}
                  usdToKhrRate={rate}
                  costCurrency={costCurrency}
                  error={error}
                  clearErrors={clearErrors}
                  fieldPrefix={key("")}
                />
                <Button
                  variant="ghost"
                  tone="danger"
                  onClick={() => {
                    removeVariantRow(row.id);
                    // Messages are keyed by position, so they'd point at the wrong option now.
                    setErrors({});
                  }}
                  className="-ml-3 self-start"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t("removeOption")}
                </Button>
              </div>
            );
          })}
          {/* With groups, rows come from "Make all combinations"; one typed by hand would have no values. */}
          {!grouped && (
            <Button variant="secondary" onClick={addVariantRow} className="self-start">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addOption")}
            </Button>
          )}
        </FormSection>

        {choicesOn && (
          <FormSection stacked title={t("choicesTitle")} description={t("choicesHint")}>
            <OptionGroupsEditor kind="choice" field="choiceGroups" groups={choiceGroups} onChange={setChoiceGroups} max={MAX_CHOICE_GROUPS} error={error} usdToKhrRate={rate} />
          </FormSection>
        )}

        {saveError && (
          <Notice tone="danger" role="alert" className="mb-3">
            {saveError}
          </Notice>
        )}

        <FormActions
          dirty={dirty && !uploading && !saving}
          canCancel={!saving}
          onCancel={handleCancel}
          onSave={() => void handleSave()}
          saveLabel={saving ? tApp("saving") : uploading ? tApp("photoUploading") : t("saveProduct")}
          cancelLabel={t("cancel")}
          status={dirty ? t(isNew ? "draftSaved" : "unsavedChanges") : undefined}
          className={SELLER_FORM_BAR}
        />
      </Card>
    </div>
  );
}
