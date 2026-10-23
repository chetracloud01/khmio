"use client";

import { SegmentedControl, ThemeSwitcher } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useThemeLabels } from "@/components/use-theme-labels";
import { AppBlocksTab } from "./app-blocks-tab";
import { FoundationsTab } from "./foundations-tab";
import { KitTab } from "./kit-tab";
import { WebsiteTab } from "./website-tab";

// The one place to see the app's standard, in the viewer's theme and accent
// (switch them top right): Foundations (colours, type, brand), the Kit
// (every part in packages/ui), App blocks (shared parts in
// apps/web/components) and the Website parts. A new screen is built from
// what's here; a part that's missing is added, shown here first, then used.
// coverage.test.ts fails if a kit part is left off.

const TABS = ["foundations", "kit", "app", "website"] as const;
type Tab = (typeof TABS)[number];
const isTab = (value: string): value is Tab => (TABS as readonly string[]).includes(value);

export default function StyleguidePage() {
  const t = useTranslations("Styleguide");
  const themeLabels = useThemeLabels();
  const [tab, setTab] = useState<Tab>("foundations");

  // The tab is kept in the address (#kit), so a refresh or a shared link opens it again.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (isTab(fromHash)) setTab(fromHash);
  }, []);
  function choose(next: string) {
    if (!isTab(next)) return;
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  return (
    <main className="min-h-dvh bg-canvas text-fg">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8 p-4 pb-12 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <ThemeSwitcher labels={themeLabels} />
          </div>
          <p className="max-w-2xl text-sm text-muted">{t("intro")}</p>
          {/* On a narrow phone the tabs slide sideways in their own strip; the page itself never does. */}
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <SegmentedControl
              value={tab}
              onChange={choose}
              options={[
                { value: "foundations", label: t("tabFoundations") },
                { value: "kit", label: t("tabKit") },
                { value: "app", label: t("tabApp") },
                { value: "website", label: t("tabWebsite") },
              ]}
            />
          </div>
        </div>

        {tab === "foundations" && <FoundationsTab />}
        {tab === "kit" && <KitTab />}
        {tab === "app" && <AppBlocksTab />}
        {tab === "website" && <WebsiteTab />}
      </div>
    </main>
  );
}
