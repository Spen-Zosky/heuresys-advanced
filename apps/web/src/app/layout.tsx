import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppProviders } from "../providers/AppProviders";
import { COOKIE_LINGUA, linguaDa } from "../lib/lingua";

export const metadata: Metadata = {
  title: "Heuresys",
  description: "HRMS / BPM platform — admin console + employee self-service",
};

/**
 * Brand default rules (apply project-wide):
 *   - Tema di default = dark  → <html class="dark"> at first paint (no FOUC)
 *   - Palette di default = balanced (idx 0) → applied by PaletteDropdown on
 *     first load when no `heuresys-palette` value is in localStorage.
 *   - Logo SEMPRE quello → HeuresysWordmark uses hardcoded canonical colors
 *     (see ux-design-shared/ui/src/components/wordmark.tsx).
 *
 * Hydration script reads localStorage `heuresys-theme` to honor user override
 * (light/dark) but defaults to "dark" on first visit.
 */
const themeBootScript = `(function(){try{var t=localStorage.getItem('heuresys-theme');var d=t?t==='dark':true;var c=document.documentElement.classList;d?c.add('dark'):c.remove('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // WCAG 3.1.1 (Language of Page): the document <html lang> MUST match the rendered
  // content language. The platform is bilingual (IT default + EN, i18n S965) — read the
  // NEXT_LOCALE cookie server-side so the lang is correct from the first byte (SSR), not
  // only after client JS runs. LanguageSwitcher.setLocale syncs document.lang immediately.
  // K33: la stessa lingua va ai testi (AppProviders), non solo a <html lang>, con la stessa regola
  // del browser (lib/lingua.ts): altrimenti il server scrive italiano e il browser inglese (#418).
  const lang = linguaDa((await cookies()).get(COOKIE_LINGUA)?.value);
  return (
    <html lang={lang} className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <AppProviders lingua={lang}>{children}</AppProviders>
      </body>
    </html>
  );
}
