import { routing } from "../i18n/routing";

export type Locale = (typeof routing.locales)[number];

const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

/**
 * The same page in another language: "/km/m/orders?tab=packing" → "/en/m/orders?tab=packing".
 * Only a whole first segment counts as the language, so "/enroll" is left alone.
 */
export function pathInLocale(path: string, next: Locale): string {
  return LOCALE_PREFIX.test(path) ? path.replace(LOCALE_PREFIX, `/${next}`) : `/${next}${path === "/" ? "" : path}`;
}
