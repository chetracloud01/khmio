import { cn } from "@khmio/ui";

/** One line of a statement: an amount added or taken away, a subtotal under a rule, or the result at the bottom. */
export interface StatementLine {
  key: string;
  label: string;
  /** "+ $1.00", "− $1.00" or "$1.00", and the other currency's under it. */
  amount: { main: string; other: string | null };
  kind: "line" | "subtotal" | "result";
  /** A line read out but not part of the sum (VAT collected). */
  aside?: boolean;
  /** A loss or anything below zero. */
  negative?: boolean;
  hint?: string;
}

/**
 * A statement read top to bottom (the profit and loss report): each amount
 * added or taken away, subtotals under a rule, the result at the bottom in
 * large type. Prints as it shows.
 */
export function ProfitStatement({ lines, label }: { lines: readonly StatementLine[]; label: string }) {
  return (
    <dl aria-label={label} className="flex flex-col">
      {lines.map((line) => (
        <div
          key={line.key}
          className={cn(
            "flex items-start justify-between gap-3 py-2",
            line.kind === "subtotal" && "border-t border-border font-semibold",
            line.kind === "result" && "mt-1 rounded-xl bg-brand/10 px-3 py-3 text-base font-bold",
            line.aside && "border-t border-dashed border-border text-muted",
          )}
        >
          <dt className={cn("min-w-0", line.kind === "line" && !line.aside && "ps-3")}>
            <span className="block">{line.label}</span>
            {line.hint && <span className="block text-xs font-normal text-muted">{line.hint}</span>}
          </dt>
          <dd className="shrink-0 text-right tabular-nums">
            <span className={cn("block", line.negative && "text-danger")}>{line.amount.main}</span>
            {line.amount.other && <span className={cn("block text-xs font-normal", line.negative ? "text-danger" : "text-muted")}>{line.amount.other}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
