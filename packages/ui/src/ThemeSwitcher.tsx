"use client";

import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "./cn";
import {
  ACCENT_STORAGE_KEY,
  ACCENT_SWATCHES,
  ACCENTS,
  applyTheme,
  THEME_MODES,
  THEME_STORAGE_KEY,
  type Accent,
  type ThemeMode,
} from "./theme";

export interface ThemeSwitcherLabels {
  /** Accessible name for the button, e.g. "Theme". */
  button: string;
  mode: string;
  light: string;
  dark: string;
  system: string;
  accent: string;
  accents: Record<Accent, string>;
}

const MODE_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/** The theme and accent saved on this device (system and teal when none). */
export function readStoredTheme(): { mode: ThemeMode; accent: Accent } {
  try {
    const mode = window.localStorage.getItem(THEME_STORAGE_KEY);
    const accent = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return {
      mode: THEME_MODES.find((value) => value === mode) ?? "system",
      accent: ACCENTS.find((value) => value === accent) ?? "teal",
    };
  } catch {
    return { mode: "system", accent: "teal" };
  }
}

/** A palette button that opens light/dark/system and accent-colour choices. */
export function ThemeSwitcher({
  labels,
  align = "end",
  direction = "down",
  className,
  buttonClassName,
}: {
  /** No hard-coded text in this package: the caller supplies translated labels. */
  labels: ThemeSwitcherLabels;
  align?: "start" | "end";
  direction?: "down" | "up";
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={labels.button}
        aria-expanded={open}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-border/30 hover:text-fg",
          buttonClassName,
        )}
      >
        <Palette className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-40" />
          <div
            role="dialog"
            aria-label={labels.button}
            className={cn(
              "absolute z-50 w-64 rounded-DEFAULT border border-border bg-bg p-3 text-fg shadow-raised",
              align === "end" ? "right-0" : "left-0",
              direction === "down" ? "top-12" : "bottom-12",
            )}
          >
            <ThemePicker labels={labels} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Light / dark / system and the accent colour, as choices on the page — in the
 * palette button's menu (ThemeSwitcher), or on a settings page. Kept on this
 * device and applied at once.
 */
export function ThemePicker({ labels, className }: { labels: ThemeSwitcherLabels; className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [accent, setAccent] = useState<Accent>("teal");

  useEffect(() => {
    const stored = readStoredTheme();
    setMode(stored.mode);
    setAccent(stored.accent);
  }, []);

  function choose(nextMode: ThemeMode, nextAccent: Accent) {
    setMode(nextMode);
    setAccent(nextAccent);
    applyTheme(nextMode, nextAccent);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
    } catch {
      // Storage unavailable — the theme applies for this visit only.
    }
  }

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{labels.mode}</p>
      <div role="radiogroup" aria-label={labels.mode} className="grid grid-cols-3 gap-1 rounded-DEFAULT bg-canvas p-1">
        {THEME_MODES.map((value) => {
          const Icon = MODE_ICONS[value];
          const selected = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(value, accent)}
              className={cn("flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-[10px] text-xs font-medium transition-colors", selected ? "bg-bg text-fg shadow-card" : "text-muted hover:text-fg")}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {labels[value]}
            </button>
          );
        })}
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{labels.accent}</p>
      <div role="radiogroup" aria-label={labels.accent} className="flex justify-between">
        {ACCENTS.map((value) => {
          const selected = accent === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={labels.accents[value]}
              title={labels.accents[value]}
              onClick={() => choose(mode, value)}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 ring-offset-bg transition", selected && "ring-2 ring-fg")}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: ACCENT_SWATCHES[value] }}>
                {selected && <Check className="h-4 w-4" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
