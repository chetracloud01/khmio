import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Every colour pair the app uses for text, checked in every theme and accent
// (design/design-standard.md §3, WCAG 2.1): 4.5:1 for text, 3:1 for shapes
// such as the current-page bar. The values are read from the real
// packages/ui/src/globals.css and resolved the way a browser cascades them,
// so changing a colour there can't quietly make text hard to read.

const css = readFileSync(resolve(__dirname, "../../../packages/ui/src/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

interface Rule {
  selector: string;
  vars: Record<string, string>;
  deviceDark: boolean;
  order: number;
}

function parseRules(): Rule[] {
  const rules: Rule[] = [];
  let order = 0;
  const media = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/g;
  let rest = css;
  const darkBlocks: string[] = [];
  for (let match = media.exec(css); match; match = media.exec(css)) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (depth > 0) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0, i++;
    const inner = css.slice(match.index + match[0].length, i - 1);
    darkBlocks.push(inner);
    rest = rest.replace(css.slice(match.index, i), `\u0000${darkBlocks.length - 1}\u0000`);
  }
  const collect = (text: string, deviceDark: boolean) => {
    for (const block of text.split(/(\u0000\d+\u0000)/)) {
      const mediaIndex = /^\u0000(\d+)\u0000$/.exec(block);
      if (mediaIndex) {
        collect(darkBlocks[Number(mediaIndex[1])]!, true);
        continue;
      }
      for (const [, selector, body] of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const vars = Object.fromEntries([...body!.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name!, value!.trim()]));
        // The selector is what follows the last statement before it (e.g. after "@tailwind utilities;").
        const clean = selector!.split(";").pop()!.trim();
        if (Object.keys(vars).length) for (const one of clean.split(",")) rules.push({ selector: one.trim(), vars, deviceDark, order: order++ });
      }
    }
  };
  collect(rest, false);
  return rules;
}

const rules = parseRules();

/** The variables in force for one page: explicit theme (or none = follow the device), accent, device setting. */
function resolveVars(theme: "light" | "dark" | null, accent: string, deviceDark: boolean): Record<string, string> {
  const matching = rules.filter((rule) => {
    if (rule.deviceDark && !deviceDark) return false;
    const themeWanted = /\[data-theme="(\w+)"\]/.exec(rule.selector.replace(/:not\([^)]*\)/g, ""))?.[1];
    const themeRefused = /:not\(\[data-theme="(\w+)"\]\)/.exec(rule.selector)?.[1];
    const accentWanted = /\[data-accent="(\w+)"\]/.exec(rule.selector)?.[1];
    if (!rule.selector.startsWith(":root")) return false;
    if (themeWanted && themeWanted !== theme) return false;
    if (themeRefused && themeRefused === theme) return false;
    if (accentWanted && accentWanted !== accent) return false;
    return true;
  });
  const specificity = (selector: string) => 1 + (selector.match(/\[|:not\(/g)?.length ?? 0) - (selector.match(/:not\(\[/g)?.length ?? 0);
  matching.sort((a, b) => specificity(a.selector) - specificity(b.selector) || a.order - b.order);
  return Object.assign({}, ...matching.map((rule) => rule.vars)) as Record<string, string>;
}

type Rgb = [number, number, number];
const rgb = (vars: Record<string, string>, name: string): Rgb => {
  const value = vars[`color-${name}`];
  if (!value) throw new Error(`--color-${name} isn't set`);
  return value.split(/\s+/).map(Number) as Rgb;
};
const luminance = (color: Rgb) =>
  color
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** A 10% tint of a colour over a background — the status badges (bg-success/10). */
const tint = (color: Rgb, over: Rgb, alpha = 0.1): Rgb => color.map((v, i) => Math.round(v * alpha + over[i]! * (1 - alpha))) as Rgb;

const ACCENTS = ["teal", "indigo", "violet", "rose", "amber"];
const SCENES = [
  { name: "light", theme: "light" as const, deviceDark: false },
  { name: "dark", theme: "dark" as const, deviceDark: false },
  { name: "device dark", theme: null, deviceDark: true },
];

describe("colour contrast in every theme and accent", () => {
  for (const scene of SCENES) {
    for (const accent of ACCENTS) {
      it(`${scene.name}, ${accent}`, () => {
        const vars = resolveVars(scene.theme, accent, scene.deviceDark);
        const c = (name: string) => rgb(vars, name);
        const failures: string[] = [];
        const need = (label: string, a: Rgb, b: Rgb, min: number) => {
          const ratio = contrast(a, b);
          if (ratio < min) failures.push(`${label}: ${ratio.toFixed(2)} (needs ${min})`);
        };
        for (const surface of ["bg", "canvas"]) {
          need(`fg on ${surface}`, c("fg"), c(surface), 4.5);
          need(`muted on ${surface}`, c("muted"), c(surface), 4.5);
          need(`brand text on ${surface}`, c("brand"), c(surface), 4.5);
        }
        need("text on a brand button", c("on-brand"), c("brand"), 4.5);
        need("text on a danger button", c("on-danger"), c("danger"), 4.5);
        need("icon on the Telegram tile", c("on-telegram"), c("telegram"), 3);
        for (const status of ["success", "warning", "danger", "info"]) {
          need(`${status} on bg`, c(status), c("bg"), 4.5);
          need(`${status} on its badge`, c(status), tint(c(status), c("bg")), 4.5);
        }
        need("menu text", c("nav-fg"), c("nav-bg"), 4.5);
        need("menu grey text", c("nav-muted"), c("nav-bg"), 4.5);
        need("menu badge numbers", c("nav-badge"), tint(c("nav-badge"), c("nav-bg"), 0.15), 4.5);
        need("current-page bar", c("nav-accent"), c("nav-bg"), 3);
        need("logo square icon", c("nav-bg"), c("nav-accent"), 3);
        expect(failures.join("; ")).toBe("");
      });
    }
  }

  it("follows the device's dark setting exactly like choosing dark", () => {
    for (const accent of ACCENTS) {
      expect(resolveVars(null, accent, true)).toEqual(resolveVars("dark", accent, false));
    }
  });
});
