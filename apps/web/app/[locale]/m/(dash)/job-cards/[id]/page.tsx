"use client";

import { isJobCardOpen, jobCardInputSchema, nextJobCardSteps, toFieldErrors, type FormErrorCode, type JobCardStatus } from "@khmio/shared";
import { Button, Card, IconButton, Input, Notice, Select, Textarea } from "@khmio/ui";
import { Receipt, Trash2, Wrench } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { FormActions, useFormErrorText } from "@/components/form-ui";
import { JobCardStatusPill } from "@/components/job-cards/job-card-ui";
import { SubPage } from "@/components/seller-frame/sub-page";
import { api, ApiError, type JobCard, jobCardSchema, type Product, productSchema } from "@/lib/api";
import { PageLoading, PageOffline } from "../../page-states";

interface LineDraft {
  key: string;
  variantId: string;
  quantity: string;
  note: string;
}

// One job card (Features › jobCards): the car, what's wrong, the parts and
// labour (the shop's own products; labour is a service), its steps, and
// "Bill and hand over" — a counter sale with these lines, after which the
// card is closed.
export default function JobCardPage() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<JobCard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    Promise.all([api(`/job-cards/${id}`, jobCardSchema), api("/products", z.array(productSchema))]).then(
      ([found, catalog]) => {
        setCard(found);
        setProducts(catalog);
      },
      () => setFailed(true),
    );
  }, [id]);
  useEffect(load, [load]);
  if (failed) return <PageOffline onRetry={load} />;
  if (!card) return <PageLoading />;
  return <JobCardView key={card.updatedAt} card={card} products={products} onChanged={setCard} />;
}

function JobCardView({ card, products, onChanged }: { card: JobCard; products: Product[]; onChanged: (card: JobCard) => void }) {
  const t = useTranslations("JobCards");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const errorText = useFormErrorText();
  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);
  const open = isJobCardOpen(card.status);
  const initialLines = card.lines.map((line) => ({ key: line.id, variantId: line.variantId, quantity: String(line.quantity), note: line.note }));
  const [complaint, setComplaint] = useState(card.complaint);
  const [mileage, setMileage] = useState(card.mileageKm === null ? "" : String(card.mileageKm));
  const [lines, setLines] = useState<LineDraft[]>(initialLines);
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = complaint !== card.complaint || mileage !== (card.mileageKm === null ? "" : String(card.mileageKm)) || JSON.stringify(lines) !== JSON.stringify(initialLines);

  // Every option of every product, as "Brake pads – Front", parts and labour alike.
  const choices = products.flatMap((product) =>
    product.variants.map((variant) => ({
      value: variant.id,
      label: [text(product.titleKm, product.titleEn), product.hasOptions ? text(variant.labelKm, variant.labelEn) : ""].filter(Boolean).join(" – "),
    })),
  );

  async function send(path: string, body: object, method: "PUT" | "POST") {
    setBusy(true);
    setProblem(null);
    try {
      onChanged(await api(path, jobCardSchema, { method, body }));
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(failure.fields);
      else setProblem(failure instanceof ApiError && failure.code === "action_not_allowed" ? t("movedOn") : tApp("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const input = jobCardInputSchema.safeParse({
      vehicleId: card.vehicle.id,
      complaint,
      mileageKm: mileage.trim() === "" ? undefined : Number(mileage.trim()),
      lines: lines.map((line) => ({ variantId: line.variantId, quantity: Number(line.quantity), note: line.note })),
    });
    if (!input.success) {
      setErrors(toFieldErrors(input.error));
      return;
    }
    setErrors({});
    void send(`/job-cards/${card.id}`, input.data, "PUT");
  }

  const move = (status: JobCardStatus) => void send(`/job-cards/${card.id}/status`, { status }, "POST");

  return (
    <SubPage back={{ href: `/${locale}/m/job-cards`, label: t("title") }} title={`#${card.number} · ${card.vehicle.plate}`} description={[card.vehicle.makeModel, card.vehicle.ownerName].filter(Boolean).join(" · ")}>
      <div className="flex flex-wrap items-center gap-2">
        <JobCardStatusPill status={card.status} />
        {nextJobCardSteps(card.status).map((step) => (
          <Button key={step} variant={step === "cancelled" ? "ghost" : "secondary"} tone={step === "cancelled" ? "danger" : undefined} disabled={busy} onClick={() => move(step)}>
            {t(`moveTo_${step}`)}
          </Button>
        ))}
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <Textarea label={t("complaint")} maxLength={500} value={complaint} disabled={!open} onChange={(event) => setComplaint(event.target.value)} error={errorText(errors.complaint)} />
        <Input label={t("mileage")} inputMode="numeric" value={mileage} disabled={!open} onChange={(event) => setMileage(event.target.value)} error={errorText(errors.mileageKm)} />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Wrench className="h-4 w-4 text-muted" aria-hidden="true" />
          {t("work")}
        </h2>
        <p className="text-sm text-muted">{t("workHint")}</p>
        {lines.map((line, index) => (
          <div key={line.key} className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
            <Select
              label={t("partOrLabour")}
              value={line.variantId}
              disabled={!open}
              onChange={(event) => setLines((current) => current.map((entry) => (entry.key === line.key ? { ...entry, variantId: event.target.value } : entry)))}
              options={choices}
              error={errorText(errors[`lines.${index}`])}
            />
            <div className="flex items-start gap-2">
              <Input
                className="w-28"
                label={t("quantity")}
                inputMode="numeric"
                value={line.quantity}
                disabled={!open}
                onChange={(event) => setLines((current) => current.map((entry) => (entry.key === line.key ? { ...entry, quantity: event.target.value } : entry)))}
                error={errorText(errors[`lines.${index}.quantity`])}
              />
              <Input
                className="flex-1"
                label={t("lineNote")}
                value={line.note}
                disabled={!open}
                onChange={(event) => setLines((current) => current.map((entry) => (entry.key === line.key ? { ...entry, note: event.target.value } : entry)))}
              />
              {open && <IconButton icon={Trash2} tone="danger" label={t("removeLine")} onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))} className="mt-6" />}
            </div>
          </div>
        ))}
        {open && choices.length > 0 && (
          <Button variant="secondary" className="self-start" onClick={() => setLines((current) => [...current, { key: `new-${Date.now()}-${current.length}`, variantId: choices[0]?.value ?? "", quantity: "1", note: "" }])}>
            {t("addLine")}
          </Button>
        )}
      </Card>

      {problem && (
        <Notice tone="warning" role="alert">
          {problem}
        </Notice>
      )}
      {open && (
        <FormActions
          dirty={dirty && !busy}
          canCancel={!busy}
          onCancel={() => {
            setComplaint(card.complaint);
            setMileage(card.mileageKm === null ? "" : String(card.mileageKm));
            setLines(initialLines);
            setErrors({});
          }}
          onSave={save}
          saveLabel={busy ? tApp("saving") : t("save")}
          cancelLabel={t("cancel")}
        />
      )}
      {/* Billing takes the saved work: save changes first. */}
      {open && card.lines.length > 0 && !dirty && (
        <Link href={`/${locale}/m/sell?jobCard=${card.id}`} className="block">
          <Button variant="primary" fullWidth>
            <Receipt className="h-4 w-4" aria-hidden="true" />
            {t("bill")}
          </Button>
        </Link>
      )}
      {card.orderId && (
        <Link href={`/${locale}/m/orders/${card.orderId}`} className="block self-start">
          <Button variant="secondary">{t("viewSale")}</Button>
        </Link>
      )}
    </SubPage>
  );
}
