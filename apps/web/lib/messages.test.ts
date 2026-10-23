import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AUDIT_ACTIONS } from "@khmio/shared";
import { describe, expect, it } from "vitest";

// The words on screen (messages/*.json): every text in both languages, and a
// sentence for every action the audit log can hold.

type Messages = { [key: string]: string | Messages };
const read = (locale: string): Messages => JSON.parse(readFileSync(resolve(__dirname, `../messages/${locale}.json`), "utf8"));
const km = read("km");
const en = read("en");

function keys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => (typeof value === "string" ? [prefix + key] : keys(value, `${prefix}${key}.`)));
}

/** The subscription changes have sentences of their own, with the days or the plan in them (admin/audit-text.ts). */
const OWN_SENTENCE = new Set(["subscription.extended", "subscription.plan_changed"]);

describe("messages", () => {
  it("has every text in both Khmer and English", () => {
    const [inKhmer, inEnglish] = [new Set(keys(km)), new Set(keys(en))];
    expect([...inKhmer].filter((key) => !inEnglish.has(key))).toEqual([]);
    expect([...inEnglish].filter((key) => !inKhmer.has(key))).toEqual([]);
  });

  it("has a sentence for every action the audit log can hold", () => {
    const sentences = new Set(keys(en));
    const missing = AUDIT_ACTIONS.filter((action) => !OWN_SENTENCE.has(action) && !sentences.has(`AdminApp.audit_${action.replace(".", "_")}`));
    expect(missing).toEqual([]);
  });

  it("names all twelve months for the shared date hook", () => {
    const inKhmer = new Set(keys(km));
    expect(Array.from({ length: 12 }, (_, i) => `Dates.month_${i + 1}`).filter((key) => !inKhmer.has(key))).toEqual([]);
  });
});
