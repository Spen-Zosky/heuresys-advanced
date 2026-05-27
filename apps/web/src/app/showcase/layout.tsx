import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { PaletteDropdown, ThemeToggle } from "@/app/showcase/_ui-client";

// CW-B59 fix: the @heuresys/ui barrel eagerly evaluates heavy class-based libs
// (three / echarts / d3 / recharts) which crash server-side page-data collection
// with "Class extends value undefined". The showcase UI primitives are now
// imported from ./_ui-client (next/dynamic + ssr:false), so the barrel is never
// evaluated during the server build. The previous `export const dynamic =
// "force-dynamic"` workaround is removed: it didn't fix the import-time crash and
// is incompatible with apps/showcase's `output: export` static build.

export const metadata = {
  title: "Heuresys — Brand Identity Showcase",
  description: "Design candidates and shell prototypes for brand identity v1 review.",
  robots: { index: false, follow: false },
};

const SHOWCASE_ENABLED =
  process.env["NEXT_PUBLIC_ENABLE_SHOWCASE"] === "1" ||
  process.env["NODE_ENV"] !== "production";

export default function ShowcaseLayout({ children }: { children: ReactNode }) {
  if (!SHOWCASE_ENABLED) notFound();

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ transition: "background-color 240ms ease, color 240ms ease" }}
    >
      {/* Skip-link for keyboard users: hidden until focused, then becomes a
         visible primary-colored button anchored to the top-left of the
         viewport. Target id="main" is the next sibling. Pattern follows
         WCAG 2.4.1 Bypass Blocks. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:inline-flex focus:items-center focus:rounded-control focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background"
      >
        Salta al contenuto principale
      </a>

      <header
        className="border-b border-border bg-card"
        style={{ transition: "background-color 240ms ease, border-color 240ms ease" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/showcase" className="text-sm font-semibold tracking-tight transition-opacity hover:opacity-80">
            Heuresys / Brand Identity Showcase
          </Link>
          <nav aria-label="Showcase primary" className="flex items-center gap-3 text-sm">
            <Link href="/showcase/shell" className="hover:underline">Shell</Link>
            <Link href="/showcase/palettes" className="hover:underline">Palettes</Link>
            <Link href="/showcase/typography" className="hover:underline">Typography</Link>
            <Link href="/showcase/logo" className="hover:underline">Logo</Link>
            <span aria-hidden className="text-muted-foreground opacity-50">|</span>
            <PaletteDropdown />
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      <footer
        className="border-t border-border bg-card"
        style={{ transition: "background-color 240ms ease, border-color 240ms ease" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-muted-foreground">
          Showcase routes are gated by <code>NEXT_PUBLIC_ENABLE_SHOWCASE=1</code> in production
          builds. Decisions register:{" "}
          <code>D:\ux-design-shared\governance\DECISION_REGISTER.md</code>. Palette and theme persist
          in <code>localStorage</code> keys <code>heuresys-palette</code> + <code>heuresys-theme</code>.
        </div>
      </footer>
    </div>
  );
}
