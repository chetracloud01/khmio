"use client";

import {
  ActionTiles,
  Badge,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DetailList,
  DiscountBadge,
  EmptyState,
  ErrorState,
  GroupTitle,
  IconBadge,
  Input,
  LoadingBlocks,
  MoneyInput,
  Notice,
  PageHeader,
  PillInput,
  PillInputButton,
  PriceTag,
  SearchInput,
  SectionTitle,
  SegmentedControl,
  Select,
  Skeleton,
  StatCard,
  StatusPill,
  Switch,
  Textarea,
  ThemePicker,
  ThemeSwitcher,
  type Tone,
} from "@khmio/ui";
import { Copy, FileDown, Inbox, Printer, QrCode, Search, Send, ShoppingBag, Store, Truck, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useThemeLabels } from "@/components/use-theme-labels";
import { Demo, Section } from "./styleguide-ui";

const TONES: Tone[] = ["brand", "success", "warning", "danger", "info", "muted"];
const NOTE_MAX = 200;
type SheetPlacement = "bottom" | "side" | "center";

/** Every part in packages/ui: pure look and behaviour, no words of its own. */
export function KitTab() {
  const t = useTranslations("Styleguide");
  const themeLabels = useThemeLabels();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetPlacement | null>(null);
  const [search, setSearch] = useState("");
  const [switchOn, setSwitchOn] = useState(true);
  const [ticked, setTicked] = useState(false);
  const [fulfilment, setFulfilment] = useState("delivery");
  const [province, setProvince] = useState("");
  const [note, setNote] = useState("");
  const [usd, setUsd] = useState("8.50");
  const [khr, setKhr] = useState("");

  return (
    <>
      <Section title={t("pageBlocks")}>
        <Card className="flex flex-col gap-6 p-4">
          <Demo name="PageHeader">
            <PageHeader title={t("pageTitle")} description={t("pageDescription")} actions={<Button variant="primary">{t("pageAction")}</Button>} />
          </Demo>
          <Demo name="StatCard" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={Store} label={t("statShops")} value="128" />
            <StatCard icon={ShoppingBag} label={t("statOrders")} value="42" detail={t("statOrdersDetail")} tone="success" />
            <StatCard icon={TriangleAlert} label={t("statLate")} value="3" tone="warning" />
            <StatCard icon={TriangleAlert} label={t("statFailed")} value="1" tone="danger" />
          </Demo>
          <Demo name="SectionTitle">
            <SectionTitle aside={<span className="text-sm font-medium text-brand">{t("viewAll")}</span>}>{t("sectionTitle")}</SectionTitle>
          </Demo>
          <Demo name="StatusPill" className="flex-row flex-wrap gap-2">
            {TONES.map((tone) => (
              <StatusPill key={tone} tone={tone}>
                {t(`tone_${tone}`)}
              </StatusPill>
            ))}
          </Demo>
          <Demo name="DetailList">
            <DetailList
              items={[
                { label: t("detailShop"), value: t("detailShopValue") },
                { label: t("detailPlan"), value: <StatusPill tone="success">{t("detailPlanValue")}</StatusPill> },
              ]}
            />
          </Demo>
        </Card>
      </Section>

      <Section title={t("states")}>
        <div className="grid gap-4 md:grid-cols-3">
          <Demo name="EmptyState">
            <Card className="p-0">
              <EmptyState icon={Inbox} title={t("emptyTitle")} body={t("emptyBody")} action={<Button variant="primary">{t("emptyAction")}</Button>} />
            </Card>
          </Demo>
          <Demo name="LoadingBlocks">
            <Card className="p-4">
              <LoadingBlocks label={t("loading")} />
            </Card>
          </Demo>
          <Demo name="ErrorState">
            <Card className="p-0">
              <ErrorState title={t("errorTitle")} body={t("errorBody")} retryLabel={t("retry")} onRetry={() => undefined} />
            </Card>
          </Demo>
        </div>
        {/* A placeholder in the shape of what's coming; the page around it says "Loading" once. */}
        <Demo name="Skeleton">
          <Card className="flex items-center gap-3 p-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </Card>
        </Demo>
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title={t("buttons")}>
          <Demo name="Button">
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
          </Demo>
          {/* Round icon buttons with names: the Share sheet (plain) and the invoice (boxed). */}
          <Demo name="ActionTiles">
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
          </Demo>
        </Section>

        <Section title={t("inputs")}>
          <Demo name="Input">
            <Input label={t("nameLabel")} placeholder={t("namePlaceholder")} />
            <Input label={t("phoneLabel")} prefix="+855" inputMode="tel" error={t("phoneError")} />
          </Demo>
          <Demo name="Select">
            <Select
              label={t("selectLabel")}
              placeholder={t("selectPlaceholder")}
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              options={[
                { value: "pp", label: t("selectPhnomPenh") },
                { value: "sr", label: t("selectSiemReap") },
                { value: "bb", label: t("selectBattambang") },
              ]}
            />
          </Demo>
          <Demo name="Textarea">
            <Textarea
              label={t("noteLabel")}
              placeholder={t("notePlaceholder")}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              counter={`${note.length} / ${NOTE_MAX}`}
            />
          </Demo>
          {/* The one rounded field: search boxes, "Find order by code" and "Track my order". */}
          <Demo name="SearchInput">
            <SearchInput placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch("")} clearLabel={t("clear")} />
          </Demo>
          <Demo name={["PillInput", "PillInputButton"]}>
            <PillInput label={t("codeLabel")} labelHidden icon={<Search />} code placeholder={t("codePlaceholder")} action={<PillInputButton type="button">{t("find")}</PillInputButton>} />
          </Demo>
          {/* One price in dollars and riel; leaving one box fills the other at the rate. */}
          <Demo name="MoneyInput">
            <MoneyInput usd={usd} khr={khr} onUsdChange={setUsd} onKhrChange={setKhr} usdLabel={t("priceUsd")} khrLabel={t("priceKhr")} autoFillRate={4100} />
          </Demo>
        </Section>

        <Section title={t("choices")}>
          {/* On/off settings use Switch; choosing (rows, "remember me") uses Checkbox; one of a few uses SegmentedControl. */}
          <Demo name="Switch">
            <Switch checked={switchOn} onChange={setSwitchOn} label={t("switchLabel")} description={t("switchHint")} />
          </Demo>
          <Demo name="Checkbox">
            <Checkbox checked={ticked} onChange={(e) => setTicked(e.target.checked)} label={t("checkboxLabel")} />
          </Demo>
          <Demo name="SegmentedControl">
            <SegmentedControl
              value={fulfilment}
              onChange={setFulfilment}
              options={[
                { value: "delivery", label: t("cardDeliveryTitle") },
                { value: "pickup", label: t("cardPickupTitle") },
              ]}
            />
          </Demo>
        </Section>

        <Section title={t("messagesTitle")}>
          {/* One look per tone. */}
          <Demo name="Notice">
            <Notice tone="warning">{t("noticeWarning")}</Notice>
            <Notice tone="danger" role="alert">
              {t("noticeDanger")}
            </Notice>
            <Notice tone="info">{t("noticeInfo")}</Notice>
            <Notice tone="success" title={t("noticeSuccessTitle")}>
              {t("noticeSuccess")}
            </Notice>
          </Demo>
        </Section>

        <Section title={t("badgesTitle")}>
          <Demo name="Badge" className="flex-row">
            <Badge>{t("badgeVerified")}</Badge>
            <Badge icon={false}>{t("badgeVerified")}</Badge>
          </Demo>
          <Demo name="DiscountBadge" className="flex-row">
            <DiscountBadge percent={20} />
          </Demo>
          <Demo name="IconBadge" className="flex-row items-center">
            <IconBadge icon={Store} />
            <IconBadge icon={Truck} tone="info" shape="circle" />
            <IconBadge icon={TriangleAlert} tone="warning" size="lg" />
          </Demo>
          <Demo name="GroupTitle">
            <GroupTitle as="span">{t("groupTitleSample")}</GroupTitle>
          </Demo>
        </Section>

        <Section title={t("cards")}>
          <Demo name="Card">
            <Card className="flex items-center justify-between">
              <span className="font-medium">{t("cardDeliveryTitle")}</span>
              <span className="text-sm text-muted">{t("cardDeliveryFee")}</span>
            </Card>
            <Card className="flex items-center justify-between">
              <span className="font-medium">{t("cardPickupTitle")}</span>
              <span className="text-sm text-muted">{t("cardPickupFee")}</span>
            </Card>
          </Demo>
        </Section>

        <Section title={t("prices")}>
          <Demo name="PriceTag">
            <PriceTag usdCents={850} khr={34850} />
            <PriceTag usdCents={500} />
            <PriceTag khr={20000} />
          </Demo>
        </Section>

        <Section title={t("overlays")}>
          {/* Phones always get a bottom sheet; from tablet up the placement decides. */}
          <Demo name="BottomSheet" className="flex-row flex-wrap">
            <Button variant="secondary" onClick={() => setSheet("bottom")}>
              {t("sheetBottom")}
            </Button>
            <Button variant="secondary" onClick={() => setSheet("side")}>
              {t("sheetSide")}
            </Button>
            <Button variant="secondary" onClick={() => setSheet("center")}>
              {t("sheetCenter")}
            </Button>
          </Demo>
          <Demo name="ConfirmDialog">
            <Button variant="danger" className="self-start" onClick={() => setConfirmOpen(true)}>
              {t("confirmOpen")}
            </Button>
          </Demo>
          <BottomSheet
            open={sheet !== null}
            onClose={() => setSheet(null)}
            closeLabel={t("close")}
            placement={sheet ?? "bottom"}
            title={t("sheetTitle")}
            footer={
              <Button variant="primary" fullWidth onClick={() => setSheet(null)}>
                {t("sheetDone")}
              </Button>
            }
          >
            <p className="text-sm text-muted">{t("sheetBody")}</p>
          </BottomSheet>
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
      </div>

      <Section title={t("themeTitle")} description={t("themeHint")}>
        <div className="flex flex-wrap items-start gap-8">
          <Demo name="ThemeSwitcher">
            <ThemeSwitcher labels={themeLabels} />
          </Demo>
          <Demo name="ThemePicker">
            <ThemePicker labels={themeLabels} />
          </Demo>
        </div>
      </Section>
    </>
  );
}
