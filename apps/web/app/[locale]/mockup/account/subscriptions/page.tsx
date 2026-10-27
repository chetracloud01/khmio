"use client";

import { formatKhr, formatUsd, PLANS, type Currency } from "@khmio/shared";
import { buttonVariants, Card, KhmioMark, cn } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { mockPlatformProducts } from "@/mock/mock-site";
import { STATUS_STYLES } from "../../admin/admin-ui";
import { useMerchantSubscription } from "../../merchant-subscription-context";

const money = (amount: number, currency: Currency) => (currency === "USD" ? formatUsd(amount) : formatKhr(amount));

// H2. My subscriptions (design/screens.md H2): each product's plan, status,
// next bill and history in one place. The rules are the Shop's (S12 and
// blueprint "Subscription life cycle"), so paying and changing plan open the
// Shop's billing page rather than doing it twice.
export default function AccountSubscriptionsPage() {
  const t = useTranslations("Account");
  const tPlans = useTranslations("Plans");
  const tBilling = useTranslations("Billing");
  const tDates = useTranslations("Dates");
  const locale = useLocale() === "en" ? "en" : "km";
  const { subscription } = useMerchantSubscription();
  const billingHref = `/${locale}/mockup/dashboard/billing`;

  const openInvoice = subscription.invoices.find((invoice) => invoice.status === "open");
  const price = subscription.billingCurrency === "USD" ? PLANS[subscription.plan].monthlyPrice.usdCents : PLANS[subscription.plan].monthlyPrice.khr;
  const statusLine = {
    trialing: tBilling("statusLineTrial", { count: subscription.daysLeft }),
    active: tBilling("statusLineActive", { count: subscription.daysLeft }),
    grace: tBilling("statusLineGrace", { count: subscription.daysLeft }),
    paused: tBilling("statusLinePaused"),
  }[subscription.status];
  const nextBill = openInvoice
    ? t("amountDue", { amount: money(openInvoice.amountMinor, openInvoice.currency) })
    : subscription.status === "active"
      ? t("nextBillIn", { amount: money(price, subscription.billingCurrency), count: subscription.daysLeft })
      : t("noBillYet");
  const history = [...subscription.invoices].sort((a, b) => a.createdDaysAgo - b.createdDaysAgo);
  const shop = mockPlatformProducts.find((product) => product.id === "shop");

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold leading-normal">{t("navSubscriptions")}</h1>
        <p className="text-sm text-muted">{t("subscriptionsIntro")}</p>
      </div>

      {shop && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <KhmioMark size={40} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">{shop.name}</span>
              <span className="text-sm text-muted">{statusLine}</span>
            </div>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[subscription.status])}>
              {tBilling(`status_${subscription.status}`)}
            </span>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col">
              <dt className="text-muted">{t("plan")}</dt>
              <dd className="font-semibold">{tPlans(subscription.plan)}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-muted">{t("nextBill")}</dt>
              <dd className={cn("font-semibold tabular-nums", openInvoice && "text-warning")}>{nextBill}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row">
            {openInvoice && (
              <Link href={billingHref} className={buttonVariants({ variant: "primary" })}>
                {t("payKhqr")}
              </Link>
            )}
            <Link href={billingHref} className={buttonVariants({ variant: "secondary" })}>
              {t("changePlan")}
            </Link>
          </div>
          <p className="text-xs text-muted">{t("actionsInShop")}</p>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <h2 className="text-sm font-semibold">{t("history")}</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted">{t("noPayments")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((invoice) => (
                  <li key={invoice.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      {tBilling(`reason_${invoice.reason}`)} · {tPlans(invoice.plan)}
                      <span className="block text-xs text-muted">
                        {invoice.createdDaysAgo === 0 ? tBilling("today") : tDates("daysAgo", { count: invoice.createdDaysAgo })}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{money(invoice.amountMinor, invoice.currency)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        invoice.status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
                      )}
                    >
                      {invoice.status === "paid" ? t("paid") : t("open")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      {mockPlatformProducts
        .filter((product) => product.status === "coming_soon")
        .map((product) => (
          <Card key={product.id} className="flex items-center gap-3 p-5">
            <KhmioMark size={40} className="opacity-40" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">{product.name}</span>
              <span className="text-sm text-muted">{t("notSubscribed")}</span>
            </div>
            <Link href={`/${locale}/mockup/site/products/${product.id}`} className={buttonVariants({ variant: "secondary" })}>
              {t("learnMore")}
            </Link>
          </Card>
        ))}
    </>
  );
}
