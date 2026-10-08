"use client";

import {
  formatKhmerPhoneLocal,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  otpCodeSchema,
  phoneLoginSchema,
  toFieldErrors,
  type FormErrorCode,
} from "@khmio/shared";
import { Button, Input, Mio, SegmentedControl, ThemeSwitcher } from "@khmio/ui";
import { ArrowLeft, Phone, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { mockMerchant } from "@/mock/mock-data";
import { useFormErrorText } from "@/components/form-ui";
import { SignUpFrame } from "@/components/sign-up-frame";
import { useThemeLabels } from "@/components/use-theme-labels";
import { useMerchantAccount } from "../merchant-account-context";
import { useMerchantProfile } from "../merchant-profile-context";

type Step = "choose" | "phone" | "code";

// One screen for sign-up and log-in (docs/blueprint.md "Security"): the
// first verified login creates the account. Telegram is one tap; a phone
// number with an SMS code works for everyone else. Google comes later.
export default function MerchantLoginMockupPage() {
  const t = useTranslations("MerchantLogin");
  const tMascot = useTranslations("Mascot");
  const errorText = useFormErrorText();
  const themeLabels = useThemeLabels();
  const locale = useLocale();
  const router = useRouter();
  const { signIn } = useMerchantAccount();
  const { hasProfile, hydrated: profileReady } = useMerchantProfile();

  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState<"telegram" | "phone" | "code" | null>(null);
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [phoneError, setPhoneError] = useState<FormErrorCode | undefined>();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [attemptsLeft, setAttemptsLeft] = useState(OTP_MAX_ATTEMPTS);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // Resend countdown — the API refuses a new SMS before it ends, so the button waits too.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  /** A new merchant sets up their shop; a returning one goes straight to work. */
  function finishLogin() {
    router.push(`/${locale}/mockup/${profileReady && hasProfile ? "dashboard" : "onboarding"}`);
  }

  // Mock only: the real Telegram Login Widget returns a signed payload that
  // the server verifies with the bot token and rejects if older than 24 hours.
  function handleTelegram() {
    setBusy("telegram");
    setTimeout(() => {
      signIn({ method: "telegram", account: `@${mockMerchant.telegramUsername}` });
      finishLogin();
    }, 900);
  }

  function sendCode() {
    setBusy("phone");
    // Mock: the real API sends the SMS here (after a bot check, rate-limited per phone and device).
    setTimeout(() => {
      setBusy(null);
      setCode("");
      setCodeError(undefined);
      setAttemptsLeft(OTP_MAX_ATTEMPTS);
      setResendIn(OTP_RESEND_SECONDS);
      setStep("code");
    }, 700);
  }

  function handlePhoneSubmit(event: FormEvent) {
    event.preventDefault();
    const result = phoneLoginSchema.safeParse({ phone });
    if (!result.success) {
      setPhoneError(toFieldErrors(result.error).phone);
      return;
    }
    setNormalizedPhone(result.data.phone);
    sendCode();
  }

  function handleCodeSubmit(event: FormEvent) {
    event.preventDefault();
    if (attemptsLeft <= 0) return;
    const result = otpCodeSchema.safeParse(code);
    if (!result.success) {
      setCodeError(errorText(toFieldErrors(result.error)[""]));
      return;
    }
    setBusy("code");
    // Mock: every 6-digit code is right except 000000, so the wrong-code path can be tried.
    setTimeout(() => {
      setBusy(null);
      if (result.data === "000000") {
        const left = attemptsLeft - 1;
        setAttemptsLeft(left);
        setCodeError(left > 0 ? t("wrongCode", { count: left }) : t("tooManyTries"));
        return;
      }
      signIn({ method: "phone", account: normalizedPhone });
      finishLogin();
    }, 700);
  }

  const languageSwitch = (
    <SegmentedControl
      value={locale}
      onChange={(next) => router.push(`/${next}/mockup/merchant-login`)}
      options={[
        { value: "km", label: "ខ្មែរ" },
        { value: "en", label: "EN" },
      ]}
    />
  );

  return (
    <SignUpFrame
      controls={
        <>
          {languageSwitch}
          <ThemeSwitcher labels={themeLabels} />
        </>
      }
    >
      <div className="flex w-full flex-col gap-5 rounded-2xl border border-border bg-bg p-5 shadow-raised sm:p-8">
        {step !== "choose" && (
          <button
            type="button"
            onClick={() => {
              setStep(step === "code" ? "phone" : "choose");
              setCodeError(undefined);
            }}
            aria-label={t("back")}
            className="-m-2 flex h-11 w-11 items-center justify-center self-start rounded-full hover:bg-border/30"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        {step === "choose" && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              {/* On a laptop Mio is on the teal side already. */}
              <span className="lg:hidden">
                <Mio size={88} label={tMascot("label")} />
              </span>
              <h1 className="text-xl font-bold">{t("title")}</h1>
              <p className="text-sm text-muted">{t("subtitle")}</p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Telegram's own blue, as its brand guidelines ask for the sign-in button. */}
              <Button
                variant="primary"
                onClick={handleTelegram}
                loading={busy === "telegram"}
                disabled={busy !== null}
                className="w-full bg-[#24A1DE] text-white hover:bg-[#24A1DE]/90"
              >
                {busy === "telegram" ? (
                  t("verifying")
                ) : (
                  <>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {t("continueTelegram")}
                  </>
                )}
              </Button>
              <p className="-mt-1 text-center text-xs text-muted">{t("telegramPerk")}</p>

              <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                {t("or")}
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button variant="secondary" onClick={() => setStep("phone")} disabled={busy !== null} className="w-full">
                <Phone className="h-4 w-4" aria-hidden="true" />
                {t("continuePhone")}
              </Button>
            </div>

            <p className="text-center text-xs text-muted">{t("terms")}</p>
            <p className="text-center text-xs text-muted/80">{t("mockNote")}</p>
          </>
        )}

        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold">{t("phoneTitle")}</h1>
              <p className="text-sm text-muted">{t("phoneHint")}</p>
            </div>
            <Input
              label={t("phoneLabel")}
              prefix="+855"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="012 345 678"
              autoFocus
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError(undefined);
              }}
              error={errorText(phoneError)}
            />
            <Button type="submit" variant="primary" loading={busy === "phone"} className="w-full">
              {t("sendCode")}
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold">{t("codeTitle")}</h1>
              <p className="text-sm text-muted">{t("codeSentTo", { phone: formatKhmerPhoneLocal(normalizedPhone) })}</p>
            </div>
            {/* One box, not six: paste and the phone's SMS autofill (one-time-code) just work. */}
            <Input
              ref={codeRef}
              label={t("codeLabel")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH + 1}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/[^\d\s]/g, ""));
                if (attemptsLeft > 0) setCodeError(undefined);
              }}
              error={codeError}
              className="text-center text-2xl font-semibold tracking-[0.5em]"
            />
            <Button
              type="submit"
              variant="primary"
              loading={busy === "code"}
              disabled={attemptsLeft <= 0}
              className="w-full"
            >
              {t("verifyCode")}
            </Button>
            <div className="flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="flex min-h-touch items-center font-medium text-brand"
              >
                {t("changeNumber")}
              </button>
              {resendIn > 0 ? (
                <span className="text-muted" aria-live="polite">
                  {t("resendIn", { seconds: resendIn })}
                </span>
              ) : (
                <button type="button" onClick={sendCode} className="flex min-h-touch items-center font-medium text-brand">
                  {t("resendCode")}
                </button>
              )}
            </div>
            <p className="text-center text-xs text-muted/80">{t("mockCodeNote")}</p>
          </form>
        )}
      </div>
    </SignUpFrame>
  );
}
