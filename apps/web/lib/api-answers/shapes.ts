import { z } from "zod";

/** Money per currency (cents, riel), never added together. */
export const perCurrency = z.object({ USD: z.number(), KHR: z.number() });

/** One page of a server-mode list (packages/shared ListPage), rows read with their own schema. */
export const listPageSchema = <Row extends z.ZodTypeAny>(row: Row) =>
  z.object({
    rows: z.array(row),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    chipCounts: z.record(z.number()),
    groupCounts: z.record(z.number()).optional(),
    filterCounts: z.record(z.record(z.number())).optional(),
  });
