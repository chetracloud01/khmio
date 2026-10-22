"use client";

import { SELLER_FORM } from "@/components/seller-frame/seller-frame";
import { BackToMyShop } from "@/components/seller-frame/back-to-my-shop";
import { useMerchant } from "../merchant-context";
import { TelegramAlerts } from "../settings/telegram-alerts";

// Telegram alerts — the seller's own chat and staff groups — reached from the My shop menu.
export default function TelegramAlertsPage() {
  const { me } = useMerchant();
  return (
    <div className={`${SELLER_FORM} gap-4`}>
      <BackToMyShop />
      {/* Release 1 accounts all sign in with Telegram, so alerts to the private chat are always on (phone login comes in Release 2). */}
      <TelegramAlerts signedInWithTelegram={me.merchant.signedInWithTelegram} />
    </div>
  );
}
