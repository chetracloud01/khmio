"use client";

import { jobCardInputSchema, toFieldErrors, vehicleInputSchema, type FormErrorCode } from "@khmio/shared";
import { BottomSheet, Button, EmptyState, Input, Notice, PageHeader, SearchInput, Textarea } from "@khmio/ui";
import { CarFront, ChevronRight, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { JobCardStatusPill } from "@/components/job-cards/job-card-ui";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { api, ApiError, type JobCard, jobCardSchema, jobCardsSchema, type Vehicle, vehicleSchema, vehiclesSchema } from "@/lib/api";
import { PageLoading, PageOffline } from "../page-states";

// Job cards (Features › jobCards): the cars at the garage now, then the
// latest handed over. "New job card" books a car in — one already known, or
// a new one by its plate.
export default function JobCardsPage() {
  const t = useTranslations("JobCards");
  const locale = useLocale();
  const [cards, setCards] = useState<JobCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    api("/job-cards", jobCardsSchema).then((answer) => setCards(answer.jobCards), () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <PageOffline onRetry={load} />;
  if (!cards) return <PageLoading />;
  return (
    <div className={`${SELLER_PAGE} gap-4`}>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("new")}
          </Button>
        }
      />
      {cards.length === 0 ? (
        <EmptyState icon={CarFront} title={t("empty")} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-bg">
          {cards.map((card) => (
            <li key={card.id}>
              <Link href={`/${locale}/m/job-cards/${card.id}`} className="flex min-h-[64px] items-center gap-3 px-4 py-2 hover:bg-border/10">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    #{card.number} · {card.vehicle.plate}
                  </span>
                  <span className="block truncate text-sm text-muted">{[card.vehicle.makeModel, card.complaint].filter(Boolean).join(" · ")}</span>
                </span>
                <JobCardStatusPill status={card.status} />
                <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && <NewJobCard onClose={() => setCreating(false)} />}
    </div>
  );
}

/** Books a car in: find it by plate (or add it), say what's wrong, then the card opens. */
function NewJobCard({ onClose }: { onClose: () => void }) {
  const t = useTranslations("JobCards");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useFormErrorText();
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<Vehicle[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [adding, setAdding] = useState({ plate: "", makeModel: "", ownerName: "", ownerPhone: "" });
  const [complaint, setComplaint] = useState("");
  const [mileage, setMileage] = useState("");
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api(`/vehicles?search=${encodeURIComponent(search)}`, vehiclesSchema).then((answer) => setFound(answer.vehicles), () => setFound([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function create() {
    setProblem(null);
    setBusy(true);
    try {
      // A new car is saved first, then the card for it.
      let car = vehicle;
      if (!car) {
        const parsed = vehicleInputSchema.safeParse(adding);
        if (!parsed.success) {
          setErrors(toFieldErrors(parsed.error));
          return;
        }
        car = await api("/vehicles", vehicleSchema, { method: "POST", body: parsed.data });
      }
      const mileageKm = mileage.trim() === "" ? undefined : Number(mileage.trim());
      const input = jobCardInputSchema.safeParse({ vehicleId: car.id, complaint, mileageKm, lines: [] });
      if (!input.success) {
        setErrors(toFieldErrors(input.error));
        return;
      }
      const card = await api("/job-cards", jobCardSchema, { method: "POST", body: input.data });
      router.push(`/${locale}/m/job-cards/${card.id}`);
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(failure.fields);
      else setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      closeLabel={t("cancel")}
      title={t("new")}
      footer={
        <Button variant="primary" fullWidth loading={busy} onClick={() => void create()}>
          {t("bookIn")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {vehicle ? (
          <div className="flex items-center justify-between gap-2 rounded-DEFAULT border border-brand p-3">
            <span>
              <span className="block font-semibold">{vehicle.plate}</span>
              <span className="block text-sm text-muted">{[vehicle.makeModel, vehicle.ownerName].filter(Boolean).join(" · ")}</span>
            </span>
            <Button variant="ghost" onClick={() => setVehicle(null)}>
              {t("change")}
            </Button>
          </div>
        ) : (
          <>
            <SearchInput label={t("findCar")} placeholder={t("findCar")} value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} clearLabel={t("clear")} />
            {found.length > 0 && (
              <ul className="flex flex-col gap-1">
                {found.map((entry) => (
                  <li key={entry.id}>
                    <Button variant="secondary" fullWidth className="justify-between" onClick={() => setVehicle(entry)}>
                      <span className="font-semibold">{entry.plate}</span>
                      <span className="truncate text-sm text-muted">{entry.makeModel}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm font-medium">{t("orNewCar")}</p>
            <Input label={t("plate")} value={adding.plate} onChange={(event) => setAdding({ ...adding, plate: event.target.value })} error={errorText(errors.plate)} />
            <Input label={t("makeModel")} placeholder={t("makeModelPlaceholder")} value={adding.makeModel} onChange={(event) => setAdding({ ...adding, makeModel: event.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input label={t("ownerName")} value={adding.ownerName} onChange={(event) => setAdding({ ...adding, ownerName: event.target.value })} />
              <Input label={t("ownerPhone")} inputMode="tel" value={adding.ownerPhone} onChange={(event) => setAdding({ ...adding, ownerPhone: event.target.value })} error={errorText(errors.ownerPhone)} />
            </div>
          </>
        )}
        <Textarea label={t("complaint")} placeholder={t("complaintPlaceholder")} maxLength={500} value={complaint} onChange={(event) => setComplaint(event.target.value)} error={errorText(errors.complaint)} />
        <Input label={t("mileage")} inputMode="numeric" value={mileage} onChange={(event) => setMileage(event.target.value)} error={errorText(errors.mileageKm)} />
        {problem && (
          <Notice tone="danger" role="alert">
            {problem}
          </Notice>
        )}
      </div>
    </BottomSheet>
  );
}
