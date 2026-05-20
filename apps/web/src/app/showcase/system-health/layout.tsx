import type { ReactNode } from "react";

/**
 * Fullscreen overlay for the canonical SUPERUSER system-health showcase.
 *
 * The parent `apps/web/src/app/showcase/layout.tsx` wraps every showcase page
 * with a Brand Identity Showcase chrome (top nav + palette switcher + theme
 * toggle + footer). The system-health page is the canonical reference for the
 * full DashboardShell, so it must render at full viewport without the showcase
 * chrome around it.
 *
 * In Next.js App Router, nested layouts ADD a wrapper; they don't REPLACE the
 * parent. The cleanest way to achieve "escape parent layout" without changing
 * URL or introducing route-group gymnastics is to use position:fixed inset:0
 * with a high z-index — this visually covers the parent chrome.
 *
 * Note: the showcase chrome is still rendered in the DOM behind this fixed
 * layer. This is acceptable because (a) `<PaletteProvider>` from the parent
 * remains active (palette CSS variables still drive the system-health page),
 * (b) the user perceives a fullscreen takeover identical to a "real" page.
 */
export default function SystemHealthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-[var(--background)]">
      {children}
    </div>
  );
}
