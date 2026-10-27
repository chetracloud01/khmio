"use client";

import { cn, PageHeader } from "@khmio/ui";
import { forwardRef, type ReactNode } from "react";
import { BackLink, useMyShopBack } from "./back-to-my-shop";
import { SELLER_FORM, SELLER_PAGE } from "./seller-frame";

export interface SubPageProps {
  /** "← My shop" by default; another page as { href, label }; `false` for none. */
  back?: { href: string; label: string } | false;
  /** The page's title (PageHeader). Leave out when the page's own card carries it. */
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** "form" 720px wide (settings), "page" 1100px (lists). */
  width?: "form" | "page";
  className?: string;
  children: ReactNode;
}

/**
 * A page reached from a menu: the way back, the title, and the content at
 * the standard width and spacing. Every My shop page is one; a new settings
 * page needs only its content.
 */
export const SubPage = forwardRef<HTMLDivElement, SubPageProps>(({ back, title, description, actions, width = "form", className, children }, ref) => {
  const myShop = useMyShopBack();
  const backTo = back === undefined ? myShop : back;
  return (
    <div ref={ref} className={cn(width === "page" ? SELLER_PAGE : SELLER_FORM, "gap-5", className)}>
      {backTo && <BackLink {...backTo} />}
      {title && <PageHeader title={title} description={description} actions={actions} />}
      {children}
    </div>
  );
});
SubPage.displayName = "SubPage";
