"use client";

import { SubPage } from "@/components/seller-frame/sub-page";
import { useMerchant } from "../merchant-context";
import { TelegramAlerts } from "../settings/telegram-alerts";

// Telegram alerts — the seller's own chat and staff groups — reached from the My shop menu.
export default function TelegramAlertsPage() {
  const { me } = useMerchant();
  return (
    <SubPage>
      {/* Release 1 accounts all sign in with Telegram, so alerts to the private chat are always on (phone login comes in Release 2). */}
      <TelegramAlerts signedInWithTelegram={me.merchant.signedInWithTelegram} />
    </SubPage>
  );
}
