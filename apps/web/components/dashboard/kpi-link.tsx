"use client";

import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkline } from "@/components/home/chart-parts";

/**
 * One headline figure of the dashboard (design/screens.md S3), opening the
 * report behind it: its name, the value (the other currency under it), its
 * change against the period before, and its trend in a few pixels.
 */
export function KpiLink({
  href,
  icon: Icon,
  label,
  value,
  sub,
  change,
  spark,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: ReactNode;
  /** ChangeText and what it's against ("vs yesterday"). */
  change?: ReactNode;
  spark?: { values: readonly number[]; label: string };
}) {
  return (
    <Link href={href} className="group flex h-full min-h-touch flex-col gap-1 rounded-2xl border border-border bg-bg p-3 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <span className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="leading-normal">{label}</span>
        <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      </span>
      {/* Car-sized amounts must show whole: allowed to wrap rather than be cut. */}
      <span className="text-lg font-bold tabular-nums leading-snug [overflow-wrap:anywhere] sm:text-xl">{value}</span>
      {sub && <span className="text-xs text-muted tabular-nums">{sub}</span>}
      {change && <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted">{change}</span>}
      {spark && spark.values.some((value) => value !== 0) && (
        <span className="mt-auto pt-1">
          <Sparkline values={spark.values} label={spark.label} />
        </span>
      )}
    </Link>
  );
}
