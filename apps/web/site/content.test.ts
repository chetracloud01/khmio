import { existsSync } from "node:fs";
import { join } from "node:path";
import { libraryPictureId, picturesUsedIn, platformProductSchema, sitePageSchema, type SitePage } from "@khmio/shared";
import { describe, expect, it } from "vitest";
import { SITE_PAGES, SITE_PICTURES, SITE_PRODUCTS } from "./content";
import { SITE_PAGE_INFO, SITE_PAGE_KEYS, siteHasPath } from "./pages";

// The website's content must be exactly what the admin could publish, and
// every link and picture in it must lead somewhere — this file is what
// khmio.com shows.

/** Every link in a page's content. */
function linksIn(page: SitePage): string[] {
  const found: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.href === "string") found.push(record.href);
    Object.values(record).forEach(visit);
  };
  visit(page.sections);
  return found;
}

describe("website content", () => {
  it("passes the site kit's rules", () => {
    for (const key of SITE_PAGE_KEYS) expect(sitePageSchema.safeParse(SITE_PAGES[key]).error?.issues ?? [], key).toEqual([]);
    for (const product of SITE_PRODUCTS) expect(platformProductSchema.safeParse(product).error?.issues ?? []).toEqual([]);
  });

  it("has one entry per platform product, each with its own page", () => {
    expect(SITE_PRODUCTS.map((product) => product.id)).toEqual(["shop", "class", "rent"]);
    for (const product of SITE_PRODUCTS) expect(siteHasPath(`/products/${product.id}`), product.id).toBe(true);
  });

  it("gives each page the address it is served at", () => {
    for (const key of SITE_PAGE_KEYS) expect(`/${SITE_PAGES[key].slug}`).toBe(SITE_PAGE_INFO[key].path);
  });

  it("links only to pages that exist and to places on the same page", () => {
    for (const key of SITE_PAGE_KEYS) {
      const page = SITE_PAGES[key];
      for (const href of linksIn(page)) {
        if (href.startsWith("https://")) continue;
        if (href.startsWith("#")) expect(page.sections.some((section) => `#${section.id}` === href), `${key}: ${href}`).toBe(true);
        else expect(siteHasPath(href), `${key}: ${href}`).toBe(true);
      }
    }
  });

  it("uses only pictures that are in the library and on disk", () => {
    const library = new Map(SITE_PICTURES.map((picture) => [picture.id, picture]));
    for (const key of SITE_PAGE_KEYS) {
      for (const id of picturesUsedIn(SITE_PAGES[key])) {
        const picture = library.get(id);
        expect(picture, `${key}: library:${id}`).toBeDefined();
        expect(existsSync(join(__dirname, "..", "public", picture!.file)), picture!.file).toBe(true);
      }
    }
    expect(libraryPictureId("library:shop-khqr")).toBe("shop-khqr");
  });

  it("asks for waitlist sign-ups only on coming-soon product pages", () => {
    for (const key of SITE_PAGE_KEYS) {
      const product = SITE_PRODUCTS.find((entry) => entry.id === SITE_PAGE_INFO[key].product);
      const hasWaitlist = SITE_PAGES[key].sections.some((section) => section.type === "waitlist");
      expect(hasWaitlist, key).toBe(product?.status === "coming_soon");
    }
  });
});
