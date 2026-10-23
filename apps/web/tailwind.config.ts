import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./mock/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Khmer vowels sit above and below the line and get cut off under ~1.5
      // (design/design-standard.md §3). Tailwind's own line heights for these
      // sizes are 1.0–1.43, so every size carries at least 1.5 here; an explicit
      // leading-* class can still override it where a design needs that.
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.875rem", { lineHeight: "1.3125rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.875rem" }],
        "2xl": ["1.5rem", { lineHeight: "2.25rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.8125rem" }],
        "4xl": ["2.25rem", { lineHeight: "3.375rem" }],
        "5xl": ["3rem", { lineHeight: "4.5rem" }],
      },
      fontFamily: {
        khmer: ["var(--font-kantumruy)", "Kantumruy Pro", "Noto Sans Khmer", "system-ui", "sans-serif"],
      },
      spacing: {
        touch: "44px",
      },
      borderRadius: {
        DEFAULT: "12px",
      },
      colors: {
        brand: "rgb(var(--color-brand) / <alpha-value>)",
        "on-brand": "rgb(var(--color-on-brand) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        "on-danger": "rgb(var(--color-on-danger) / <alpha-value>)",
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        fg: "rgb(var(--color-fg) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        paper: {
          DEFAULT: "rgb(var(--color-paper) / <alpha-value>)",
          ink: "rgb(var(--color-paper-ink) / <alpha-value>)",
          muted: "rgb(var(--color-paper-muted) / <alpha-value>)",
          line: "rgb(var(--color-paper-line) / <alpha-value>)",
          paid: "rgb(var(--color-paper-paid) / <alpha-value>)",
          unpaid: "rgb(var(--color-paper-unpaid) / <alpha-value>)",
          void: "rgb(var(--color-paper-void) / <alpha-value>)",
          brand: "rgb(var(--color-paper-brand) / <alpha-value>)",
        },
        telegram: {
          DEFAULT: "rgb(var(--color-telegram) / <alpha-value>)",
          on: "rgb(var(--color-on-telegram) / <alpha-value>)",
        },
        khqr: {
          DEFAULT: "rgb(var(--color-khqr) / <alpha-value>)",
          surface: "rgb(var(--color-khqr-surface) / <alpha-value>)",
          ink: "rgb(var(--color-khqr-ink) / <alpha-value>)",
        },
        nav: {
          bg: "rgb(var(--color-nav-bg) / <alpha-value>)",
          fg: "rgb(var(--color-nav-fg) / <alpha-value>)",
          muted: "rgb(var(--color-nav-muted) / <alpha-value>)",
          border: "rgb(var(--color-nav-border) / <alpha-value>)",
          accent: "rgb(var(--color-nav-accent) / <alpha-value>)",
          badge: "rgb(var(--color-nav-badge) / <alpha-value>)",
        },
      },
      keyframes: {
        "page-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        "drawer-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "none" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // A small pop when something lands in the cart.
        bump: {
          "0%, 100%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.04)" },
        },
        "sheet-in": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "none" },
        },
        // Mio's little jump on the "Paid!" screen.
        hop: {
          "0%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-14px)" },
          "55%": { transform: "translateY(0)" },
          "70%": { transform: "translateY(-5px)" },
        },
      },
      animation: {
        bump: "bump 300ms ease-out",
        "sheet-in": "sheet-in 220ms ease-out both",
        "page-in": "page-in 220ms ease-out both",
        "drawer-in": "drawer-in 250ms ease-out both",
        "fade-in": "fade-in 200ms ease-out both",
        hop: "hop 900ms ease-out both",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)",
        raised: "0 4px 12px rgb(15 23 42 / 0.08), 0 1px 3px rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
