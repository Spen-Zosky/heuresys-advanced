import type { ReactNode } from "react";

/**
 * Pass-through layout for the production /system-health page.
 *
 * Until F7, this rendered a fullscreen `position:fixed inset-0 z-50` takeover so
 * the mock `SystemHealthDashboard` could show its own DashboardShell chrome
 * (header/sidebar/footer) instead of the authenticated chrome. After F7 the
 * production route renders `SystemHealthLive` — a standard authenticated page
 * (PageHeader + sections) composed from @heuresys/ui primitives — so it now
 * lives inside the normal authenticated chrome (top nav + DB-driven sidebar),
 * consistent with every other admin page. No takeover needed.
 *
 * The brand showcase route keeps its own takeover at
 * `apps/web/src/app/showcase/system-health/layout.tsx` (the mock still uses
 * DashboardShell there).
 */
export default function SystemHealthAuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
