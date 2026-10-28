"use client";

import { cn } from "@khmio/ui";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { readStored, writeStored } from "@/lib/device-storage";
import { ADMIN_NAV, adminPath, isComingSoon, type AdminBadge, type AdminNavGroup } from "./admin-nav";

/** Every page not built yet in this admin, gathered at the bottom and folded until opened. */
const COMING_LATER = "groupComingLater";

interface Indicator {
  top: number;
  height: number;
  visible: boolean;
}

/** Folded groups are remembered per viewer (under the name used when there was also a mockup admin, so choices are kept). */
const CLOSED_GROUPS_KEY = "khmio:live-admin-nav-closed";

function readClosedGroups(): Set<string> {
  return new Set(readStored(CLOSED_GROUPS_KEY, z.array(z.string())) ?? [COMING_LATER]);
}

/**
 * The admin menu, working pages first: each group holds only the pages built
 * in this admin, and the rest wait in one "Coming later" group at the bottom,
 * folded — so the pages in use fit a laptop screen without scrolling. Groups
 * fold open and closed, one highlight slides to the current page, and the
 * current page is scrolled into view. `compact` is the icon-only sidebar: every
 * working page stays visible there, and "Coming later" is left out.
 */
export function AdminNavMenu({
  compact,
  base,
  activeKey,
  badgeCount,
}: {
  compact: boolean;
  /** "/km/admin". */
  base: string;
  activeKey: string | undefined;
  badgeCount: Partial<Record<AdminBadge, number>>;
}) {
  const t = useTranslations("AdminNav");
  const idPrefix = useId();
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  // Only rendered in the browser (the shell waits for saved data).
  const [closedGroups, setClosedGroups] = useState(() => readClosedGroups());
  const [indicator, setIndicator] = useState<Indicator>({ top: 0, height: 0, visible: false });
  // Slide only after the first measurement, so the highlight doesn't fly in on load.
  const [animate, setAnimate] = useState(false);

  const groups: AdminNavGroup[] = useMemo(() => {
    const working = ADMIN_NAV.map((group) => ({ ...group, items: group.items.filter((item) => !isComingSoon(item)) })).filter(
      (group) => group.items.length > 0,
    );
    const later = ADMIN_NAV.flatMap((group) => group.items).filter((item) => isComingSoon(item));
    return later.length > 0 && !compact ? [...working, { key: COMING_LATER, items: later }] : working;
  }, [compact]);
  const activeGroupKey = groups.find((group) => group.items.some((item) => item.key === activeKey))?.key;

  // Landing on a page opens the group it lives in.
  useEffect(() => {
    if (!activeGroupKey) return;
    setClosedGroups((prev) => {
      if (!prev.has(activeGroupKey)) return prev;
      const next = new Set(prev);
      next.delete(activeGroupKey);
      return next;
    });
  }, [activeGroupKey]);

  function toggleGroup(key: string) {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeStored(CLOSED_GROUPS_KEY, [...next]); // not remembered when storage refuses
      return next;
    });
  }

  const measure = useCallback(() => {
    const nav = navRef.current;
    const link = activeRef.current;
    if (!nav || !link) {
      // Back to the top too: a highlight left far down would stretch the menu and make it scroll.
      setIndicator((prev) => (prev.visible || prev.top !== 0 ? { top: 0, height: 0, visible: false } : prev));
      return;
    }
    const navBox = nav.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    const folded = link.closest("[data-folded]") !== null;
    setIndicator({ top: linkBox.top - navBox.top, height: linkBox.height, visible: !folded });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, activeKey, compact, closedGroups]);

  // Groups folding and the sidebar changing width move the items; follow them.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    const frame = window.requestAnimationFrame(() => setAnimate(true));
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [measure]);

  // Keep the current page in view in a long menu.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeKey]);

  return (
    <nav ref={navRef} aria-label={t("menuLabel")} className="relative flex flex-col gap-3">
      <span
        aria-hidden="true"
        style={{ transform: `translateY(${indicator.top}px)`, height: indicator.height }}
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 rounded-DEFAULT bg-nav-fg/10",
          "before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-nav-accent",
          animate && "transition-[transform,height,opacity] duration-300 ease-out motion-reduce:transition-none",
          indicator.visible ? "opacity-100" : "opacity-0",
        )}
      />

      {groups.map((group) => {
        // A one-item group (the overview) has nothing to fold; "Coming later" always folds.
        const foldable = !compact && (group.items.length > 1 || group.key === COMING_LATER);
        const label = group.key === COMING_LATER ? t("groupComingLater", { count: group.items.length }) : t(group.key);
        const open = !foldable || !closedGroups.has(group.key);
        const panelId = `${idPrefix}-${group.key}`;
        const holdsActive = group.key === activeGroupKey;

        return (
          <div key={group.key} className="flex flex-col">
            {compact ? (
              <div className="mx-auto mb-2 h-px w-6 bg-nav-border" aria-hidden="true" />
            ) : foldable ? (
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={open}
                aria-controls={panelId}
                className="group flex min-h-touch items-center gap-2 rounded-DEFAULT px-3 text-xs font-semibold uppercase tracking-wider text-nav-muted/80 transition-colors hover:text-nav-fg"
              >
                <span className="flex-1 text-left">{label}</span>
                {holdsActive && !open && <span className="h-1.5 w-1.5 rounded-full bg-nav-accent" aria-hidden="true" />}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200 motion-reduce:transition-none",
                    !open && "-rotate-90",
                  )}
                  aria-hidden="true"
                />
              </button>
            ) : (
              <p className="flex min-h-9 items-center px-3 text-xs font-semibold uppercase tracking-wider text-nav-muted/80">{label}</p>
            )}

            {/* Grid rows 0fr ↔ 1fr animates to the content's real height.
                `invisible` takes folded items out of the tab order. */}
            <div
              id={panelId}
              data-folded={open ? undefined : ""}
              className={cn(
                "grid transition-[grid-template-rows,visibility] duration-300 ease-out motion-reduce:transition-none",
                open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
              )}
            >
              <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
                {group.items.map((item) => {
                  const isActive = activeKey === item.key;
                  const count = item.badge ? (badgeCount[item.badge] ?? 0) : 0;
                  const soon = isComingSoon(item);
                  return (
                    <Link
                      key={item.key}
                      ref={isActive ? activeRef : undefined}
                      href={adminPath(base, item.segment)}
                      aria-current={isActive ? "page" : undefined}
                      title={compact ? t(item.key) : undefined}
                      className={cn(
                        "relative flex min-h-touch shrink-0 items-center gap-3 rounded-DEFAULT px-3 text-sm font-medium transition-colors",
                        compact && "justify-center px-0",
                        isActive ? "text-nav-fg" : "text-nav-muted hover:bg-nav-fg/5 hover:text-nav-fg",
                        soon && !isActive && "opacity-70",
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {!compact && <span className="flex-1 truncate">{t(item.key)}</span>}
                      {count > 0 &&
                        (compact ? (
                          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-nav-badge" aria-label={String(count)} />
                        ) : (
                          <span className="rounded-full bg-nav-badge/15 px-2 py-0.5 text-xs font-semibold text-nav-badge">
                            {count}
                          </span>
                        ))}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
