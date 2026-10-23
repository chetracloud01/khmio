import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// /styleguide is the list of what exists (design/design-standard.md "Kit or
// app block"): every component exported by packages/ui must be shown there,
// inside a Demo labelled with its quoted name. Adding a kit part without
// showing it fails here.

const kitDir = resolve(__dirname, "../../../../../packages/ui/src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Components: exported functions and consts named like Button (not THEME, not cn). */
function kitComponents(): string[] {
  const names = sourceFiles(kitDir).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/^export (?:function|const) ([A-Z][a-z]\w*)/gm)].map((match) => match[1] ?? ""),
  );
  return [...new Set(names)].sort();
}

/** Names written as quoted strings in the styleguide's files: the Demo labels. */
function shownNames(): Set<string> {
  const text = sourceFiles(__dirname)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  return new Set([...text.matchAll(/"([A-Z][A-Za-z]+)"/g)].map((match) => match[1] ?? ""));
}

describe("styleguide coverage", () => {
  it("finds the kit's components", () => {
    expect(kitComponents()).toEqual(expect.arrayContaining(["Button", "MoneyInput", "SiteHeader"]));
  });

  it("shows every kit component on /styleguide", () => {
    const shown = shownNames();
    expect(kitComponents().filter((name) => !shown.has(name))).toEqual([]);
  });
});
