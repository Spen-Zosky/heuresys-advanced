"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  applyPalette,
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  PALETTES,
  type PaletteId,
  type ThemeMode,
} from "./palettes";

const PALETTE_STORAGE_KEY = "heuresys.brand.palette";
const THEME_STORAGE_KEY = "heuresys.brand.theme";

type PaletteContextValue = {
  paletteId: PaletteId;
  mode: ThemeMode;
  setPalette: (id: PaletteId) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

function readStored<T extends string>(key: string, fallback: T, valid: readonly T[]): T {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  return v && (valid as readonly string[]).includes(v) ? (v as T) : fallback;
}

const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];
const MODES: ThemeMode[] = ["light", "dark"];

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [paletteId, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once on client.
  useEffect(() => {
    const p = readStored<PaletteId>(PALETTE_STORAGE_KEY, DEFAULT_PALETTE, PALETTE_IDS);
    const m = readStored<ThemeMode>(THEME_STORAGE_KEY, DEFAULT_THEME, MODES);
    setPaletteState(p);
    setModeState(m);
    setHydrated(true);
  }, []);

  // Apply CSS variables whenever palette or mode changes (post-hydration).
  useEffect(() => {
    if (!hydrated) return;
    applyPalette(paletteId, mode);
  }, [paletteId, mode, hydrated]);

  const setPalette = useCallback((id: PaletteId) => {
    setPaletteState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(PALETTE_STORAGE_KEY, id);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    if (typeof window !== "undefined") window.localStorage.setItem(THEME_STORAGE_KEY, m);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "light" ? "dark" : "light");
  }, [mode, setMode]);

  return (
    <PaletteContext.Provider value={{ paletteId, mode, setPalette, setMode, toggleMode }}>
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette(): PaletteContextValue {
  const ctx = useContext(PaletteContext);
  if (!ctx) {
    throw new Error("usePalette must be used inside <PaletteProvider>");
  }
  return ctx;
}
