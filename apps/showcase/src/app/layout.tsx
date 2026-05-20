import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Heuresys — Brand Identity Showcase",
  description: "Design candidates and shell prototypes for brand identity v1.",
  robots: { index: false, follow: false },
};

// Brand default: dark theme on first paint (no FOUC). Boot script reads
// `heuresys-theme` localStorage and toggles class; defaults to "dark".
// Mirrors apps/web/src/app/layout.tsx pattern.
const themeBootScript = `(function(){try{var t=localStorage.getItem('heuresys-theme');var d=t?t==='dark':true;var c=document.documentElement.classList;d?c.add('dark'):c.remove('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
