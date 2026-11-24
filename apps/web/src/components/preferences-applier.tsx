"use client";

/**
 * apps/web/src/components/preferences-applier.tsx
 *
 * WS-4 P1 — applies the caller's SERVER-stored UI preferences (theme + palette) on every
 * authenticated session, including a fresh device with no localStorage. The server is the
 * source of truth (GET /v1/me/preferences); localStorage is only a cache that the @heuresys/ui
 * ThemeProvider / PaletteDropdown read for first-paint — we keep it in sync so the no-FOUC boot
 * script in the root layout honors the server choice on the next load too.
 *
 * Renders nothing. Mounted inside the authenticated layout so it runs once the session is known.
 */

import { useEffect } from "react";
import { useTheme } from "@heuresys/ui";
import { useMyPreferences } from "../lib/api/auth";
import { setLocale, i18n } from "../lib/i18n";
import {
  applicaTavolozzaDellaPersona,
  dimenticaCopiaTavolozza,
  ripristinaTavolozzaStandard,
} from "../lib/tavolozza";

/** Chiave della copia del tema nel localStorage, letta da ThemeProvider al primo disegno. */
const THEME_CACHE_KEY = "heuresys-theme";

export function PreferencesApplier() {
  const prefs = useMyPreferences();
  const { setTheme } = useTheme();
  const theme = prefs.data?.theme;
  const palette = prefs.data?.palette;
  const locale = prefs.data?.locale;

  useEffect(() => {
    if (!theme) return;
    // Theme: drive the provider (sets <html class> + writes the localStorage cache itself).
    setTheme(theme);
  }, [theme, setTheme]);

  // Tavolozza: scelta della sola persona, letta dal server. Chi non ha scelto (o ha «Equilibrata»)
  // non porta variabili in linea: vale la tavolozza standard di @heuresys/ui. All'uscita della
  // persona (smontaggio) si torna alla standard, e la copia nel localStorage condiviso si toglie.
  useEffect(() => {
    dimenticaCopiaTavolozza();
    applicaTavolozzaDellaPersona(palette);
    return () => ripristinaTavolozzaStandard();
  }, [palette]);

  // Belt-and-suspenders: ensure the theme cache key matches the server choice even if the
  // provider's own write is skipped (e.g. same-value setTheme no-op on a stale cached key).
  useEffect(() => {
    if (!theme) return;
    try {
      window.localStorage.setItem(THEME_CACHE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Locale (i18n Fase 0b): align the active UI language to the server choice on every session,
  // including a fresh device where the NEXT_LOCALE cookie is absent (first-paint defaults to IT,
  // then this re-applies the stored language). setLocale also rewrites the cookie so the next
  // first-paint already honors it. Behavior-preserving for the common case (cookie == server).
  useEffect(() => {
    if (!locale) return;
    if (i18n.language !== locale) setLocale(locale);
  }, [locale]);

  return null;
}
