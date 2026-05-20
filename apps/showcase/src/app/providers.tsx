"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@heuresys/ui";

/**
 * apps/showcase Providers — minimal client wrapper.
 *
 * Wraps the static-export tree with the shared `<ThemeProvider>` from
 * `@heuresys/ui` so that `ThemeToggle` (and any other consumer of
 * `useTheme()`) works during prerender + at runtime. Mirrors the
 * AppProviders pattern in apps/web; apps/showcase has no QueryClient or i18n
 * because the static export is purely presentational.
 *
 * `defaultTheme="dark"` matches the post-S924 brand default and the root
 * layout's `<html class="dark">` first-paint state.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>;
}
