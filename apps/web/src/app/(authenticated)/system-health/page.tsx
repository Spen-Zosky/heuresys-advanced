"use client";

import { useCurrentUserPermissions } from "../../../lib/api/auth";
import { SystemHealthLive } from "../../../components/SystemHealthLive";
import { StatoCaricamento } from "@/components/stato-pagina";

/**
 * /system-health — production route, gated on `observability:read`.
 *
 * S-3 (piano interfacce 2026-11-03): la pagina chiedeva il RUOLO `PLATFORM_ADMIN` e
 * rimandava tutti gli altri alla radice, anche `PLATFORM_OPERATOR`, che ha il permesso
 * delle tre rotte che la pagina legge. Ora vale il permesso, come per la voce di menu
 * (mig. 000469) e la guardia di pagina del layout: chi non ce l'ha vede «non hai accesso»
 * dal layout, e questa pagina non monta il cruscotto. Nessuna lista di ruoli decide (S-22).
 *
 * The sibling `layout.tsx` provides the fullscreen takeover (no top nav of
 * the authenticated layout shows around the DashboardShell).
 */
export default function SystemHealthPage() {
  const perms = useCurrentUserPermissions();

  if (perms.isLoading) {
    return (
      <main className="flex h-screen items-center justify-center">
        <StatoCaricamento />
      </main>
    );
  }

  if (!(perms.data?.permissions ?? []).includes("observability:read")) return null;

  return <SystemHealthLive />;
}
