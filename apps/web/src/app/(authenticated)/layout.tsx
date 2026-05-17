"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@heuresys/ui";
import { useCurrentUser, useLogout } from "../../lib/api/auth";
import { isApiError, SessionExpiredError } from "../../lib/api/errors";
import { landingForRoles } from "../../lib/landing";

const ADMIN_ROLES = new Set([
  "PLATFORM_ADMIN",
  "TENANT_ADMIN",
  "BLUEPRINT_MANAGER",
  "HRMS_MANAGER",
  "PROCESS_OWNER",
  "MANAGER",
]);

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const me = useCurrentUser();
  const logout = useLogout();

  if (me.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span data-testid="app-loading" className="text-sm opacity-60">Caricamento…</span>
      </main>
    );
  }
  if (me.isError) {
    if (me.error instanceof SessionExpiredError || (isApiError(me.error) && me.error.status === 401)) {
      router.replace("/login");
      return null;
    }
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span data-testid="app-error" className="text-sm text-red-600">
          {me.error instanceof Error ? me.error.message : "Errore sessione"}
        </span>
      </main>
    );
  }
  const user = me.data;
  if (!user) {
    router.replace("/login");
    return null;
  }
  const roles = user.roles ?? [];
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.has(r));
  const landing = landingForRoles(roles);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={landing} className="font-semibold" data-testid="app-brand">
              Heuresys
            </Link>
            <nav className="flex items-center gap-4 text-sm" data-testid="app-nav">
              {hasAdminRole && (
                <>
                  <Link href="/dashboard" data-testid="nav-dashboard">Dashboard</Link>
                  <Link href="/users" data-testid="nav-users">Utenti</Link>
                  <Link href="/positions" data-testid="nav-positions">Posizioni</Link>
                </>
              )}
              <Link href="/me" data-testid="nav-me">My HR</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span data-testid="app-user-email" className="opacity-70">{user.email}</span>
            <Button
              variant="outline"
              size="sm"
              data-testid="app-logout"
              onClick={async () => {
                await logout.mutateAsync();
                router.replace("/login");
              }}
            >
              Esci
            </Button>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
