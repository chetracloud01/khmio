import { z } from "zod";

// Tables and kitchen (Features › "tables", business-modules.ts): a
// restaurant lists its tables; a sale at the counter can be for one; the
// Kitchen screen shows what's still to make.

/** Enough for a big café; more is almost always a typo. */
export const MAX_DINE_TABLES = 100;

export const dineTablesSaveSchema = z.object({
  tables: z
    .array(z.object({ id: z.string().min(1), name: z.string().trim().min(1, "required").max(30, "too_long") }))
    .max(MAX_DINE_TABLES, "too_long")
    .superRefine((tables, ctx) => {
      // Two tables with one name would be mixed up in the kitchen.
      const seen = new Set<string>();
      tables.forEach((table, index) => {
        const name = table.name.toLowerCase();
        if (seen.has(name)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "name_duplicate", path: [index, "name"] });
        seen.add(name);
      });
    }),
});
export type DineTablesSave = z.infer<typeof dineTablesSaveSchema>;

/** How often the Kitchen screen asks for new orders. */
export const KITCHEN_REFRESH_SECONDS = 15;
