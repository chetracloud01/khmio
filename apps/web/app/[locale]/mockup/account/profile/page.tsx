"use client";

import { buttonVariants, Card } from "@khmio/ui";
import { Phone, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { useDateText } from "@/components/use-date-text";
import { mockMerchant } from "@/mock/mock-data";
import { useMerchantAccount } from "../../merchant-account-context";

// H3. Account (design/screens.md H3): the person behind every Khmio product —
// name, how they log in, and the language — the same everywhere.
export default function AccountProfilePage() {
  const t = useTranslations("Account");
  const locale = useLocale();
  const { logins } = useMerchantAccount();
  const { date } = useDateText();

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold leading-normal">{t("navAccount")}</h1>
        <p className="text-sm text-muted">{t("accountIntro")}</p>
      </div>

      <Card className="flex flex-col gap-1 p-5">
        <span className="text-sm text-muted">{t("name")}</span>
        <span className="text-lg font-semibold">
          {mockMerchant.firstName} {mockMerchant.lastName}
        </span>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-semibold">{t("logins")}</h2>
        {logins.length === 0 ? (
          <p className="text-sm text-muted">{t("noLogins")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {logins.map((login) => (
              <li key={login.method} className="flex items-center gap-3 py-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  {login.method === "telegram" ? <Send className="h-4 w-4" aria-hidden="true" /> : <Phone className="h-4 w-4" aria-hidden="true" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{login.method === "telegram" ? t("loginTelegram") : t("loginPhone")}</span>
                  <span className="truncate text-sm text-muted">{login.account}</span>
                </span>
                <span className="text-xs text-muted">{t("linkedOn", { date: date(login.linkedAtIso) })}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">{t("manageLogins")}</p>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-semibold">{t("language")}</h2>
        <p className="text-sm text-muted">{t("languageHint")}</p>
        <LanguageSwitch size="long" className="self-start" />
      </Card>

      <Link href={`/${locale}/mockup/merchant-login`} className={buttonVariants({ variant: "secondary" })}>
        {t("signOut")}
      </Link>
    </>
  );
}
