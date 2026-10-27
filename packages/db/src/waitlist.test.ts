import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppDb, createSystemDb, type AppDb, type SystemDb } from "./index";

// The website waitlist on the real database: platform data that only
// SystemDb touches. The API's everyday user can't read, add or remove
// sign-ups, and the table refuses values the form could never send.

const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_OWNER_URL;
// 0 then 9 digits can never be a real Cambodian mobile number, so tests can't collide with a person.
const TEST_PHONE = "855099999999";

describe.skipIf(!appUrl || !ownerUrl)("website waitlist", () => {
  let app: AppDb;
  let system: SystemDb;

  beforeAll(() => {
    app = createAppDb(appUrl!);
    system = createSystemDb(ownerUrl!);
  });

  afterAll(async () => {
    await system.waitlistSignup.deleteMany({ where: { phone: TEST_PHONE } });
    await Promise.all([app.$disconnect(), system.$disconnect()]);
  });

  it("keeps one sign-up per phone per product", async () => {
    await system.waitlistSignup.create({ data: { product: "class", name: "Test", phone: TEST_PHONE, businessType: "teacher" } });
    await expect(system.waitlistSignup.create({ data: { product: "class", name: "Again", phone: TEST_PHONE, businessType: "school" } })).rejects.toThrow();
    await system.waitlistSignup.create({ data: { product: "rent", name: "Test", phone: TEST_PHONE, businessType: "landlord" } });
  });

  it("refuses values the form can't send", async () => {
    await expect(system.waitlistSignup.create({ data: { product: "cinema", name: "Test", phone: TEST_PHONE, businessType: "other" } })).rejects.toThrow();
    await expect(system.waitlistSignup.create({ data: { product: "shop", name: "Test", phone: "012345678", businessType: "other" } })).rejects.toThrow();
    await expect(system.waitlistSignup.create({ data: { product: "shop", name: "Test", phone: TEST_PHONE, businessType: "farmer" } })).rejects.toThrow();
  });

  it("keeps the sign-ups away from the app user", async () => {
    await expect(app.waitlistSignup.findMany()).rejects.toThrow();
    await expect(app.waitlistSignup.create({ data: { product: "shop", name: "Test", phone: TEST_PHONE, businessType: "other" } })).rejects.toThrow();
    await expect(app.waitlistSignup.deleteMany()).rejects.toThrow();
  });
});
