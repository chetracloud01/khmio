"use client";

import {
  toFieldErrors,
  WAITLIST_BUSINESS_TYPES,
  waitlistSignupSchema,
  type FormErrorCode,
  type PlatformProductId,
  type SiteSectionOf,
  type WaitlistSignup,
} from "@khmio/shared";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../Button";
import { Input } from "../Input";
import { Mio } from "../Mio";
import { Select } from "../Select";
import { pick, SiteContainer, type SiteKitContext } from "./kit";

type BusinessType = (typeof WAITLIST_BUSINESS_TYPES)[number];
type Field = "name" | "phone" | "businessType";

/** The form's fixed words, from the translation files. */
export interface SiteWaitlistLabels {
  name: string;
  phone: string;
  businessType: string;
  choose: string;
  businessTypes: Record<BusinessType, string>;
  submit: string;
  privacy: string;
  errorText: (code: FormErrorCode) => string;
  /** What went wrong when the sign-up couldn't be saved (no connection, too many tries, the bot check). */
  submitError: (error: unknown) => string;
}

export interface SiteWaitlistContext {
  /** The product this page is about; the sign-up is for it. */
  product: PlatformProductId;
  labels: SiteWaitlistLabels;
  /** Saves a checked sign-up; throws when it can't. The mockup keeps it on the device; the live site sends it to the API. */
  submit: (signup: WaitlistSignup) => Promise<void>;
  /** The live site's bot check, shown above the button (nothing in the mockup). */
  botCheck?: ReactNode;
  /** A line under the form, e.g. the mockup's note. */
  note?: string;
}

/**
 * "Tell me when it's ready" on a coming-soon product page. The fields are
 * fixed; the content only gives the title and the thank-you text. Checked by
 * the shared waitlist schema — the same one the API will use.
 */
export function WaitlistSection({ section, ctx }: { section: SiteSectionOf<"waitlist">; ctx: SiteKitContext }) {
  const waitlist = ctx.waitlist;
  const [values, setValues] = useState({ name: "", phone: "", businessType: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, FormErrorCode>>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const refs = { name: useRef<HTMLInputElement>(null), phone: useRef<HTMLInputElement>(null), businessType: useRef<HTMLSelectElement>(null) };
  if (!waitlist) return null;
  const { labels } = waitlist;

  function check(): { data: WaitlistSignup | null; errors: Partial<Record<Field, FormErrorCode>> } {
    const result = waitlistSignupSchema.safeParse({ product: waitlist?.product, ...values, businessType: values.businessType || undefined });
    return result.success ? { data: result.data, errors: {} } : { data: null, errors: toFieldErrors(result.error) };
  }

  /** Checked when the visitor leaves a field that has something in it. */
  function checkField(field: Field) {
    if (!values[field]) return;
    setErrors((current) => ({ ...current, [field]: check().errors[field] }));
  }

  function change(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const { data, errors: found } = check();
    if (!data) {
      setErrors(found);
      const first = (["name", "phone", "businessType"] as const).find((field) => found[field]);
      if (first) refs[first].current?.focus();
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await waitlist?.submit(data);
      setDone(true);
    } catch (error) {
      setProblem(waitlist?.labels.submitError(error) ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id={section.id} className="scroll-mt-20 bg-canvas py-12 sm:py-16">
      <SiteContainer className="max-w-[560px]">
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-bg p-5 shadow-card sm:p-8">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
              <Mio pose="face" size={96} label={ctx.labels.mio} />
              <p className="text-lg font-semibold">{pick(section.thanks, ctx.locale)}</p>
            </div>
          ) : (
            <form onSubmit={send} noValidate className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold leading-normal">{pick(section.title, ctx.locale)}</h2>
              <Input
                ref={refs.name}
                label={labels.name}
                autoComplete="name"
                value={values.name}
                onChange={(e) => change("name", e.target.value)}
                onBlur={() => checkField("name")}
                error={errors.name && labels.errorText(errors.name)}
              />
              <Input
                ref={refs.phone}
                label={labels.phone}
                prefix="+855"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="012 345 678"
                value={values.phone}
                onChange={(e) => change("phone", e.target.value)}
                onBlur={() => checkField("phone")}
                error={errors.phone && labels.errorText(errors.phone)}
              />
              <Select
                ref={refs.businessType}
                label={labels.businessType}
                placeholder={labels.choose}
                value={values.businessType}
                onChange={(e) => change("businessType", e.target.value)}
                options={WAITLIST_BUSINESS_TYPES.map((type) => ({ value: type, label: labels.businessTypes[type] }))}
                error={errors.businessType && labels.errorText(errors.businessType)}
              />
              {waitlist.botCheck}
              {problem && (
                <p role="alert" className="rounded-DEFAULT bg-danger/10 p-3 text-sm text-danger">
                  {problem}
                </p>
              )}
              <Button type="submit" loading={busy} fullWidth>
                {labels.submit}
              </Button>
              <p className="text-center text-xs text-muted">{labels.privacy}</p>
              {waitlist.note && <p className="text-center text-xs text-muted/80">{waitlist.note}</p>}
            </form>
          )}
        </div>
      </SiteContainer>
    </section>
  );
}
