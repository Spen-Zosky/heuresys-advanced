"use client";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";

/**
 * Dashboard shell — grid 64px / 1fr / 44px.
 * Spec: docs/07_sidebar_specification.md § "State management".
 *
 * The middle row uses an inner grid with data-shell="grid" so the Sidebar
 * client component can mutate `grid-template-columns` inline (with !important)
 * for collapse/expand. The initial inline value is set in the markup to avoid
 * FOUC and to work around a Chrome quirk on `transition: grid-template-columns`.
 */

export type DashboardShellProps = Readonly<{
  children: React.ReactNode;
  /** Optional override for the initial sidebar width (px). Default 260. */
  initialSidebarWidth?: number;
}>;

export function DashboardShell({ children, initialSidebarWidth = 260 }: DashboardShellProps) {
  return (
    <div className="h-screen grid grid-rows-[64px_1fr_44px] overflow-hidden bg-background text-foreground">
      <Header />

      <div
        data-shell="grid"
        className="grid min-h-0"
        style={{ gridTemplateColumns: `${initialSidebarWidth}px 1fr` } as React.CSSProperties}
      >
        <Sidebar />

        <main className="min-h-0 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <Footer />
    </div>
  );
}
