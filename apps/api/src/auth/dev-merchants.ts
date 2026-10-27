/**
 * The made-up merchants the development login can sign in as. "garage" owns
 * the demo garage shop made by `pnpm demo:garage`.
 */
export const DEV_MERCHANTS = {
  a: { telegramId: "1000000001", username: "dev_merchant_a", firstName: "Dev A" },
  b: { telegramId: "1000000002", username: "dev_merchant_b", firstName: "Dev B" },
  garage: { telegramId: "1000000003", username: "demo_garage", firstName: "Demo Garage" },
} as const;

export type DevMerchant = keyof typeof DEV_MERCHANTS;
