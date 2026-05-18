import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { PaletteProvider } from "../../lib/theme/PaletteProvider";
import { PaletteSwitcher } from "../../lib/theme/PaletteSwitcher";
import { ThemeToggle } from "../../lib/theme/ThemeToggle";

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
    <PaletteProvider>
      <div
        className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"
        style={{ transition: "background-color 240ms ease, color 240ms ease" }}
      >
        <header className="border-b border-[var(--border)] bg-[var(--card)]"
          style={{ transition: "background-color 240ms ease, border-color 240ms ease" }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
            <Link href="/showcase" className="text-sm font-semibold tracking-tight transition-opacity hover:opacity-80">
              Heuresys / Brand Identity Showcase
            </Link>
            <nav aria-label="Showcase primary" className="flex items-center gap-3 text-sm">
              <Link href="/showcase/shell" className="hover:underline">Shell</Link>
              <Link href="/showcase/palettes" className="hover:underline">Palettes</Link>
              <Link href="/showcase/typography" className="hover:underline">Typography</Link>
              <Link href="/showcase/logo" className="hover:underline">Logo</Link>
              <span aria-hidden className="text-[var(--muted-foreground)] opacity-50">|</span>
              <PaletteSwitcher />
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="border-t border-[var(--border)] bg-[var(--card)]"
          style={{ transition: "background-color 240ms ease, border-color 240ms ease" }}>
          <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-[var(--muted-foreground)]">
            Showcase routes are gated by <code>NEXT_PUBLIC_ENABLE_SHOWCASE=1</code> in production builds.
            Decisions register: <code>D:\ux-design-shared\governance\DECISION_REGISTER.md</code>. Palette
            and theme persist in <code>localStorage</code>.
          </div>
        </footer>
      </div>
    </PaletteProvider>
  );
}
