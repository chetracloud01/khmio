"use client";

import { formatKhmerPhoneLocal, toFieldErrors, trackOrderInputSchema } from "@khmio/shared";
import { GroupTitle, Mio, Notice, PillInput } from "@khmio/ui";
import { History, Phone, Search, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { BuyerShell, BuyerTopBar } from "@/components/buyer-shell";
import { readStored, writeStored } from "@/lib/device-storage";

export type TrackOutcome = "found" | "not_found" | "too_many" | "offline";

/** The last order found on this phone: the code as typed, and the phone as 855… (the buyer's own device). */
const lastTrackedSchema = z.object({ code: z.string(), phone: z.string() });
type LastTracked = z.infer<typeof lastTrackedSchema>;
const LAST_TRACKED_KEY = "khmio.lastTracked";

/**
 * "Track my order" (design/screens.md B8), in the same style as the seller's
 * find-order bar: a code pill, a phone pill and a round Find button. The code
 * and the phone together open the order page; a wrong pair gets one message,
 * never which half was wrong. The last order found on this phone comes back
 * as a chip, so a returning buyer taps instead of typing. `find` gets the
 * checked input (the phone as 855…) and goes to the order itself when found.
 */
export function TrackForm({
  back,
  find,
  children,
}: {
  /** The top bar's back arrow: to the shop the buyer came from. */
  back: { href: string; label: string };
  find: (code: string, phone: string) => Promise<TrackOutcome>;
  children?: ReactNode;
}) {
  const t = useTranslations("Track");
  const tErrors = useTranslations("FormErrors");
  const tApp = useTranslations("App");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"code" | "phone", string>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<LastTracked | null>(null);
  useEffect(() => setLast(readStored(LAST_TRACKED_KEY, lastTrackedSchema)), []);

  async function run(codeInput: string, phoneInput: string) {
    setProblem(null);
    const parsed = trackOrderInputSchema.safeParse({ code: codeInput, phone: phoneInput });
    if (!parsed.success) {
      const fields = toFieldErrors(parsed.error);
      setErrors({ code: fields.code && tErrors(fields.code), phone: fields.phone && tErrors(fields.phone) });
      return;
    }
    setErrors({});
    setBusy(true);
    const outcome = await find(parsed.data.code, parsed.data.phone);
    setBusy(false);
    if (outcome === "found") {
      // Not kept when storage refuses: tracking still worked.
      writeStored(LAST_TRACKED_KEY, { code: parsed.data.code.trim().toUpperCase(), phone: parsed.data.phone });
    } else if (outcome === "not_found") setProblem(t("notFound"));
    else if (outcome === "too_many") setProblem(t("tooMany"));
    else setProblem(tApp("saveFailed"));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(code, phone);
  }

  return (
    <BuyerShell>
      <BuyerTopBar backHref={back.href} backLabel={back.label} title={t("title")} />
      <main className="flex flex-col gap-6 p-4 pt-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Mio pose="face" size={64} />
          <p className="max-w-[36ch] text-sm text-muted">{t("subtitle")}</p>
        </div>

        <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4 shadow-card">
          <PillInput
            label={t("codeLabel")}
            size="lg"
            icon={<Ticket className="text-brand" />}
            code
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t("codePlaceholder")}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            error={errors.code}
          />
          <PillInput
            label={t("phoneLabel")}
            size="lg"
            icon={<Phone className="text-brand" />}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("phonePlaceholder")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            error={errors.phone}
          />
          {problem && (
            <Notice tone="danger" role="alert">
              {problem}
            </Notice>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold text-on-brand shadow-raised disabled:opacity-60"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
            {t("submit")}
          </button>
        </form>

        {last && (
          <section className="flex flex-col gap-2">
            <GroupTitle as="span" className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              {t("lastTracked")}
            </GroupTitle>
            <button
              type="button"
              onClick={() => {
                const localPhone = formatKhmerPhoneLocal(last.phone);
                setCode(last.code);
                setPhone(localPhone);
                void run(last.code, localPhone);
              }}
              className="flex min-h-[52px] items-center justify-between gap-3 rounded-full border border-border bg-bg pl-4 pr-2 text-left shadow-card hover:border-brand/40"
            >
              <span className="min-w-0 truncate font-semibold tracking-wider tabular-nums">{last.code}</span>
              <span className="flex shrink-0 items-center rounded-full bg-brand/10 px-3 py-2 text-sm font-semibold text-brand">{t("openAgain")}</span>
            </button>
          </section>
        )}

        <section className="flex flex-col gap-1 rounded-2xl border border-border bg-bg p-4 text-sm">
          <h2 className="font-semibold">{t("whereTitle")}</h2>
          <p className="text-muted">{t("whereBody")}</p>
        </section>

        {children}
      </main>
    </BuyerShell>
  );
}
