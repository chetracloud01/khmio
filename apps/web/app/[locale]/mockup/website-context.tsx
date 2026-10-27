"use client";

import { libraryPictureId, picturesUsedIn, sitePageSchema, type SitePage } from "@khmio/shared";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { mockComingSoonPages, mockHomePage, mockPictures, mockPricingPage, mockShopPage, type MockPicture } from "@/mock/mock-site";
import { SITE_PAGE_KEYS, type SitePageKey } from "./site-pages";

// The platform website's content, as the admin edits it (design/screens.md
// A10): every page has what visitors see (published), the admin's working
// copy (draft) and every earlier published version (history). The website
// mockups show `published`; the admin's Preview shows `draft`. The real
// thing keeps the same three in platform tables.

export { SITE_PAGE_INFO, SITE_PAGE_KEYS, type SitePageKey } from "./site-pages";

export interface SiteVersion {
  version: number;
  /** ISO time it was published. */
  at: string;
  by: string;
  page: SitePage;
}

export interface SitePageState {
  published: SitePage;
  draft: SitePage;
  /** Newest first; history[0] is what's published now. */
  history: SiteVersion[];
}

const SEED_PAGES: Record<SitePageKey, SitePage> = {
  home: mockHomePage,
  shop: mockShopPage,
  class: mockComingSoonPages.class,
  rent: mockComingSoonPages.rent,
  pricing: mockPricingPage,
};

const SEED_AT = "2026-10-06T09:00:00+07:00";

function seed(): Record<SitePageKey, SitePageState> {
  const pages = {} as Record<SitePageKey, SitePageState>;
  for (const key of SITE_PAGE_KEYS) {
    pages[key] = { published: SEED_PAGES[key], draft: SEED_PAGES[key], history: [{ version: 1, at: SEED_AT, by: "Admin (mock)", page: SEED_PAGES[key] }] };
  }
  return pages;
}

export type PublishResult = { ok: true } | { ok: false; issues: { path: string; code: string }[] };

/** Where a library picture is used: which page, and in which copy of it. */
export interface PictureUse {
  pageKey: SitePageKey;
  where: "live" | "draft" | "history";
}

interface WebsiteContextValue {
  hydrated: boolean;
  /** The picture library (A12). */
  pictures: MockPicture[];
  addPicture: (picture: Omit<MockPicture, "id" | "addedAt">) => string;
  updatePictureAlt: (id: string, alt: MockPicture["alt"]) => void;
  /** A new file for a picture: every page that uses it shows the new one. */
  replacePictureFile: (id: string, file: Pick<MockPicture, "file" | "width" | "height" | "bytes">) => void;
  /** Callers check pictureUses first: a picture in use is never deleted. */
  deletePicture: (id: string) => void;
  pictureUses: (id: string) => PictureUse[];
  /** A content src as the browser needs it: "library:<id>" becomes the library file. */
  resolveImage: (src: string) => string;
  pages: Record<SitePageKey, SitePageState>;
  hasChanges: (key: SitePageKey) => boolean;
  saveDraft: (key: SitePageKey, page: SitePage) => void;
  discardDraft: (key: SitePageKey) => void;
  /** Refuses a draft that breaks the site kit's rules (missing Khmer or English, a bad link…) and says where. */
  publish: (key: SitePageKey, by: string) => PublishResult;
  /** Makes an earlier version the draft; it goes live only when published. */
  restore: (key: SitePageKey, version: number) => void;
}

const WebsiteContext = createContext<WebsiteContextValue | null>(null);
const STORAGE_KEY = "khmio:mockup-website";
const PICTURES_KEY = "khmio:mockup-pictures";

