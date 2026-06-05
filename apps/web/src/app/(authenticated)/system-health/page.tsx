"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "../../../lib/api/auth";
import { SystemHealthDashboard } from "../../../components/SystemHealthDashboard";

/**
 * /system-health — production route, PLATFORM_ADMIN gated.
 *
 * The parent authenticated layout already handles session validity + 401
 * redirect to /login. This page additionally restricts visibility to the
 * PLATFORM_ADMIN role; non-superusers are bounced to the dashboard root.
 *
 * The sibling `layout.tsx` provides the fullscreen takeover (no top nav of
 * the authenticated layout shows around the DashboardShell).
 */
export default function SystemHealthPage() {
  const { t } = useTranslation("admin");
  const router = useRouter();
  const me = useCurrentUser();

  if (me.isLoading) {
    return (
      <main className="flex h-screen items-center justify-center">
        <span className="text-sm opacity-60">{t("common:loading")}</span>
      </main>
    );
  }

  const roles = me.data?.roles ?? [];
  const isPlatformAdmin = roles.includes("PLATFORM_ADMIN");

  if (!isPlatformAdmin) {
    router.replace("/");
    return null;
  }

  return <SystemHealthDashboard />;
}
