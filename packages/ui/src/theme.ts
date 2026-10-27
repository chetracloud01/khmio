// Per-viewer theme preference: brightness mode + accent colour. Stored in
// localStorage and applied as <html data-theme / data-accent> attributes,
// which globals.css turns into colour tokens.

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const ACCENTS = ["teal", "indigo", "violet", "rose", "amber"] as const;
export type Accent = (typeof ACCENTS)[number];

export const THEME_STORAGE_KEY = "khmio:theme";
export const ACCENT_STORAGE_KEY = "khmio:accent";

/** Swatch colours for the picker (the light-theme shade of each accent). */
export const ACCENT_SWATCHES: Record<Accent, string> = {
  teal: "rgb(14 116 144)",
  indigo: "rgb(79 70 229)",
  violet: "rgb(124 58 237)",
  rose: "rgb(225 29 72)",
  amber: "rgb(180 83 9)",
};

export function applyTheme(mode: ThemeMode, accent: Accent): void {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  if (accent === "teal") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", accent);
}

/**
 * Inline script for the document <head>: applies the saved theme before the
 * first paint, so a dark-mode user never sees a white flash. Must stay
 * dependency-free and tiny — it runs before React loads.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var r=document.documentElement;var m=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var a=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});if(m==="light"||m==="dark")r.setAttribute("data-theme",m);if(a&&a!=="teal"&&${JSON.stringify(
  ACCENTS,
)}.indexOf(a)>-1)r.setAttribute("data-accent",a);}catch(e){}})();`;