export function WebsiteProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Record<SitePageKey, SitePageState>>(seed);
  const [hydrated, setHydrated] = useState(false);
  const [pictures, setPictures] = useState<MockPicture[]>(mockPictures);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PICTURES_KEY);
      if (raw) setPictures(JSON.parse(raw) as MockPicture[]);
    } catch {
      // Unreadable storage: start from the sample pictures.
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PICTURES_KEY, JSON.stringify(pictures));
    } catch {
      // Storage full (uploads are kept as data URLs in the mockup): they last until a reload.
    }
  }, [pictures, hydrated]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setPages({ ...seed(), ...(JSON.parse(raw) as Partial<Record<SitePageKey, SitePageState>>) });
    } catch {
      // Unreadable or blocked storage: start from the sample content.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
    } catch {
      // Storage full or blocked: changes last until the page is reloaded.
    }
  }, [pages, hydrated]);

  // The admin's Preview opens in another frame; pick up its saved draft there too.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        setPages({ ...seed(), ...(JSON.parse(event.newValue) as Partial<Record<SitePageKey, SitePageState>>) });
      } catch {
        // Ignore a half-written value.
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function pictureUses(id: string): PictureUse[] {
    return SITE_PAGE_KEYS.flatMap((pageKey) => {
      const state = pages[pageKey];
      const uses: PictureUse[] = [];
      // The most visible use per page is enough: live, else the draft, else an earlier version.
      if (picturesUsedIn(state.published).has(id)) uses.push({ pageKey, where: "live" });
      else if (picturesUsedIn(state.draft).has(id)) uses.push({ pageKey, where: "draft" });
      // A version that could be restored still needs its pictures.
      else if (state.history.slice(1).some((version) => picturesUsedIn(version.page).has(id))) uses.push({ pageKey, where: "history" });
      return uses;
    });
  }

  const value: WebsiteContextValue = {
    hydrated,
    pictures,
    addPicture: (picture) => {
      const taken = new Set(pictures.map((existing) => existing.id));
      let n = pictures.length + 1;
      while (taken.has(`picture-${n}`)) n += 1;
      const id = `picture-${n}`;
      setPictures((current) => [{ ...picture, id, addedAt: new Date().toISOString() }, ...current]);
      return id;
    },
    updatePictureAlt: (id, alt) => setPictures((current) => current.map((picture) => (picture.id === id ? { ...picture, alt } : picture))),
    replacePictureFile: (id, file) => setPictures((current) => current.map((picture) => (picture.id === id ? { ...picture, ...file } : picture))),
    deletePicture: (id) => setPictures((current) => current.filter((picture) => picture.id !== id)),
    pictureUses,
    resolveImage: (src) => {
      const id = libraryPictureId(src);
      if (!id) return src;
      return pictures.find((picture) => picture.id === id)?.file ?? "";
    },
    pages,
    hasChanges: (key) => JSON.stringify(pages[key].draft) !== JSON.stringify(pages[key].published),
    saveDraft: (key, page) => setPages((current) => ({ ...current, [key]: { ...current[key], draft: page } })),
    discardDraft: (key) => setPages((current) => ({ ...current, [key]: { ...current[key], draft: current[key].published } })),
    publish: (key, by) => {
      const result = sitePageSchema.safeParse(pages[key].draft);
      if (!result.success) return { ok: false, issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.message })) };
      setPages((current) => {
        const state = current[key];
        const version = (state.history[0]?.version ?? 0) + 1;
        return { ...current, [key]: { published: state.draft, draft: state.draft, history: [{ version, at: new Date().toISOString(), by, page: state.draft }, ...state.history] } };
      });
      return { ok: true };
    },
    restore: (key, version) =>
      setPages((current) => {
        const found = current[key].history.find((entry) => entry.version === version);
        return found ? { ...current, [key]: { ...current[key], draft: found.page } } : current;
      }),
  };

  return <WebsiteContext.Provider value={value}>{children}</WebsiteContext.Provider>;
}

export function useWebsite() {
  const value = useContext(WebsiteContext);
  if (!value) throw new Error("useWebsite must be used inside WebsiteProvider");
  return value;
}
