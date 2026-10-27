import { cn } from "./cn";

export interface DiscountBadgeProps {
  percent: number;
  className?: string;
}

export function DiscountBadge({ percent, className }: DiscountBadgeProps) {
  return (
    <span
      className={cn("rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-on-danger shadow-sm", className)}
    >
      -{percent}%
    </span>
  );
}
