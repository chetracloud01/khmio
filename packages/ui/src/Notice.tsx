"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Tone } from "./blocks";
import { cn } from "./cn";

type NoticeTone = Extract<Tone, "warning" | "danger" | "info" | "success" | "muted">;

const NOTICE_STYLES: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  warning: { box: "border-warning/40 bg-warning/5", icon: "text-warning", Icon: AlertTriangle },
  danger: { box: "border-danger/40 bg-danger/5", icon: "text-danger", Icon: AlertCircle },
  info: { box: "border-info/40 bg-info/5", icon: "text-info", Icon: Info },
  success: { box: "border-success/40 bg-success/5", icon: "text-success", Icon: CheckCircle2 },
  muted: { box: "border-border bg-border/10", icon: "text-muted", Icon: Info },
};

export interface NoticeProps {
  tone?: NoticeTone;
  /** A bold first line. */
  title?: ReactNode;
  children?: ReactNode;
  /** A button or link under the text. */
  action?: ReactNode;
  /** The tone's icon by default; another icon, or `false` for none. */
  icon?: LucideIcon | false;
  /** "alert" for something that just went wrong (read out at once), "status" for a quiet update. */
  role?: "alert" | "status";
  className?: string;
}

/**
 * A coloured message box: something to fix ("Add your Bakong ID"), an error
 * after saving, a tip. One look for every notice of the app; the words come
 * from the caller.
 */
export function Notice({ tone = "warning", title, children, action, icon, role, className }: NoticeProps) {
  const style = NOTICE_STYLES[tone];
  const Icon = icon === false ? null : (icon ?? style.Icon);
  return (
    <div role={role} className={cn("flex gap-2.5 rounded-DEFAULT border p-3 text-sm text-fg", style.box, className)}>
      {Icon && <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.icon)} aria-hidden="true" />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}
