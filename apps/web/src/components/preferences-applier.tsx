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
import { useTheme, applyPalette, type PaletteIdx } from "@heuresys/ui";
import type { MePalette } from "@heuresys/shared";
import { useMyPreferences } from "../lib/api/auth";

/** localStorage cache keys read by @heuresys/ui (ThemeProvider + PaletteDropdown) at first paint. */
const THEME_CACHE_KEY = "heuresys-theme";
const PALETTE_CACHE_KEY = "heuresys-palette";

/** Palette slug → @heuresys/ui PALETTES index (declaration order, 1:1 with the API CHECK set). */
const PALETTE_IDX: Record<MePalette, PaletteIdx> = {
  balanced: 0,
  "cool-ocean": 1,
  "warm-sunset": 2,
  "brand-mono": 3,
};

export function PreferencesApplier() {
  const prefs = useMyPreferences();
  const { setTheme } = useTheme();
  const theme = prefs.data?.theme;
  const palette = prefs.data?.palette;

  useEffect(() => {
    if (!theme) return;
    // Theme: drive the provider (sets <html class> + writes the localStorage cache itself).
    setTheme(theme);
  }, [theme, setTheme]);

  useEffect(() => {
    if (!palette) return;
    const idx = PALETTE_IDX[palette];
    // Palette: apply the inline --palette-* vars now + cache the index for the next first-paint.
    applyPalette(idx);
    try {
      window.localStorage.setItem(PALETTE_CACHE_KEY, String(idx));
    } catch {
      /* localStorage unavailable (private mode / SSR guard) — server stays the source of truth. */
    }
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

  return null;
}
