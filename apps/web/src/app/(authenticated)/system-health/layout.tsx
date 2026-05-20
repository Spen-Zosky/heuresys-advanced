import type { ReactNode } from "react";

/**
 * Fullscreen takeover for the production /system-health page.
 *
 * The parent `(authenticated)/layout.tsx` provides a top-nav header + nav
 * links + logout button. For the SUPERUSER system-health observability page
 * we want a fullscreen DashboardShell experience instead, identical to the
 * canonical prototype.
 *
 * Pattern: position:fixed inset-0 z-50 covers the authenticated chrome
 * visually while keeping it in the DOM (so auth context, providers, and
 * theme remain active).
 *
 * The same pattern is used for the brand showcase route at
 * `apps/web/src/app/showcase/system-health/layout.tsx`.
 */
export default function SystemHealthAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-[var(--background)]">
      {children}
    </div>
  );
}
