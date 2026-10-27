import { describe, expect, it } from "vitest";
import { telegramLoginFromQuery, withoutTelegramLogin } from "./telegram-login";

const hash = "a".repeat(64);

describe("Telegram login from the address", () => {
  it("reads the signed fields Telegram adds", () => {
    const params = new URLSearchParams(`id=569123&first_name=Chetra&username=chetra&auth_date=1790000000&hash=${hash}`);
    expect(telegramLoginFromQuery(params)).toEqual({ id: 569123, first_name: "Chetra", username: "chetra", auth_date: 1790000000, hash });
  });

  it("is null when there's no login, or it's malformed", () => {
    expect(telegramLoginFromQuery(new URLSearchParams("product=abc"))).toBeNull();
    expect(telegramLoginFromQuery(new URLSearchParams(`id=x&first_name=A&auth_date=1&hash=${hash}`))).toBeNull();
    expect(telegramLoginFromQuery(new URLSearchParams("id=1&first_name=A&auth_date=1&hash=short"))).toBeNull();
  });

  it("takes the login fields out of the address and keeps the rest", () => {
    expect(withoutTelegramLogin(new URL(`https://shop.example/km/m/login?next=%2Fkm%2Fm&id=1&first_name=A&auth_date=1&hash=${hash}`))).toBe("/km/m/login?next=%2Fkm%2Fm");
  });
});
