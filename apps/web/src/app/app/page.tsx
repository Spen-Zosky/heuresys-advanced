"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useCurrentUserPermissions } from "../../lib/api/auth";
import { landingForPermissions } from "../../lib/landing";

/**
 * V-4 (D-23 del giro V4). Il logo dell'intestazione porta qui, come «pagina iniziale».
 * Prima questa rotta rimandava al login, che non rimandava avanti chi era gia' entrato:
 * cliccare il logo voleva dire tornare al modulo di accesso. Ora la pagina iniziale si
 * calcola dalla sessione, con la stessa regola dell'accesso (`landingForPermissions`);
 * senza sessione si va al login.
 */
export default function AppHomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const perms = useCurrentUserPermissions();

  useEffect(() => {
    if (perms.data) router.replace(landingForPermissions(perms.data.permissions));
    else if (perms.isError) router.replace("/login");
  }, [perms.data, perms.isError, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <span data-testid="app-home-loading" className="text-sm text-muted-foreground">{t("loading")}</span>
    </main>
  );
}
