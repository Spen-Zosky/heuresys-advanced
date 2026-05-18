import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";

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
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/showcase" className="text-sm font-semibold tracking-tight">
            Heuresys / Brand Identity Showcase
          </Link>
          <nav aria-label="Showcase navigation" className="flex items-center gap-3 text-sm">
            <Link href="/showcase/shell" className="hover:underline">Shell</Link>
            <Link href="/showcase/palettes" className="hover:underline">Palettes</Link>
            <Link href="/showcase/typography" className="hover:underline">Typography</Link>
            <Link href="/showcase/logo" className="hover:underline">Logo</Link>
            <span aria-hidden className="text-neutral-300">|</span>
            <span className="text-neutral-500">v1 · in review</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-neutral-500">
          Showcase routes are gated by <code>NEXT_PUBLIC_ENABLE_SHOWCASE=1</code> in production builds.
          Decision register: <code>D:\ux-design-shared\governance\DECISION_REGISTER.md</code>.
        </div>
      </footer>
    </div>
  );
}
