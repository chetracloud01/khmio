"use client";

import type { Currency } from "@khmio/shared";
import { cn } from "@khmio/ui";
import { ArrowDownRight, ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

// The pieces the home's chart cards are made of (design/screens.md S3): the
// card with its title and link, a figure with its change, one tooltip and
// one set of chart colours — all from the theme's tokens, so light and dark
// follow. Words come from the card that uses them.

/** Chart colours, from the design tokens. Sales and profit in brand teal; cost and the period before in grey; a loss or overdue in red. */
export const CHART_COLOR = {
  main: "rgb(var(--color-brand))",
  mainSoft: "rgb(var(--color-brand) / 0.18)",
  neutral: "rgb(var(--color-muted) / 0.55)",
  neutralLine: "rgb(var(--color-muted))",
  danger: "rgb(var(--color-danger))",
  grid: "rgb(var(--color-border))",
  axis: "rgb(var(--color-muted))",
} as const;

/** "$1.2k", "850k៛": a chart axis's money. */
export function compactMoney(amount: number, currency: Currency): string {
  const value = Math.abs(currency === "USD" ? amount / 100 : amount);
  const short = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  // A loss reads "-$250", the sign before the money.
  const sign = amount < 0 ? "-" : "";
  return currency === "USD" ? `${sign}$${short}` : `${sign}${short}៛`;
}

/** A home card: icon, title, a line under it, a link on the right, then its content. */
export function ChartCard({ icon: Icon, title, subtitle, link, children }: { icon: LucideIcon; title: string; subtitle?: string; link?: { href: string; label: string }; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-bg p-4 shadow-card md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand" aria-hidden="true">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-normal">{title}</h2>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {link && (
          <Link href={link.href} className="-mr-2 flex min-h-touch shrink-0 items-center gap-0.5 rounded-full px-2 text-sm font-medium text-brand hover:bg-brand/10">
            {link.label}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/** ▲ 18% in green, ▼ 6% in red (or the other way round when less is better), — with nothing to compare. */
export function ChangeText({
  percent,
  lessIsBetter = false,
  newLabel,
  text,
}: {
  percent: number | null;
  lessIsBetter?: boolean;
  /** Shown when there was nothing before but there is now. */ newLabel?: string;
  /** Written instead of the percent ("2 pts" for a margin). */ text?: string;
}) {
  if (percent === null) return <span className="text-xs font-medium text-muted">{newLabel ?? "—"}</span>;
  const up = percent >= 0;
  const good = up !== lessIsBetter;
  return (
    <span className={cn("inline-flex items-center text-xs font-semibold tabular-nums", good ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
      {text ?? `${Math.abs(percent)}%`}
    </span>
  );
}

/** A figure's value in a tone: a loss or overdue in red. */
const VALUE_TONE = {
  danger: "text-danger",
  success: "text-success",
  warning: "text-warning",
} as const;

/** A series' swatch: a square for bars and areas, a dashed line for the period before. */
function Swatch({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return dashed ? (
    <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: color }} aria-hidden="true" />
  ) : (
    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
  );
}

/** One figure: its label, the value (big for the card's lead), a line under it, and its change. */
export function KpiTile({
  label,
  value,
  sub,
  change,
  lead = false,
  tone,
  className,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  change?: ReactNode;
  lead?: boolean;
  /** Colours the value: a loss, overdue. */ tone?: keyof typeof VALUE_TONE;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-xl p-3", lead ? "bg-brand/5 ring-1 ring-brand/15" : "bg-canvas", className)}>
      <span className="text-xs leading-normal text-muted">{label}</span>
      {/* Car-sized amounts must show whole: smaller on a phone, and allowed to wrap rather than be cut. */}
      <span className={cn("font-bold tabular-nums leading-snug [overflow-wrap:anywhere]", lead ? "text-xl sm:text-2xl" : "text-base sm:text-lg", tone && VALUE_TONE[tone])}>{value}</span>
      {(sub || change) && (
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {change}
          {sub}
        </span>
      )}
    </div>
  );
}

/** A chart's tooltip: the point's name, then each series with its colour, name and value. */
export function ChartTooltipBox({ title, rows }: { title: string; rows: { color: string; label: string; value: string; dashed?: boolean }[] }) {
  return (
    <div className="min-w-36 rounded-xl border border-border bg-bg px-3 py-2 text-xs shadow-raised">
      <p className="mb-1 font-semibold">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted">
              <Swatch color={row.color} dashed={row.dashed} />
              {row.label}
            </span>
            <span className="font-semibold tabular-nums text-fg">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A small legend under a chart: each series' swatch and name, so colour is never the only key. */
export function ChartLegend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Swatch color={item.color} dashed={item.dashed} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** A figure's trend in a few pixels: no axes, no labels; read out by its label. */
export function Sparkline({ values, label, color = CHART_COLOR.main }: { values: readonly number[]; label: string; color?: string }) {
  const data = values.map((value, index) => ({ index, value }));
  return (
    <div className="h-8 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.12} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
