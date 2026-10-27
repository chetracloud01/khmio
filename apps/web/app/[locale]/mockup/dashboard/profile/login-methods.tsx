"use client";

import {
  canUnlinkLoginMethod,
  ENABLED_LOGIN_METHODS,
  formatKhmerPhoneLocal,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  otpCodeSchema,
  phoneLoginSchema,
  toFieldErrors,
  type FormErrorCode,
  type LoginMethod,
} from "@khmio/shared";
import { BottomSheet, Button, Card, Input } from "@khmio/ui";
import { KeyRound, Phone, Plus, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { mockMerchant } from "@/mock/mock-data";
import { useFormErrorText } from "@/components/form-ui";
import { useMerchantAccount } from "../../merchant-account-context";

const METHOD_ICONS: Record<LoginMethod, typeof Phone> = { telegram: Send, phone: Phone, google: KeyRound };

/**
 * The ways into this account. More than one means a lost phone or a
 * Telegram problem never locks the merchant out; the last one can't be removed.
 */
export function LoginMethods() {
  const t = useTranslations("LoginMethods");
  const errorText = useFormErrorText();
  const { logins, signIn, unlink } = useMerchantAccount();
  const unlinkAllowed = canUnlinkLoginMethod(logins.length);
  const missing = ENABLED_LOGIN_METHODS.filter((method) => !logins.some((login) => login.method === method));

  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [phoneSheet, setPhoneSheet] = useState<"phone" | "code" | null>(null);
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [phoneError, setPhoneError] = useState<FormErrorCode | undefined>();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<FormErrorCode | undefined>();
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function accountLabel(method: LoginMethod, account: string) {
    return method === "phone" ? formatKhmerPhoneLocal(account) : account;
  }

  // Mock of the Telegram Login Widget.
  function linkTelegram() {
    setLinkingTelegram(true);
    setTimeout(() => {
      signIn({ method: "telegram", account: `@${mockMerchant.telegramUsername}` });
      setLinkingTelegram(false);
    }, 900);
  }

  function openPhoneSheet() {
    setPhone("");
    setCode("");
    setPhoneError(undefined);
    setCodeError(undefined);
    setPhoneSheet("phone");
  }

  function handlePhoneSubmit(event: FormEvent) {
    event.preventDefault();
    const result = phoneLoginSchema.safeParse({ phone });
    if (!result.success) {
      setPhoneError(toFieldErrors(result.error).phone);
      return;
    }
    setNormalizedPhone(result.data.phone);
    setResendIn(OTP_RESEND_SECONDS);
    setPhoneSheet("code");
  }

  // Same proof as logging in: the number is linked only after its SMS code is entered.
  function handleCodeSubmit(event: FormEvent) {
    event.preventDefault();
    const result = otpCodeSchema.safeParse(code);
    if (!result.success) {
      setCodeError(toFieldErrors(result.error)[""]);
      return;
    }
    signIn({ method: "phone", account: normalizedPhone });
    setPhoneSheet(null);
  }

  return (
    <Card className="flex flex-col gap-3 p-4 md:p-6">
      <div>
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("description")}</p>
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-DEFAULT border border-border">
        {logins.length === 0 && <li className="p-3 text-sm text-muted">{t("none")}</li>}
        {logins.map((login) => {
          const Icon = METHOD_ICONS[login.method];
          return (
            <li key={login.method} className="flex items-center gap-3 p-3">
              <Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t(`method_${login.method}`)}</p>
                <p className="truncate text-xs text-muted">{accountLabel(login.method, login.account)}</p>
              </div>
              <button
                type="button"
                onClick={() => unlink(login.method)}
                disabled={!unlinkAllowed}
                title={unlinkAllowed ? undefined : t("lastMethod")}
                className="flex min-h-touch items-center px-2 text-sm font-medium text-danger disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60"
              >
                {t("unlink")}
              </button>
            </li>
          );
        })}
      </ul>
      {!unlinkAllowed && logins.length === 1 && <p className="text-xs text-muted">{t("addSecondHint")}</p>}

      {missing.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {missing.includes("telegram") && (
            <Button variant="secondary" onClick={linkTelegram} loading={linkingTelegram} className="w-full">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("linkTelegram")}
            </Button>
          )}
          {missing.includes("phone") && (
            <Button variant="secondary" onClick={openPhoneSheet} className="w-full">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("linkPhone")}
            </Button>
          )}
        </div>
      )}

      <BottomSheet
        open={phoneSheet !== null}
        onClose={() => setPhoneSheet(null)}
        closeLabel={t("cancel")}
        title={phoneSheet === "code" ? t("codeTitle") : t("linkPhone")}
        placement="center"
      >
        {phoneSheet === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              label={t("phoneLabel")}
              prefix="+855"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="012 345 678"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError(undefined);
              }}
              error={errorText(phoneError)}
            />
            <Button type="submit" variant="primary" className="w-full">
              {t("sendCode")}
            </Button>
          </form>
        )}
        {phoneSheet === "code" && (
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4" noValidate>
            <p className="text-sm text-muted">{t("codeSentTo", { phone: formatKhmerPhoneLocal(normalizedPhone) })}</p>
            <Input
              label={t("codeLabel")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH + 1}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/[^\d\s]/g, ""));
                setCodeError(undefined);
              }}
              error={errorText(codeError)}
              className="text-center text-2xl font-semibold tracking-[0.5em]"
            />
            <Button type="submit" variant="primary" className="w-full">
              {t("verifyAndLink")}
            </Button>
            {resendIn > 0 ? (
              <p className="text-center text-sm text-muted" aria-live="polite">
                {t("resendIn", { seconds: resendIn })}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setResendIn(OTP_RESEND_SECONDS)}
                className="flex min-h-touch items-center justify-center text-sm font-medium text-brand"
              >
                {t("resendCode")}
              </button>
            )}
          </form>
        )}
      </BottomSheet>
    </Card>
  );
}
