"use client";

import { KhmioLogo, KhmioMark, Mio } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { Demo, Section, Swatch } from "./styleguide-ui";

/** Colours, type and the brand marks: what every part is made of. */
export function FoundationsTab() {
  const t = useTranslations("Styleguide");
  const tMascot = useTranslations("Mascot");

  return (
    <>
      <Section title={t("colors")} description={t("colorsHint")}>
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

      <Section title={t("brandTitle")} description={t("brandHint")}>
        <div className="flex flex-wrap items-end gap-8">
          <Demo name="KhmioLogo">
            <KhmioLogo />
          </Demo>
          <Demo name="KhmioMark">
            <div className="flex items-end gap-3">
              <KhmioMark size={24} />
              <KhmioMark size={48} />
            </div>
          </Demo>
          <Demo name="Mio">
            <div className="flex items-end gap-3 text-brand">
              <Mio pose="face" size={72} label={tMascot("label")} />
              <Mio pose="coin" size={72} />
            </div>
          </Demo>
        </div>
      </Section>
    </>
  );
}
