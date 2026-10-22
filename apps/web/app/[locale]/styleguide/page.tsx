"use client";

import {
  ActionTiles,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DetailList,
  EmptyState,
  ErrorState,
  GroupTitle,
  IconBadge,
  Input,
  LoadingBlocks,
  Notice,
  PageHeader,
  PillInput,
  PillInputButton,
  PriceTag,
  SearchInput,
  SectionTitle,
  StatCard,
  StatusPill,
  Switch,
  ThemeSwitcher,
  type Tone,
} from "@khmio/ui";
import { Copy, FileDown, Inbox, Languages, Printer, QrCode, Search, Send, ShoppingBag, Store, Truck, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { MenuList } from "@/components/menu-list";
import { MoneyInput } from "@/components/money-input";
import { useThemeLabels } from "@/components/use-theme-labels";

// The one place to see the app's standard: colours, type, and every shared
// building block from packages/ui, in the viewer's theme and accent (switch
// them top right). A new screen is built from what's here; a block that's
// missing is added to packages/ui and shown here first.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-8">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex w-20 flex-col items-center gap-1 text-center">
      <div className={`h-14 w-14 rounded-DEFAULT border border-border ${className}`} />
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

const TONES: Tone[] = ["brand", "success", "warning", "danger", "info", "muted"];

export default function StyleguidePage() {
  const t = useTranslations("Styleguide");
  const themeLabels = useThemeLabels();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [switchOn, setSwitchOn] = useState(true);
  const [ticked, setTicked] = useState(false);
  const [usd, setUsd] = useState("8.50");
  const [khr, setKhr] = useState("");

  return (
    <main className="min-h-dvh bg-canvas text-fg">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8 p-4 pb-12 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <ThemeSwitcher labels={themeLabels} />
        </div>
        <p className="max-w-2xl text-sm text-muted">{t("intro")}</p>

        <Section title={t("colors")}>
          <div className="flex flex-wrap gap-4">
            <Swatch label={t("colorBrand")} className="bg-brand" />
            <Swatch label={t("colorSuccess")} className="bg-success" />
            <Swatch label={t("colorWarning")} className="bg-warning" />
            <Swatch label={t("colorDanger")} className="bg-danger" />
            <Swatch label={t("colorInfo")} className="bg-info" />
            <Swatch label={t("colorCanvas")} className="bg-canvas" />
            <Swatch label={t("colorCard")} className="bg-bg" />
            <Swatch label={t("colorText")} className="bg-fg" />
            <Swatch label={t("colorMuted")} className="bg-muted" />
          </div>
          <div className="flex max-w-xs flex-col gap-1 rounded-DEFAULT bg-nav-bg p-3 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-nav-muted">{t("navSample")}</span>
            <span className="relative flex min-h-touch items-center rounded-DEFAULT bg-nav-fg/10 px-3 font-medium text-nav-fg before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-nav-accent">
              {t("navCurrent")}
            </span>
            <span className="flex min-h-touch items-center justify-between px-3 text-nav-muted">
              {t("navOther")}
              <span className="rounded-full bg-nav-badge/15 px-2 py-0.5 text-xs font-semibold text-nav-badge">2</span>
            </span>
          </div>
        </Section>

        <Section title={t("typography")}>
          <p className="font-khmer text-base leading-relaxed">{t("typographySampleKhmer")}</p>
          <p className="text-base leading-relaxed">{t("typographySample")}</p>
        </Section>

        <Section title={t("pageBlocks")}>
          <Card className="flex flex-col gap-6 p-4">
            <PageHeader title={t("pageTitle")} description={t("pageDescription")} actions={<Button variant="primary">{t("pageAction")}</Button>} />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={Store} label={t("statShops")} value="128" />
              <StatCard icon={ShoppingBag} label={t("statOrders")} value="42" detail={t("statOrdersDetail")} tone="success" />
              <StatCard icon={TriangleAlert} label={t("statLate")} value="3" tone="warning" />
              <StatCard icon={TriangleAlert} label={t("statFailed")} value="1" tone="danger" />
            </div>
            <SectionTitle aside={<span className="text-sm font-medium text-brand">{t("viewAll")}</span>}>{t("sectionTitle")}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tone) => (
                <StatusPill key={tone} tone={tone}>
                  {t(`tone_${tone}`)}
                </StatusPill>
              ))}
            </div>
            <DetailList
              items={[
                { label: t("detailShop"), value: t("detailShopValue") },
                { label: t("detailPlan"), value: <StatusPill tone="success">{t("detailPlanValue")}</StatusPill> },
              ]}
            />
          </Card>
        </Section>

        <Section title={t("states")}>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-0">
              <EmptyState icon={Inbox} title={t("emptyTitle")} body={t("emptyBody")} action={<Button variant="primary">{t("emptyAction")}</Button>} />
            </Card>
            <Card className="p-4">
              <LoadingBlocks label={t("loading")} />
            </Card>
            <Card className="p-0">
              <ErrorState title={t("errorTitle")} body={t("errorBody")} retryLabel={t("retry")} onRetry={() => undefined} />
            </Card>
          </div>
          <Button variant="danger" className="self-start" onClick={() => setConfirmOpen(true)}>
            {t("confirmOpen")}
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            danger
            title={t("confirmTitle")}
            body={t("confirmBody")}
            confirmLabel={t("confirmYes")}
            cancelLabel={t("buttonSecondary")}
            onConfirm={() => setConfirmOpen(false)}
            onClose={() => setConfirmOpen(false)}
          />
        </Section>

        <div className="grid gap-8 md:grid-cols-2">
          <Section title={t("buttons")}>
            <Button variant="primary" fullWidth>
              {t("buttonPrimary")}
            </Button>
            <Button variant="secondary" fullWidth>
              {t("buttonSecondary")}
            </Button>
            <Button variant="danger" fullWidth>
              {t("buttonDanger")}
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={loading}
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 1500);
              }}
            >
              {loading ? t("buttonLoading") : t("buttonPrimary")}
            </Button>
          </Section>

          <Section title={t("inputs")}>
            <Input label={t("nameLabel")} placeholder={t("namePlaceholder")} />
            <Input label={t("phoneLabel")} prefix="+855" inputMode="tel" error={t("phoneError")} />
            {/* The one rounded field: search boxes, "Find order by code" and "Track my order". */}
            <SearchInput placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch("")} clearLabel={t("clear")} />
            <PillInput label={t("codeLabel")} labelHidden icon={<Search />} code placeholder={t("codePlaceholder")} action={<PillInputButton type="button">{t("find")}</PillInputButton>} />
            {/* On/off settings use Switch; choosing (rows, "remember me") uses Checkbox. */}
            <Switch checked={switchOn} onChange={setSwitchOn} label={t("switchLabel")} description={t("switchHint")} />
            <Checkbox checked={ticked} onChange={(e) => setTicked(e.target.checked)} label={t("checkboxLabel")} />
          </Section>

          <Section title={t("kitTitle")}>
            {/* Messages: one look per tone. */}
            <Notice tone="warning">{t("noticeWarning")}</Notice>
            <Notice tone="danger" role="alert">{t("noticeDanger")}</Notice>
            <Notice tone="info">{t("noticeInfo")}</Notice>
            <Notice tone="success" title={t("noticeSuccessTitle")}>{t("noticeSuccess")}</Notice>
            {/* Rows as data: My shop and any settings list. */}
            <MenuList
              title={t("menuTitle")}
              rows={[
                { key: "store", href: "#", icon: Store, tone: "brand", title: t("menuShop"), detail: t("menuShopDetail") },
                { key: "delivery", href: "#", icon: Truck, tone: "info", title: t("menuDelivery"), detail: t("menuDeliveryDetail") },
                { key: "language", href: "#", icon: Languages, tone: "success", title: t("menuLanguage"), value: "English" },
              ]}
            />
            <div className="flex items-center gap-3">
              <IconBadge icon={Store} />
              <IconBadge icon={Truck} tone="info" shape="circle" />
              <IconBadge icon={TriangleAlert} tone="warning" size="lg" />
              <GroupTitle as="span">{t("groupTitleSample")}</GroupTitle>
            </div>
            {/* Round icon buttons with names: the Share sheet (plain) and the invoice (boxed). */}
            <ActionTiles
              items={[
                { key: "qr", icon: QrCode, label: t("tileQr"), look: "primary" },
                { key: "copy", icon: Copy, label: t("tileCopy") },
                { key: "telegram", icon: Send, label: "Telegram", look: { className: "bg-[#229ED9] text-white" } },
                { key: "share", icon: Search, label: t("tileOther") },
              ]}
            />
            <ActionTiles
              variant="boxed"
              columns={3}
              items={[
                { key: "print", icon: Printer, label: t("tilePrint") },
                { key: "pdf", icon: FileDown, label: t("tilePdf"), busy: true },
                { key: "copy", icon: Copy, label: t("tileCopy") },
              ]}
            />
            {/* One price in dollars and riel; leaving one box fills the other at the rate. */}
            <MoneyInput usd={usd} khr={khr} onUsdChange={setUsd} onKhrChange={setKhr} usdLabel={t("priceUsd")} khrLabel={t("priceKhr")} autoFillRate={4100} />
          </Section>

          <Section title={t("cards")}>
            <Card className="flex items-center justify-between">
              <span className="font-medium">{t("cardDeliveryTitle")}</span>
              <span className="text-sm text-muted">{t("cardDeliveryFee")}</span>
            </Card>
            <Card className="flex items-center justify-between">
              <span className="font-medium">{t("cardPickupTitle")}</span>
              <span className="text-sm text-muted">{t("cardPickupFee")}</span>
            </Card>
          </Section>

          <Section title={t("prices")}>
            <PriceTag usdCents={850} khr={34850} />
            <PriceTag usdCents={500} />
            <PriceTag khr={20000} />
          </Section>
        </div>
      </div>
    </main>
  );
}
