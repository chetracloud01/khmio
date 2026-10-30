/** A name in the page's language, or the other one when it's empty. */
export const localText = (locale: string, km: string, en: string): string => (locale === "km" ? km || en : en || km);

/** A category's, product's or other entry's name in the page's language. */
export const localName = (locale: string, entry: { nameKm: string; nameEn: string }): string => localText(locale, entry.nameKm, entry.nameEn);

/** Looks up a category's name in the page's language ("" when it isn't there). */
export function categoryNameLookup(categories: readonly { id: string; nameKm: string; nameEn: string }[] | undefined, locale: string): (categoryId: string) => string {
  return (categoryId) => {
    const category = categories?.find((entry) => entry.id === categoryId);
    return category ? localName(locale, category) : "";
  };
}
