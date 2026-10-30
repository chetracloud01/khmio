import { StatCard } from "@khmio/ui";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface DetailStat {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}

/**
 * The row of number cards under a detail page's title (a customer, an item,
 * a supplier, a bill): two across on a phone, four on a laptop, with an
 * optional line under them. One look for every module's detail page.
 */
export function DetailStats({ stats, note }: { stats: DetailStat[]; /** A short line under the cards (what's counted, what's not). */ note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} detail={stat.detail} />
        ))}
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}
