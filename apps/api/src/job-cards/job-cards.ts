import { Prisma, type Tx } from "@khmio/db";
import { canMoveJobCard, isJobCardOpen, type FormErrorCode, type JobCardInput, type JobCardStatus, type VehicleInput } from "@khmio/shared";
import { NotFoundException } from "@nestjs/common";
import { AppException, InvalidInputException } from "../errors";

// Vehicles and job cards (Features › jobCards; packages/shared
// job-cards.ts), inside the seller's withContext: row-level security keeps
// each garage to its own cars and cards.

const vehicleSelect = { id: true, plate: true, makeModel: true, ownerName: true, ownerPhone: true } satisfies Prisma.VehicleSelect;

/** The garage's cars, newest first; `search` finds a plate, a model or an owner. */
export async function readVehicles(tx: Tx, search = "") {
  const text = search.trim();
  return tx.vehicle.findMany({
    where: text
      ? { OR: [{ plate: { contains: text, mode: "insensitive" } }, { makeModel: { contains: text, mode: "insensitive" } }, { ownerName: { contains: text, mode: "insensitive" } }] }
      : {},
    select: vehicleSelect,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** A new car. The same plate twice (whatever its spacing) is refused under `plate`. */
export async function addVehicle(tx: Tx, storeId: string, input: VehicleInput) {
  try {
    return await tx.vehicle.create({ data: { storeId, ...input }, select: vehicleSelect });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new InvalidInputException({ plate: "name_duplicate" });
    throw error;
  }
}

const jobCardSelect = {
  id: true,
  number: true,
  status: true,
  complaint: true,
  mileageKm: true,
  orderId: true,
  createdAt: true,
  updatedAt: true,
  vehicle: { select: vehicleSelect },
  lines: {
    select: { id: true, variantId: true, quantity: true, note: true, variant: { select: { labelKm: true, labelEn: true, isDefault: true, product: { select: { titleKm: true, titleEn: true, kind: true } } } } },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.JobCardSelect;
type JobCardRow = Prisma.JobCardGetPayload<{ select: typeof jobCardSelect }>;

/** A card as the garage's pages show it: each line named by its product (labour is a service). */
export function toJobCard({ createdAt, updatedAt, lines, ...card }: JobCardRow) {
  return {
    ...card,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    lines: lines.map(({ variant, ...line }) => ({
      ...line,
      titleKm: variant.product.titleKm,
      titleEn: variant.product.titleEn,
      optionKm: variant.isDefault ? "" : variant.labelKm,
      optionEn: variant.isDefault ? "" : variant.labelEn,
      labour: variant.product.kind === "service",
    })),
  };
}

/** Cards still at the garage, then the latest closed ones. */
export async function readJobCards(tx: Tx) {
  const [open, closed] = await Promise.all([
    tx.jobCard.findMany({ where: { status: { in: ["open", "in_progress", "ready"] } }, select: jobCardSelect, orderBy: { number: "asc" } }),
    tx.jobCard.findMany({ where: { status: { in: ["handed_over", "cancelled"] } }, select: jobCardSelect, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);
  return [...open, ...closed].map(toJobCard);
}

export async function readJobCard(tx: Tx, id: string) {
  const card = await tx.jobCard.findFirst({ where: { id }, select: jobCardSelect });
  if (!card) throw new NotFoundException();
  return toJobCard(card);
}

/** The car and every line's product must be this garage's own (row-level security hides any other's). */
async function checkCard(tx: Tx, input: JobCardInput): Promise<void> {
  const errors: Record<string, FormErrorCode> = {};
  if (!(await tx.vehicle.findFirst({ where: { id: input.vehicleId }, select: { id: true } }))) errors.vehicleId = "required";
  const found = new Set(
    (await tx.productVariant.findMany({ where: { id: { in: input.lines.map((line) => line.variantId) }, deletedAt: null, product: { deletedAt: null } }, select: { id: true } })).map((variant) => variant.id),
  );
  input.lines.forEach((line, index) => {
    if (!found.has(line.variantId)) errors[`lines.${index}`] = "product_unavailable";
  });
  if (Object.keys(errors).length > 0) throw new InvalidInputException(errors);
}

const lineRows = (storeId: string, jobCardId: string, input: JobCardInput) =>
  input.lines.map((line, sortOrder) => ({ storeId, jobCardId, variantId: line.variantId, quantity: line.quantity, note: line.note, sortOrder }));

/** Books a car in: the next card number in this garage, with its work so far. */
export async function createJobCard(tx: Tx, storeId: string, input: JobCardInput) {
  await checkCard(tx, input);
  const last = await tx.jobCard.findFirst({ select: { number: true }, orderBy: { number: "desc" } });
  const card = await tx.jobCard.create({
    data: { storeId, vehicleId: input.vehicleId, number: (last?.number ?? 0) + 1, complaint: input.complaint, mileageKm: input.mileageKm ?? null },
    select: { id: true },
  });
  await tx.jobCardLine.createMany({ data: lineRows(storeId, card.id, input) });
  return readJobCard(tx, card.id);
}

/** Changes a card still at the garage: its car, complaint, mileage and work (the lines are replaced as sent). */
export async function updateJobCard(tx: Tx, storeId: string, id: string, input: JobCardInput) {
  const card = await tx.jobCard.findFirst({ where: { id }, select: { status: true } });
  if (!card) throw new NotFoundException();
  if (!isJobCardOpen(card.status)) throw new AppException(409, "action_not_allowed");
  await checkCard(tx, input);
  await tx.jobCard.update({ where: { id }, data: { vehicleId: input.vehicleId, complaint: input.complaint, mileageKm: input.mileageKm ?? null } });
  await tx.jobCardLine.deleteMany({ where: { jobCardId: id } });
  await tx.jobCardLine.createMany({ data: lineRows(storeId, id, input) });
  return readJobCard(tx, id);
}

/** Open → in progress → ready (or back a step, or cancelled), only from the status the seller saw. */
export async function moveJobCard(tx: Tx, id: string, to: JobCardStatus) {
  const card = await tx.jobCard.findFirst({ where: { id }, select: { status: true } });
  if (!card) throw new NotFoundException();
  if (!canMoveJobCard(card.status, to)) throw new AppException(409, "action_not_allowed");
  const { count } = await tx.jobCard.updateMany({ where: { id, status: card.status }, data: { status: to } });
  if (count === 0) throw new AppException(409, "action_not_allowed");
  return readJobCard(tx, id);
}

/** "Bill and hand over": the counter sale bills this card, which is then handed over. Refused when it's no longer at the garage. */
export async function billJobCard(tx: Tx, jobCardId: string, orderId: string): Promise<void> {
  const { count } = await tx.jobCard.updateMany({ where: { id: jobCardId, status: { in: ["open", "in_progress", "ready"] } }, data: { status: "handed_over", orderId } });
  if (count === 0) throw new InvalidInputException({ jobCardId: "required" });
}
