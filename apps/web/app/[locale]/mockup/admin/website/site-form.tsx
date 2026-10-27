"use client";

import { BottomSheet, Button, Input, Select, Switch, Textarea, cn } from "@khmio/ui";
import { ArrowDown, ArrowUp, ImageIcon, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { LIBRARY_SRC_PREFIX, type FormErrorCode, type SiteSchema as ZodTypeAny } from "@khmio/shared";
import { useWebsite } from "../../website-context";

// One form for every site kit section (design/screens.md A10): it is built
// from the section's own Zod schema, so a new field in the schema shows up
// here with no new admin screen. Text in two languages becomes a Khmer and
// an English box side by side; lists get add, move and remove; choices
// become a select; dates a date-and-time box (Phnom Penh time).

type Value = unknown;
type Errors = Record<string, FormErrorCode>;

/** Fields the admin never edits: they belong to the section itself. */
const HIDDEN_KEYS = new Set(["id", "type", "visible"]);

/** Fields and choices with their own words in messages ("SiteEditor"); anything else shows its key. */
const FIELD_KEYS = new Set([
  "text", "link", "label", "href", "eyebrow", "headline", "sentence", "art", "kind", "pose", "image", "src", "alt", "primary",
  "secondary", "title", "steps", "icon", "line", "features", "startsAt", "endsAt", "button", "highlight", "compare", "show",
  "items", "question", "answer", "name", "shop", "quote", "photo", "permission", "sample", "thanks", "description",
]);
const OPTION_KEYS = new Set([
  "store", "share", "qr", "bell", "truck", "boxes", "building", "shield", "clock", "language", "list", "heart",
  "face", "coin", "mio", "free", "basic", "pro", "advance", "all", "coming_soon",
]);

// ---------------------------------------------------------- schema reading
// Zod keeps each schema's kind in _def.typeName; these helpers read only that.

function typeName(schema: ZodTypeAny): string {
  return (schema._def as { typeName: string }).typeName;
}
function unwrapEffects(schema: ZodTypeAny): ZodTypeAny {
  return typeName(schema) === "ZodEffects" ? unwrapEffects((schema._def as { schema: ZodTypeAny }).schema) : schema;
}
function shapeOf(schema: ZodTypeAny): Record<string, ZodTypeAny> {
  return (schema._def as { shape: () => Record<string, ZodTypeAny> }).shape();
}
/** A picture: an object with exactly a src and an alt. */
function isPicture(schema: ZodTypeAny): boolean {
  if (typeName(schema) !== "ZodObject") return false;
  const keys = Object.keys(shapeOf(schema));
  return keys.length === 2 && keys.includes("src") && keys.includes("alt");
}

function isLocalized(schema: ZodTypeAny): boolean {
  if (typeName(schema) !== "ZodObject") return false;
  const keys = Object.keys(shapeOf(schema));
  return keys.length === 2 && keys.includes("km") && keys.includes("en");
}
function stringChecks(schema: ZodTypeAny): { kind: string; value?: number }[] {
  return (schema._def as { checks?: { kind: string; value?: number }[] }).checks ?? [];
}
function maxLength(schema: ZodTypeAny | undefined): number | undefined {
  if (!schema) return undefined;
  return stringChecks(schema).find((check) => check.kind === "max")?.value;
}

/** A blank value that has the schema's shape — for "Add section", "Add item" and optional parts. */
export function emptyFor(raw: ZodTypeAny): Value {
  const schema = unwrapEffects(raw);
  switch (typeName(schema)) {
    case "ZodOptional":
      return undefined;
    case "ZodObject":
      return Object.fromEntries(Object.entries(shapeOf(schema)).map(([key, field]) => [key, emptyFor(field)]));
    case "ZodString":
      return "";
    case "ZodBoolean":
      return false;
    case "ZodLiteral": {
      const value = (schema._def as { value: unknown }).value;
      // A "must be ticked" literal (true) starts unticked, so a person has to tick it.
      return value === true ? false : value;
    }
    case "ZodEnum":
      return (schema._def as { values: string[] }).values[0];
    case "ZodArray": {
      const def = schema._def as { type: ZodTypeAny; minLength: { value: number } | null };
      return Array.from({ length: def.minLength?.value ?? 0 }, () => emptyFor(def.type));
    }
    case "ZodUnion": {
      const first = (schema._def as { options: ZodTypeAny[] }).options[0];
      return first ? emptyFor(first) : undefined;
    }
    default:
      return undefined;
  }
}

/** ISO time with an offset ⇄ the date-and-time box, always read and written as Phnom Penh time (+07:00). */
function isoToLocal(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  return new Date(time + 7 * 3600_000).toISOString().slice(0, 16);
}
function localToIso(local: string): string {
  return local ? `${local}:00+07:00` : "";
}

// ------------------------------------------------------------------ the form

interface FieldProps {
  schema: ZodTypeAny;
  value: Value;
  onChange: (value: Value) => void;
  /** Dotted path from the section, e.g. "steps.1.title" — how errors are found. */
  path: string;
  name: string;
  errors: Errors;
}

function useLabels() {
  const t = useTranslations("SiteEditor");
  const locale: "km" | "en" = useLocale() === "en" ? "en" : "km";
  const errorText = useFormErrorText();
  return {
    t,
    locale,
    field: (key: string) => (FIELD_KEYS.has(key) ? t(`field_${key}`) : key),
    option: (value: string) => (OPTION_KEYS.has(value) ? t(`option_${value}`) : value),
    error: (errors: Errors, path: string) => errorText(errors[path]),
  };
}

/** A field's name in the admin's language, e.g. "headline" → "Headline". */
export function useSiteFieldLabel() {
  return useLabels().field;
}

/** The fields of one object, in schema order. */
export function SchemaFields({ schema, value, onChange, path, errors }: Omit<FieldProps, "name">) {
  const shape = shapeOf(unwrapEffects(schema));
  const object = (value ?? {}) as Record<string, Value>;
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(shape)
        .filter(([key]) => !HIDDEN_KEYS.has(key))
        .map(([key, field]) => (
          <Field
            key={key}
            name={key}
            schema={field}
            value={object[key]}
            onChange={(next) => onChange({ ...object, [key]: next })}
            path={path ? `${path}.${key}` : key}
            errors={errors}
          />
        ))}
    </div>
  );
}

