import { z } from "zod";
import { fulfilmentSchema, type Fulfilment } from "./delivery";
import { isPhnomPenhDistrict, isProvince } from "./locations";
import { khmerPhoneSchema } from "./phone";
import { deliveryAreaSchema } from "./store";

// What the buyer fills in at checkout (docs/blueprint.md "Buyer checkout",
// design/screens.md B4).

/** What a buyer can pay with on the shop page. */
export const paymentMethodSchema = z.enum(["khqr", "aba_payway", "cod"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/** Paid at the counter (design/screens.md P2): cash, or the seller's own QR. */
export const counterPaymentMethodSchema = z.enum(["cash", "shop_qr"]);
export type CounterPaymentMethod = z.infer<typeof counterPaymentMethodSchema>;

/** Any order's payment, online or at the counter — what a saved order is read with. */
export const orderPaymentMethodSchema = z.enum([...paymentMethodSchema.options, ...counterPaymentMethodSchema.options]);
export type OrderPaymentMethod = z.infer<typeof orderPaymentMethodSchema>;

type DeliveryArea = z.infer<typeof deliveryAreaSchema>;

export const checkoutInputSchema = z
  .object({
    name: z.string().trim().min(2, "too_short").max(60, "too_long"),
    phone: khmerPhoneSchema,
    currency: z.enum(["USD", "KHR"]),
    /** Delivery to the buyer, or the buyer collects from the shop. */
    fulfilment: fulfilmentSchema,
    area: deliveryAreaSchema,
    /** Delivery in Phnom Penh: which district (sets the fee). */
    districtId: z.string().optional(),
    /** Delivery outside Phnom Penh: which province. */
    provinceId: z.string().optional(),
    landmark: z.string().trim().max(200, "too_long"),
    paymentMethod: paymentMethodSchema,
    /** A cart of only services: the time the buyer would like (checked with the cart by services.ts bookingProblem). */
    preferredAt: z.string().max(40).optional(),
    /** Whether this store accepts cash on delivery at all (a store setting, not typed by the buyer). */
    storeAllowsCod: z.boolean(),
  })
  .superRefine((input, ctx) => {
    if (input.fulfilment === "delivery") {
      if (input.area === "phnom_penh" && !(input.districtId && isPhnomPenhDistrict(input.districtId))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "district_required", path: ["districtId"] });
      }
      if (input.area === "province" && !(input.provinceId && isProvince(input.provinceId))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "province_required", path: ["provinceId"] });
      }
    }
    if (input.paymentMethod === "cod" && !isCodAvailable(input.storeAllowsCod, input.area, input.fulfilment)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "cod_unavailable", path: ["paymentMethod"] });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

/**
 * The payment methods a buyer can pick. A shop can be open before it's set up
 * to take money online: KHQR needs the merchant's Bakong account, ABA PayWay
 * needs their PayWay keys. An empty list means the shop can't take orders yet.
 */
export function getAvailablePaymentMethods(input: {
  khqrReady: boolean;
  payWayReady: boolean;
  storeAllowsCod: boolean;
  area: DeliveryArea;
  fulfilment?: Fulfilment;
}): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (input.khqrReady) methods.push("khqr");
  if (input.payWayReady) methods.push("aba_payway");
  if (isCodAvailable(input.storeAllowsCod, input.area, input.fulfilment)) methods.push("cod");
  return methods;
}

/**
 * Cash only where someone from the shop takes it: at pickup, or from the
 * shop's driver in Phnom Penh. Province orders travel by bus, so they're prepaid.
 */
export function isCodAvailable(storeAllowsCod: boolean, area: DeliveryArea, fulfilment: Fulfilment = "delivery"): boolean {
  return storeAllowsCod && (fulfilment === "pickup" || area === "phnom_penh");
}
