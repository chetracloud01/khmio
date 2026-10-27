import { describe, expect, it } from "vitest";
import { createFakeKhqrProvider } from "./fake-khqr";
import { khqrProviderFor } from "./index";

const store = { storeId: "store-1", bakongAccountId: "srey@aclb" };
const answering = (status: number, body: unknown): typeof fetch => async () => new Response(JSON.stringify(body), { status });

describe("the stand-in KHQR provider", () => {
  it("makes a code no bank app can pay, referenced by its MD5", async () => {
    const provider = createFakeKhqrProvider("http://bank.test");
    const created = await provider.createPayment({ orderId: "order-1", amountMinor: 10_800, currency: "KHR", expiresAt: new Date(), store });
    expect(created.qrPayload).toMatch(/^FAKE-KHQR\|srey@aclb\|KHR\|10800\|order-1\|/);
    expect(created.providerRef).toMatch(/^[0-9a-f]{32}$/);
  });

  it("reports what the bank says was paid, or nothing yet", async () => {
    const paid = createFakeKhqrProvider("http://bank.test", answering(200, { paid: true, currency: "KHR", amountMinor: 10_800 }));
    expect((await paid.checkPayment("abc", store)).reported).toEqual({ currency: "KHR", amountMinor: 10_800 });
    const notYet = createFakeKhqrProvider("http://bank.test", answering(200, { paid: false }));
    expect((await notYet.checkPayment("abc", store)).reported).toBeNull();
  });

  it("calls a bank that fails, answers nonsense or can't be reached unreachable — never paid", async () => {
    expect((await createFakeKhqrProvider("http://bank.test", answering(500, {})).checkPayment("abc", store)).reported).toBe("unreachable");
    expect((await createFakeKhqrProvider("http://bank.test", answering(200, { paid: "yes" })).checkPayment("abc", store)).reported).toBe("unreachable");
    const down: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    expect((await createFakeKhqrProvider("http://bank.test", down).checkPayment("abc", store)).reported).toBe("unreachable");
  });

  it("is chosen only when the settings ask for it", () => {
    expect(khqrProviderFor({ KHQR_PROVIDER: "off", fakeBankUrl: "http://bank.test" })).toBeNull();
    expect(khqrProviderFor({ KHQR_PROVIDER: "fake", fakeBankUrl: "http://bank.test" })?.code).toBe("bakong_khqr");
  });
});
