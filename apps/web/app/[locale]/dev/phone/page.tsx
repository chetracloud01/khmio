import { isLocalNetworkHost } from "@khmio/shared";
import { Card, PageHeader } from "@khmio/ui";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { networkInterfaces } from "node:os";
import QRCode from "qrcode";

// Development only: open the app on a phone without typing an address. The
// PC's address changes with every Wi-Fi; this page reads it fresh each time
// and shows it as a QR code to scan with the phone's camera. The live site
// has no such page (404), and nothing here is ever indexed.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** This PC's addresses on the networks it's joined (Wi-Fi, cable, a phone's hotspot) — never 127.x or 169.254.x. */
function lanAddresses(): { name: string; address: string }[] {
  return Object.entries(networkInterfaces()).flatMap(([name, list]) =>
    (list ?? [])
      .filter((entry) => entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254.") && isLocalNetworkHost(entry.address))
      .map((entry) => ({ name, address: entry.address })),
  );
}

export default async function PhonePage({ params: { locale } }: { params: { locale: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  const t = await getTranslations("DevPhone");
  const port = headers().get("host")?.split(":")[1] ?? "3000";
  const networks = await Promise.all(
    lanAddresses().map(async (network) => {
      const base = `http://${network.address}:${port}`;
      return { ...network, base, qr: await QRCode.toDataURL(`${base}/${locale}`, { margin: 2, width: 480, errorCorrectionLevel: "M" }) };
    }),
  );
  const links = [
    { path: `/${locale}`, label: t("linkWebsite") },
    { path: `/${locale}/m/login`, label: t("linkSeller") },
    { path: `/${locale}/s/dev-merchant-a`, label: t("linkShop") },
    { path: `/${locale}/admin`, label: t("linkAdmin") },
    { path: `/${locale}/mockup`, label: t("linkMockups") },
  ];

  return (
    <main className="min-h-dvh bg-canvas text-fg">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 p-4 md:p-6">
        <PageHeader title={t("title")} description={t("description")} />
        {networks.length === 0 ? (
          <Card className="p-6 text-sm">{t("noNetwork")}</Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {networks.map((network) => (
              <Card key={network.address} className="flex flex-col gap-4 p-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a QR code made on this page */}
                  <img src={network.qr} alt={t("qrAlt", { address: network.base })} width={240} height={240} className="h-60 w-60 rounded-DEFAULT bg-white" />
                  <p className="text-lg font-semibold tabular-nums">{network.base}</p>
                  <p className="text-xs text-muted">{t("network", { name: network.name })}</p>
                </div>
                <ul className="flex flex-col divide-y divide-border text-sm">
                  {links.map((link) => (
                    <li key={link.path} className="flex min-h-touch flex-wrap items-center justify-between gap-x-3 py-2">
                      <span className="font-medium">{link.label}</span>
                      <a href={`${network.base}${link.path}`} className="break-all text-brand tabular-nums hover:underline">
                        {network.base}
                        {link.path}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
        <Card className="flex flex-col gap-2 p-4 text-sm">
          <h2 className="font-semibold">{t("helpTitle")}</h2>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>{t("help1")}</li>
            <li>{t("help2")}</li>
            <li>{t("help3")}</li>
          </ol>
        </Card>
      </div>
    </main>
  );
}
