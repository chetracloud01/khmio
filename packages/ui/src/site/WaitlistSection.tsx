"use client";

import { toFieldErrors, waitlistSignupSchema, type FormErrorCode, type SiteSectionOf, type WaitlistSignup } from "@khmio/shared";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../Button";
import { Input } from "../Input";
import { Mio } from "../Mio";
import { pick, SiteContainer, type SiteKitContext } from "./kit";

type Field = "name" | "phone";

/** The form's fixed words, from the translation files. */
export interface SiteWaitlistLabels {
  name: string;
  phone: string;
  submit: string;
  privacy: string;
  errorText: (code: FormErrorCode) => string;
  /** What went wrong when the sign-up couldn't be saved (no connection, too many tries, the bot check). */
  submitError: (error: unknown) => string;
}

export interface SiteWaitlistContext {
  labels: SiteWaitlistLabels;
  /** Saves a checked sign-up; throws when it can't. The live site sends it to the API; the styleguide only pretends. */
  submit: (signup: WaitlistSignup) => Promise<void>;
  /** The live site's bot check, shown above the button (nothing in the styleguide). */
  botCheck?: ReactNode;
  /** A line under the form, e.g. the styleguide's note. */
  note?: string;
}

/**
 * "Tell me when it's ready" on a coming-soon solution page: name and phone
 * only — the business is the page's own (Khmio Shop for that solution). The
 * fields are fixed; the content gives the title, the thank-you text and the
 * solution. Checked by the shared waitlist schema — the same one the API uses.
 */
export function WaitlistSection({ section, ctx }: { section: SiteSectionOf<"waitlist">; ctx: SiteKitContext }) {
  const waitlist = ctx.waitlist;
  const [values, setValues] = useState({ name: "", phone: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, FormErrorCode>>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const refs = { name: useRef<HTMLInputElement>(null), phone: useRef<HTMLInputElement>(null) };
  if (!waitlist) return null;
  const { labels } = waitlist;

  function check(): { data: WaitlistSignup | null; errors: Partial<Record<Field, FormErrorCode>> } {
    const result = waitlistSignupSchema.safeParse({ product: "shop", businessType: section.solution, ...values });
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
      const first = (["name", "phone"] as const).find((field) => found[field]);
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
    <section id={section.id} className="scroll-mt-20 bg-canvas py-16 sm:py-24">
      <SiteContainer className="max-w-[560px]">
        <div className="flex flex-col gap-5 rounded-3xl border border-border bg-bg p-6 shadow-raised sm:p-10">
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
              {waitlist.botCheck}
              {problem && (
                <p role="alert" className="rounded-DEFAULT bg-danger/10 p-3 text-sm text-danger">
                  {problem}
                </p>
              )}
              <Button type="submit" loading={busy} fullWidth className="rounded-full">
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
