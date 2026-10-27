"use client";

import { formatKhmerPhoneLocal, formatTrackingCode, normalizeKhmerPhone, parseTrackingCode } from "@khmio/shared";
import { Button } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrackForm, type TrackOutcome } from "@/components/invoice/track-form";
import { mockStore, mockTrackingCode } from "@/mock/mock-data";
import { useOrders } from "../orders-context";

// Track my order (design/screens.md B8), searching the sample orders where
// the real page asks the API.
export default function MockTrackPage() {
  const t = useTranslations("Track");
  const tOrders = useTranslations("Orders");
  const locale = useLocale();
  const router = useRouter();
  const { hydrated, orders } = useOrders();
  const [fill, setFill] = useState<{ code: string; phone: string; key: number } | undefined>(undefined);

  async function find(code: string, phone: string): Promise<TrackOutcome> {
    const wanted = parseTrackingCode(code);
    const match = orders.find((order) => mockTrackingCode(order.orderNumber) === wanted && normalizeKhmerPhone(order.phone) === phone);
    if (!match) return "not_found";
    router.push(`/${locale}/mockup/order/${encodeURIComponent(match.orderNumber)}`);
    return "found";
  }

  const samples = hydrated ? orders.slice(0, 2) : [];
  return (
    <TrackForm back={{ href: `/${locale}/mockup/storefront`, label: tOrders("backToShop") }} find={find} fill={fill}>
      {samples.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-dashed border-border p-4 text-sm">
          <p className="text-muted">{t("sampleHint")}</p>
          {samples.map((order) => (
            <Button
              key={order.orderNumber}
              variant="secondary"
              className="w-full"
              onClick={() =>
                setFill({ code: formatTrackingCode(mockStore.slug, mockTrackingCode(order.orderNumber)), phone: formatKhmerPhoneLocal(order.phone), key: Date.now() })
              }
            >
              {t("sampleFill", { number: order.orderNumber })}
            </Button>
          ))}
        </section>
      )}
    </TrackForm>
  );
}
