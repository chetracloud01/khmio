import { libraryPictureId } from "@khmio/shared";
import { SITE_PICTURES } from "./content";

// How the live website turns content links and pictures into addresses. A
// plain module, so server code (link previews) and the page can both use it.

/** "/start" is the Telegram login (then shop set-up); every other site path is a page of this site. */
export function liveSiteHref(locale: string, path: string): string {
  if (path === "/start") return `/${locale}/m/login`;
  if (path === "/") return `/${locale}`;
  return `/${locale}${path}`;
}

/** A library picture's file under public/; any other src as it is. */
export function liveSiteImage(src: string): string {
  const id = libraryPictureId(src);
  if (!id) return src;
  return SITE_PICTURES.find((picture) => picture.id === id)?.file ?? "";
}
