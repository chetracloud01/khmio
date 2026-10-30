"use client";

import { Button } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminFrame } from "@/components/admin-frame/admin-frame";
import type { AdminBadge } from "@/components/admin-frame/admin-nav";
import { adminBadgesSchema, adminMeSchema, type AdminMe } from "@/lib/admin-api";
import { api, ApiError, apiSend } from "@/lib/api";
import { AdminContext, type ActiveAdmin } from "./admin-context";
import { AdminLogin } from "./admin-login";

// The admin area (roadmap step 7), laptop-first and usable on a phone, in
// the admin frame (components/admin-frame). Nothing renders
// until the API says both login steps are done; the API checks the admin's
// role again on every request.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("App");
  const [me, setMe] = useState<AdminMe | null>(null);
  const [state, setState] = useState<"checking" | "ready" | "offline">("checking");

  const load = useCallback(() => {
    setState("checking");
    api("/admin/auth/me", adminMeSchema)
      .then((result) => {
        setMe(result);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          setMe(null);
          setState("ready");
        } else setState("offline");
      });
  }, []);
  useEffect(load, [load]);

  if (state === "checking") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-muted" aria-busy="true">
        <span role="status">{t("loading")}</span>
      </div>
    );
  }
  if (state === "offline") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas p-4 text-center" role="alert">
        <p className="font-semibold">{t("offlineTitle")}</p>
        <Button variant="primary" onClick={load}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (!me || me.stage !== "active") return <AdminLogin me={me} onSignedIn={load} />;
  return (
    <AdminContext.Provider value={me}>
      <AdminShell me={me}>{children}</AdminShell>
    </AdminContext.Provider>
  );
}

function AdminShell({ me, children }: { me: ActiveAdmin; children: ReactNode }) {
  const tApp = useTranslations("AdminApp");
  const pathname = usePathname();
  const [badges, setBadges] = useState<Partial<Record<AdminBadge, number>>>({});

  // Asked again on every page change, so a fixed problem clears from the menu.
  useEffect(() => {
    api("/admin/badges", adminBadgesSchema).then(setBadges, () => undefined);
  }, [pathname]);

  async function signOut() {
    await apiSend("/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <AdminFrame badgeCount={badges} account={{ name: me.name, role: tApp(`role_${me.role}`) }} onSignOut={() => void signOut()}>
      {children}
    </AdminFrame>
  );
}
