import type { Metadata, Viewport } from "next";
import { Kantumruy_Pro } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { THEME_BOOT_SCRIPT } from "@khmio/ui";
import { isValidLocale, routing } from "@/i18n/routing";
import { SITE_URL } from "@/site/url";
import "@khmio/ui/globals.css";

// Kantumruy Pro, downloaded at build time and served from this site: phones
// don't need it installed, and no outside font address is needed (CSP).
const kantumruy = Kantumruy_Pro({ subsets: ["khmer", "latin"], display: "swap", variable: "--font-kantumruy" });

export const metadata: Metadata = {
  title: "Khmio",
  // Link previews and the website's addresses use the public address (NEXT_PUBLIC_SITE_URL).
  metadataBase: new URL(SITE_URL),
  // Installed on an iPhone's home screen (Android reads app/manifest.ts).
  appleWebApp: { capable: true, title: "Khmio", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// viewport-fit=cover lets pages use the full screen on notched phones; fixed
// bottom bars then add the home-bar gap themselves (.pb-safe in globals.css).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The phone's status bar in Khmio Teal, as the installed app shows it.
  themeColor: "#0e7490",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) {
    notFound();
  }

  const messages = await getMessages();

  // suppressHydrationWarning: the theme script sets data-theme/data-accent on
  // <html> before React loads, so the server HTML intentionally differs there.
  return (
    <html lang={locale} className={kantumruy.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-khmer">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
