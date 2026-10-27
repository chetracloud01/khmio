"use client";

import { cn, GroupTitle, IconBadge, type Tone } from "@khmio/ui";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode } from "react";

export interface MenuRow {
  /** Unique within the list. */
  key: string;
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  /** One line under the title. */
  detail?: string;
  /** Opens a page… */
  href?: string;
  /** …or does something here (opens a sheet). */
  onClick?: () => void;
  /** The current choice at the right ("English"), or a count. */
  value?: ReactNode;
}

/**
 * A group of rows, each opening its page: My shop's "Your shop" and
 * "Language & display", and any settings list after them. Give it rows as
 * data; adding a setting is one more row.
 */
export function MenuList({ title, rows, className }: { title?: string; rows: MenuRow[]; className?: string }) {
  const titleId = useId();
  const row = "flex min-h-[64px] w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-border/10";
  return (
    <nav aria-labelledby={title ? titleId : undefined} className={cn("flex flex-col gap-2", className)}>
      {title && <GroupTitle id={titleId}>{title}</GroupTitle>}
      <div className="overflow-hidden rounded-2xl border border-border bg-bg shadow-card">
        {rows.map((item) => {
          const content = (
            <>
              <IconBadge icon={item.icon} tone={item.tone} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.title}</span>
                {item.detail && <span className="block truncate text-xs text-muted">{item.detail}</span>}
              </span>
              {item.value && <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted">{item.value}</span>}
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            </>
          );
          return item.href ? (
            <Link key={item.key} href={item.href} className={row}>
              {content}
            </Link>
          ) : (
            <button key={item.key} type="button" onClick={item.onClick} className={row}>
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
