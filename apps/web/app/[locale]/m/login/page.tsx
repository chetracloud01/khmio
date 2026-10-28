"use client";

import type { TelegramLoginPayload } from "@khmio/shared";
import { Button, Card, Mio, ThemeSwitcher } from "@khmio/ui";
import { Car, FlaskConical, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { SignUpFrame } from "@/components/sign-up-frame";
import { BOT_USERNAME, SHOW_DEV_LOGIN, TelegramButton } from "@/components/telegram-button";
import { useThemeLabels } from "@/components/use-theme-labels";
import { ApiError, apiSend, getMe } from "@/lib/api";
import { AppLoading, AppOffline } from "../app-frame";

// Real merchant login (roadmap step 2). Sign-up and log-in are one flow:
// the first login creates the account, then onboarding asks two questions.
export default function LoginPage() {
  const t = useTranslations("App");
  const tMascot = useTranslations("Mascot");
  const tLogin = useTranslations("MerchantLogin");
  const themeLabels = useThemeLabels();
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "offline">("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(() => {
    setState("checking");
    getMe()
      .then((me) => (me ? router.replace(`/${locale}/m`) : setState("ready")))
      .catch(() => setState("offline"));
  }, [locale, router]);
  useEffect(check, [check]);

  async function signIn(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      await apiSend(path, { method: "POST", body });
      router.replace(`/${locale}/m`);
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 0 ? t("offlineBody") : caught instanceof ApiError && caught.code === "too_many_requests" ? t("tooManyTries") : t("loginFailed"));
      setBusy(false);
    }
  }

  const onTelegram = useCallback((user: TelegramLoginPayload) => void signIn("/auth/telegram", user), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "checking") return <AppLoading />;
  if (state === "offline") return <AppOffline onRetry={check} />;

  return (
    <SignUpFrame
      controls={
        <>
          <LanguageSwitch />
          <ThemeSwitcher labels={themeLabels} />
        </>
      }
    >
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-bg p-5 shadow-raised sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* On a laptop Mio is on the teal side already. */}
          <span className="lg:hidden">
            <Mio size={88} label={tMascot("label")} />
          </span>
          <h1 className="text-2xl font-bold leading-normal">{t("loginTitle")}</h1>
          <p className="text-sm text-muted">{t("loginSubtitle")}</p>
        </div>

        <div className="flex flex-col gap-3">
          {BOT_USERNAME ? (
            <>
              <TelegramButton onLogin={onTelegram} />
              <p className="text-center text-xs text-muted">{tLogin("telegramPerk")}</p>
            </>
          ) : (
            <p className="flex items-start gap-2 text-sm text-muted">
              <Send className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t("telegramNotSetUp")}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>

      {SHOW_DEV_LOGIN && (
        <Card className="flex flex-col gap-3 border-dashed p-4">
          <div className="flex items-start gap-2">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{t("devLoginTitle")}</p>
              <p className="text-sm text-muted">{t("devLoginHint")}</p>
            </div>
          </div>
          {/* Garage first: only the Demo Garage (pnpm demo:garage). Test shops A and B stay in the API for the end-to-end checks. */}
          <div className="grid grid-cols-1 gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void signIn("/auth/dev-login", { as: "garage" })}>
              <Car className="h-4 w-4" aria-hidden="true" />
              {t("devLoginGarage")}
            </Button>
          </div>
        </Card>
      )}
    </SignUpFrame>
  );
}