function Field(props: FieldProps) {
  const { schema: raw, value, onChange, path, name, errors } = props;
  const labels = useLabels();
  const schema = unwrapEffects(raw);
  const kind = typeName(schema);

  if (kind === "ZodOptional") {
    const inner = (schema._def as { innerType: ZodTypeAny }).innerType;
    const innerKind = typeName(unwrapEffects(inner));
    // A missing optional yes/no or choice is simply "no" / "none".
    if (innerKind === "ZodBoolean") return <Field {...props} schema={inner} value={value ?? false} />;
    if (innerKind === "ZodEnum") {
      const options = (inner._def as { values: string[] }).values;
      return (
        <Select
          label={`${labels.field(name)} ${labels.t("optional")}`}
          placeholder={labels.t("none")}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          options={options.map((option) => ({ value: option, label: labels.option(option) }))}
          error={labels.error(errors, path)}
        />
      );
    }
    if (value === undefined) {
      return (
        <button
          type="button"
          onClick={() => onChange(emptyFor(inner))}
          className="flex min-h-touch items-center gap-2 self-start rounded-DEFAULT px-2 text-sm font-medium text-brand hover:bg-brand/10"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {labels.t("addOptional", { field: labels.field(name) })}
        </button>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <Field {...props} schema={inner} />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="flex min-h-touch items-center gap-2 self-start rounded-DEFAULT px-2 text-sm text-muted hover:bg-border/30"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {labels.t("removeOptional", { field: labels.field(name) })}
        </button>
      </div>
    );
  }

  if (isLocalized(schema)) {
    const text = (value ?? { km: "", en: "" }) as { km: string; en: string };
    const shape = shapeOf(schema);
    const long = (maxLength(shape.km) ?? 0) >= 160;
    const Box = long ? Textarea : Input;
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-fg">{labels.field(name)}</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {(["km", "en"] as const).map((lang) => (
            <Box
              key={lang}
              label={labels.t(lang === "km" ? "khmer" : "english")}
              value={text[lang] ?? ""}
              onChange={(e) => onChange({ ...text, [lang]: e.target.value })}
              error={labels.error(errors, `${path}.${lang}`)}
              maxLength={maxLength(shape[lang])}
              {...(long ? { rows: 3 } : {})}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  if (kind === "ZodObject" && isPicture(schema)) return <PictureField {...props} schema={schema} />;

  switch (kind) {
    case "ZodObject":
      return (
        <fieldset className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-fg">{labels.field(name)}</legend>
          <SchemaFields schema={schema} value={value} onChange={onChange} path={path} errors={errors} />
        </fieldset>
      );
    case "ZodString": {
      if (stringChecks(schema).some((check) => check.kind === "datetime")) {
        return (
          <Input
            type="datetime-local"
            label={`${labels.field(name)} ${labels.t("phnomPenhTime")}`}
            value={isoToLocal(value)}
            onChange={(e) => onChange(localToIso(e.target.value))}
            error={labels.error(errors, path)}
          />
        );
      }
      return (
        <Input
          label={labels.field(name)}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={name === "href" ? labels.t("hrefHint") : undefined}
          error={labels.error(errors, path)}
          maxLength={maxLength(schema)}
        />
      );
    }
    case "ZodBoolean":
    case "ZodLiteral":
      if (kind === "ZodLiteral" && (schema._def as { value: unknown }).value !== true) return null;
      return (
        <div className="flex flex-col gap-1">
          <Switch checked={value === true} onChange={onChange} label={labels.field(name)} />
          {labels.error(errors, path) && <p className="text-sm text-danger">{labels.error(errors, path)}</p>}
        </div>
      );
    case "ZodEnum": {
      const options = (schema._def as { values: string[] }).values;
      return (
        <Select
          label={labels.field(name)}
          value={typeof value === "string" ? value : options[0]}
          onChange={(e) => onChange(e.target.value)}
          options={options.map((option) => ({ value: option, label: labels.option(option) }))}
          error={labels.error(errors, path)}
        />
      );
    }
    case "ZodUnion": {
      // A choice between shapes told apart by "kind" (e.g. the hero's art: Mio or a picture).
      const options = (schema._def as { options: ZodTypeAny[] }).options;
      const kinds = options.map((option) => (shapeOf(option).kind?._def as { value: string } | undefined)?.value ?? "");
      const current = ((value ?? {}) as { kind?: string }).kind ?? kinds[0] ?? "";
      const chosen = options[Math.max(0, kinds.indexOf(current))];
      if (!chosen) return null;
      return (
        <fieldset className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-fg">{labels.field(name)}</legend>
          <Select
            label={labels.field("kind")}
            value={current}
            onChange={(e) => {
              const picked = options[kinds.indexOf(e.target.value)];
              if (picked) onChange(emptyFor(picked));
            }}
            options={kinds.map((option) => ({ value: option, label: labels.option(option) }))}
          />
          <SchemaFields schema={chosen} value={value} onChange={onChange} path={path} errors={errors} />
        </fieldset>
      );
    }
    case "ZodArray":
      return <ArrayField {...props} schema={schema} />;
    default:
      return null;
  }
}

function ArrayField({ schema, value, onChange, path, name, errors }: FieldProps) {
  const labels = useLabels();
  const def = schema._def as { type: ZodTypeAny; minLength: { value: number } | null; maxLength: { value: number } | null };
  const items = Array.isArray(value) ? value : [];
  const min = def.minLength?.value ?? 0;
  const max = def.maxLength?.value ?? Infinity;
  const move = (from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold text-fg">
        {labels.field(name)} <span className="font-normal text-muted">({items.length})</span>
      </legend>
      {labels.error(errors, path) && <p className="text-sm text-danger">{labels.error(errors, path)}</p>}
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-muted">{labels.t("itemNumber", { number: index + 1 })}</span>
            <div className="flex gap-1">
              <IconButton label={labels.t("moveUp")} disabled={index === 0} onClick={() => move(index, index - 1)}>
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <IconButton label={labels.t("moveDown")} disabled={index === items.length - 1} onClick={() => move(index, index + 1)}>
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <IconButton label={labels.t("removeItem")} disabled={items.length <= min} onClick={() => onChange(items.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
          {/* An item that is a group of fields shows them directly; the box above already frames it. */}
          {typeName(unwrapEffects(def.type)) === "ZodObject" && !isLocalized(unwrapEffects(def.type)) ? (
            <SchemaFields
              schema={def.type}
              value={item}
              onChange={(next) => onChange(items.map((current, i) => (i === index ? next : current)))}
              path={`${path}.${index}`}
              errors={errors}
            />
          ) : (
            <Field
              schema={def.type}
              value={item}
              onChange={(next) => onChange(items.map((current, i) => (i === index ? next : current)))}
              path={`${path}.${index}`}
              name={name}
              errors={errors}
            />
          )}
        </div>
      ))}
      {items.length < max && (
        <Button type="button" variant="secondary" onClick={() => onChange([...items, emptyFor(def.type)])} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {labels.t("addItem")}
        </Button>
      )}
    </fieldset>
  );
}

export function IconButton({ label, disabled, onClick, children, className }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("flex h-11 w-11 items-center justify-center rounded-DEFAULT text-muted hover:bg-border/30 hover:text-fg disabled:opacity-30", className)}
    >
      {children}
    </button>
  );
}

