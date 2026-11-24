"use client";

import { type ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "@heuresys/ui";
import { istanzaPerIlDisegno, type AppLocale } from "../lib/i18n";
import { suPermessoNegato } from "../lib/api/session-cache";
import { ME_INTERFACES_QUERY_KEY, ME_PERMISSIONS_QUERY_KEY } from "../lib/api/auth";
import { AttesaGlobale } from "../components/attesa-globale";

export function AppProviders({ children, lingua }: { children: ReactNode; lingua: AppLocale }) {
  // K33: sul server i testi si scrivono nella lingua del cookie letta dal layout radice, la
  // stessa da cui parte il browser; senza, il server scriveva italiano e il browser inglese (#418).
  const istanza = istanzaPerIlDisegno(lingua);
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

  // V-12: un 403 dall'API fa rileggere permessi e menu (i ruoli possono essere cambiati).
  useEffect(
    () =>
      suPermessoNegato(() => {
        void qc.invalidateQueries({ queryKey: ME_PERMISSIONS_QUERY_KEY });
        void qc.invalidateQueries({ queryKey: ME_INTERFACES_QUERY_KEY });
      }),
    [qc],
  );

  // ThemeProvider reads/writes `heuresys-theme` localStorage key — same key the
  // root layout boot script reads to set the initial <html class="dark"> at
  // first paint (no FOUC). Default "dark" matches the post-S924 brand default.
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={istanza}>
          <AttesaGlobale />
          {children}
        </I18nextProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
