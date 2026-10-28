import { existsSync } from "node:fs";
import { join } from "node:path";
import { libraryPictureId, picturesUsedIn, siteAppSchema, SITE_SOLUTION_IDS, sitePageSchema, siteSolutionSchema, solutionPath, type SitePage } from "@khmio/shared";
import { describe, expect, it } from "vitest";
import { SITE_PAGES, SITE_PICTURES, SITE_SOLUTIONS } from "./content";
import { SITE_APPS } from "./content-apps";
import { SITE_PAGE_KEYS, siteHasPath, sitePageInfo } from "./pages";

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
    for (const solution of SITE_SOLUTIONS) expect(siteSolutionSchema.safeParse(solution).error?.issues ?? []).toEqual([]);
  });

  it("lists each app once, with enough ready ones to ring the hero's Mio", () => {
    for (const app of SITE_APPS) expect(siteAppSchema.safeParse(app).error?.issues ?? [], app.id).toEqual([]);
    expect(new Set(SITE_APPS.map((app) => app.id)).size).toBe(SITE_APPS.length);
    expect(SITE_APPS.filter((app) => app.status === "live").length).toBeGreaterThanOrEqual(8);
  });

  it("lists every business solution once, garage first and live, each with its own page", () => {
    expect(SITE_SOLUTIONS.map((solution) => solution.id)).toEqual([...SITE_SOLUTION_IDS]);
    expect(SITE_SOLUTIONS[0]).toMatchObject({ id: "garage", status: "live" });
    for (const solution of SITE_SOLUTIONS) expect(siteHasPath(solutionPath(solution.id)), solution.id).toBe(true);
  });

  it("gives each page the address it is served at", () => {
    for (const key of SITE_PAGE_KEYS) expect(`/${SITE_PAGES[key].slug}`).toBe(sitePageInfo(key).path);
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

  it("asks for waitlist sign-ups only on coming-soon solution pages, for that solution", () => {
    for (const key of SITE_PAGE_KEYS) {
      const solution = SITE_SOLUTIONS.find((entry) => entry.id === sitePageInfo(key).solution);
      const waitlists = SITE_PAGES[key].sections.filter((section) => section.type === "waitlist");
      expect(waitlists.length, key).toBe(solution?.status === "coming_soon" ? 1 : 0);
      for (const waitlist of waitlists) expect(waitlist.type === "waitlist" && waitlist.solution, key).toBe(solution?.id);
    }
  });
});
