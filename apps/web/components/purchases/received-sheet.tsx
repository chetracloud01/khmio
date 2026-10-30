"use client";

import { BottomSheet, Button, ChoiceCards } from "@khmio/ui";
import { Check, Clock3, PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * The last step of saving a bill (design/screens.md S13 "New bill"): have the
 * goods arrived? Yes — stock goes up now; not yet — the bill is saved and
 * stock goes up later, with "Received" on the bill.
 */
export function ReceivedSheet({ busy, onConfirm, onClose }: { busy: boolean; onConfirm: (received: boolean) => void; onClose: () => void }) {
  const t = useTranslations("Purchases");
  const [received, setReceived] = useState<"yes" | "no">("yes");

  return (
    <BottomSheet
      open
      onClose={onClose}
      closeLabel={t("cancel")}
      title={t("receivedQuestion")}
      placement="center"
      footer={
        <Button variant="primary" fullWidth loading={busy} onClick={() => onConfirm(received === "yes")}>
          <Check className="h-4 w-4" aria-hidden="true" />
          {t("saveBill")}
        </Button>
      }
    >
      <ChoiceCards
        variant="rows"
        label={t("receivedQuestion")}
        value={received}
        onChange={(next) => setReceived(next === "no" ? "no" : "yes")}
        options={[
          { value: "yes", title: t("receivedYes"), detail: t("receivedYesHint"), icon: PackageCheck },
          { value: "no", title: t("receivedNo"), detail: t("receivedNoHint"), icon: Clock3 },
        ]}
      />
    </BottomSheet>
  );
}
