"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useBackToShop } from "@/components/buyer/use-back-to-shop";
import { TrackForm, type TrackOutcome } from "@/components/invoice/track-form";
import { api, ApiError, trackedOrderSchema } from "@/lib/api";

// Track my order (design/screens.md B8): for buyers without Telegram. The API
// answers with the order link only when the code and the phone both match.
// Back goes to the shop the buyer came from.
export default function TrackPage() {
  const locale = useLocale();
  const router = useRouter();
  const back = useBackToShop();

  async function find(code: string, phone: string): Promise<TrackOutcome> {
    try {
      const { token } = await api("/public/track", trackedOrderSchema, { method: "POST", body: { code, phone } });
      router.push(`/${locale}/o/${encodeURIComponent(token)}`);
      return "found";
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) return "not_found";
      if (failure instanceof ApiError && failure.status === 429) return "too_many";
      return "offline";
    }
  }

  return <TrackForm back={back} find={find} />;
}
