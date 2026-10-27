import { z } from "zod";

// Platform-wide settings the super admin edits. The same schema validates the
// admin form now and the API request later.
const settingsFields = {
  platformName: z.string().trim().min(2, "too_short").max(60, "too_long"),
  /** Telegram usernames: 5–32 letters, digits or underscores, optional leading @. */
  supportTelegram: z.string().trim().regex(/^@?[A-Za-z0-9_]{5,32}$/, "telegram_invalid"),
  /** The band a merchant's USD→KHR rate is clamped to (docs/blueprint.md "Multi-currency pricing"). */
  usdToKhrMin: z.number({ invalid_type_error: "rate_invalid" }).int("rate_invalid").min(3000, "rate_out_of_band").max(6000, "rate_out_of_band"),
  usdToKhrMax: z.number({ invalid_type_error: "rate_invalid" }).int("rate_invalid").min(3000, "rate_out_of_band").max(6000, "rate_out_of_band"),
  /** Telegram chat that receives platform alerts. Empty = alerts off. */
  alertChatId: z.union([z.literal(""), z.string().trim().regex(/^-?\d{5,20}$/, "telegram_invalid")]),
};

const bandInOrder = { message: "rate_out_of_band", path: ["usdToKhrMax"] };

export const adminSettingsSchema = z.object(settingsFields).refine((settings) => settings.usdToKhrMin < settings.usdToKhrMax, bandInOrder);

export type AdminSettings = z.infer<typeof adminSettingsSchema>;

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  platformName: "Khmio",
  supportTelegram: "@khmio_support",
  usdToKhrMin: 3900,
  usdToKhrMax: 4300,
  alertChatId: "",
};

/**
 * What the admin Settings page saves (PUT /admin/settings): the settings
 * above, plus Release 1's switch that gives every shop Basic's features.
 */
export const platformSettingsSaveSchema = z
  .object({ ...settingsFields, betaAllBasic: z.boolean() })
  .refine((settings) => settings.usdToKhrMin < settings.usdToKhrMax, bandInOrder);
export type PlatformSettingsSave = z.infer<typeof platformSettingsSaveSchema>;

/** Adding days to a shop's trial or period (1 to 365). A paused shop reopens for exactly those days. */
export const adminExtendSchema = z.object({
  days: z.number({ invalid_type_error: "quantity_invalid" }).int("quantity_invalid").min(1, "quantity_invalid").max(365, "quantity_invalid"),
  /** Why, for the audit log ("beta merchant", "paid by bank transfer"). */
  note: z.string().trim().min(3, "required").max(200, "too_long"),
});

/** Changing a shop's plan by hand: paid plans only (packages/shared plans.ts applyAdminOverride). */
export const adminPlanChangeSchema = z.object({
  plan: z.enum(["basic", "pro", "advance"]),
  note: z.string().trim().min(3, "required").max(200, "too_long"),
});

/** The second step of the admin login: 6 digits from the app, or one backup code (XXXX-XXXX). */
export const adminCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, "").toUpperCase())
    .refine((value) => /^\d{6}$/.test(value) || /^[A-Z2-9]{4}-?[A-Z2-9]{4}$/.test(value), "otp_invalid"),
});
