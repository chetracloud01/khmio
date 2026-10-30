/**
 * The address a status tile writes for its list (Purchases, Stock): the
 * grid's own parameters cleared (filters, tab, page, search), then the tile's
 * filter or chip set; none: the whole list. Other parameters stay.
 */
export function listAddress(current: string, view: { filter?: { key: string; value: string }; chip?: string } | null): string {
  const params = new URLSearchParams(current);
  for (const key of [...params.keys()]) if (key.startsWith("f.") || key === "tab" || key === "page" || key === "q") params.delete(key);
  if (view?.filter) params.set(`f.${view.filter.key}`, view.filter.value);
  if (view?.chip) params.set("tab", view.chip);
  return params.toString();
}
