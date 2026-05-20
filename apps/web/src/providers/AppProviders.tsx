"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "@heuresys/ui";
import { i18n } from "../lib/i18n";

export function AppProviders({ children }: { children: ReactNode }) {
  // One QueryClient per browser session; lazy-initialised so HMR / RSC don't
  // share a cache across server / client boundaries.
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 0,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  // ThemeProvider reads/writes `heuresys-theme` localStorage key — same key the
  // root layout boot script reads to set the initial <html class="dark"> at
  // first paint (no FOUC). Default "dark" matches the post-S924 brand default.
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