/** Minutes between an ISO time and now, never negative. */
export function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
}

/**
 * A picture field: a thumbnail and "Choose from the library" (A12), which sets
 * the src to "library:<id>" and fills in the picture's description — still
 * editable. An outside https address can be typed instead.
 */
function PictureField({ schema, value, onChange, path, name, errors }: FieldProps) {
  const labels = useLabels();
  const website = useWebsite();
  const [choosing, setChoosing] = useState(false);
  const picture = (value ?? { src: "", alt: { km: "", en: "" } }) as { src: string; alt: { km: string; en: string } };
  const shape = shapeOf(schema);
  const preview = picture.src ? website.resolveImage(picture.src) : "";
  const fromLibrary = picture.src.startsWith(LIBRARY_SRC_PREFIX);

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-fg">{labels.field(name)}</legend>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-DEFAULT bg-canvas">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a library file (data URL in the mockup)
            <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Button type="button" variant="secondary" onClick={() => setChoosing(true)}>
            {picture.src ? labels.t("picChange") : labels.t("picChoose")}
          </Button>
          {!picture.src && <span className="text-xs text-muted">{labels.t("picNone")}</span>}
        </div>
      </div>
      {labels.error(errors, `${path}.src`) && <p className="text-sm text-danger">{labels.error(errors, `${path}.src`)}</p>}
      {!fromLibrary && (
        <Input
          label={labels.t("picOther")}
          value={picture.src}
          placeholder="https://…"
          onChange={(e) => onChange({ ...picture, src: e.target.value })}
        />
      )}
      {shape.alt && <Field schema={shape.alt} value={picture.alt} onChange={(alt) => onChange({ ...picture, alt })} path={`${path}.alt`} name="alt" errors={errors} />}

      <BottomSheet open={choosing} onClose={() => setChoosing(false)} closeLabel={labels.t("close")} title={labels.t("picChooseTitle")} placement="center" wide>
        {website.pictures.length === 0 ? (
          <p className="text-sm text-muted">{labels.t("picEmpty")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {website.pictures.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ src: `${LIBRARY_SRC_PREFIX}${item.id}`, alt: item.alt });
                    setChoosing(false);
                  }}
                  className={cn(
                    "flex w-full flex-col gap-2 rounded-DEFAULT border p-2 text-left hover:border-brand",
                    picture.src === `${LIBRARY_SRC_PREFIX}${item.id}` ? "border-2 border-brand" : "border-border",
                  )}
                >
                  <span className="flex aspect-square items-center justify-center overflow-hidden rounded-DEFAULT bg-canvas">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a library file */}
                    <img src={item.file} alt="" className="max-h-full max-w-full object-contain" />
                  </span>
                  <span className="line-clamp-2 text-xs">{item.alt[labels.locale]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </fieldset>
  );
}
