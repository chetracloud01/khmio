"use client";

import type { ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export interface RingPart {
  key: string;
  label: string;
  amount: number;
  color: string;
  /** How the amount is written beside its name ("$1,044.50", "9 items"). */
  text: string;
  /** Written in red (overdue, out of stock). */
  alert?: boolean;
}

/**
 * Parts of a whole as a ring (the home's bills card, the reports): the total
 * in the middle, and each part named with its amount beside it — colour is
 * never the only key. Parts of nothing aren't drawn.
 */
export function RingChart({ parts, center, label, note }: { parts: RingPart[]; center: { label: string; value: string }; /** Read out for the ring. */ label: string; /** A line under the parts. */ note?: ReactNode }) {
  const drawn = parts.filter((part) => part.amount > 0);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-40 w-40 shrink-0" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={drawn} dataKey="amount" nameKey="label" innerRadius="70%" outerRadius="100%" paddingAngle={drawn.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>
              {drawn.map((part) => (
                <Cell key={part.key} fill={part.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* The whole, in the middle of the ring. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted">{center.label}</span>
          <span className="max-w-[7rem] text-lg font-bold tabular-nums leading-tight [overflow-wrap:anywhere]">{center.value}</span>
        </div>
      </div>
      <ul className="flex min-w-[10rem] flex-1 flex-col gap-2 text-sm">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: part.color }} aria-hidden="true" />
              {part.label}
            </span>
            <span className={part.alert && part.amount > 0 ? "font-semibold tabular-nums text-danger" : "font-semibold tabular-nums"}>{part.text}</span>
          </li>
        ))}
        {note && <li className="text-xs text-muted">{note}</li>}
      </ul>
    </div>
  );
}
