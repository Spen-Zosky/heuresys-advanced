/**
 * Heuresys brand palettes — 5 candidates × 2 surface modes (light/dark).
 *
 * The accent (4-box) and semantic state colors are palette-locked: they look
 * the same in both modes. Surface tokens (background / foreground / card /
 * border / muted) flip per mode.
 *
 * `applyPalette()` writes each entry into CSS custom properties on `:root`
 * (or a target element). All consumer surfaces inherit via
 * `var(--background)`, `var(--palette-1)`, etc.
 *
 * Decision tie: UXIX-0005 (palette) is still Proposed; this module lets
 * Product Owner see all 5 candidates applied to the full app, not just on
 * the swatch grid in /showcase/palettes.
 */

export type PaletteId = "blue" | "slate" | "choco" | "cognac" | "onyx";
export type ThemeMode = "light" | "dark";

export type PaletteSurface = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
};

export type Palette = {
  id: PaletteId;
  name: string;
  shortLabel: string; // for the 4-box switcher cell
  thesis: string;
  surface: { light: PaletteSurface; dark: PaletteSurface };
  /** brand 4-box accent colors — palette-locked across themes */
  accent: { p1: string; p2: string; p3: string; p4: string };
  /** semantic icon colors — palette-locked */
  semantic: { info: string; success: string; warning: string; danger: string };
  /** logo wordmark body + accent colors when palette-adaptive logo is enabled */
  logo: { body: string; accent: string };
};

export const PALETTES: Record<PaletteId, Palette> = {
  blue: {
    id: "blue",
    name: "Blue Primary",
    shortLabel: "Blue",
    thesis: "Default. Historical Heuresys blue. Enterprise-trustworthy.",
    surface: {
      light: {
        background: "#FAFBFD",
        foreground: "#0F1828",
        card: "#FFFFFF",
        cardForeground: "#0F1828",
        muted: "#F1F4F9",
        mutedForeground: "#475569",
        border: "#E2E6EE",
      },
      dark: {
        background: "#0F1828",
        foreground: "#E5E7EB",
        card: "#1E293B",
        cardForeground: "#E5E7EB",
        muted: "#1E293B",
        mutedForeground: "#94A3B8",
        border: "#334155",
      },
    },
    accent: { p1: "#2563EB", p2: "#06B6D4", p3: "#7C3AED", p4: "#F59E0B" },
    semantic: { info: "#2563EB", success: "#16A34A", warning: "#F59E0B", danger: "#DC2626" },
    logo: { body: "#3B82F6", accent: "#A855F7" },
  },
  slate: {
    id: "slate",
    name: "Studio Slate",
    shortLabel: "Slate",
    thesis: "Editorial calm. Teal primary on slate neutrals.",
    surface: {
      light: {
        background: "#F7F8F7",
        foreground: "#111418",
        card: "#FFFFFF",
        cardForeground: "#111418",
        muted: "#EEF0EE",
        mutedForeground: "#4B5563",
        border: "#E1E4E3",
      },
      dark: {
        background: "#111418",
        foreground: "#E5E7EB",
        card: "#1F2937",
        cardForeground: "#E5E7EB",
        muted: "#1F2937",
        mutedForeground: "#9CA3AF",
        border: "#374151",
      },
    },
    accent: { p1: "#0F766E", p2: "#0891B2", p3: "#7C3F66", p4: "#CA8A04" },
    semantic: { info: "#0F766E", success: "#15803D", warning: "#CA8A04", danger: "#B91C1C" },
    logo: { body: "#0F766E", accent: "#7C3F66" },
  },
  choco: {
    id: "choco",
    name: "Choco & Coffee",
    shortLabel: "Choco",
    thesis: "Warm monochromatic. Espresso primary on cream.",
    surface: {
      light: {
        background: "#FAF6F1",
        foreground: "#2B1810",
        card: "#FFFFFF",
        cardForeground: "#2B1810",
        muted: "#F1EAE0",
        mutedForeground: "#6F4E37",
        border: "#E5DBD0",
      },
      dark: {
        background: "#1F1410",
        foreground: "#E5DBD0",
        card: "#2B1810",
        cardForeground: "#E5DBD0",
        muted: "#2B1810",
        mutedForeground: "#C8A982",
        border: "#3E2723",
      },
    },
    accent: { p1: "#3E2723", p2: "#8B5A2B", p3: "#6F4E37", p4: "#C8A982" },
    semantic: { info: "#5C3317", success: "#3F5E3F", warning: "#C68642", danger: "#7A2E2E" },
    logo: { body: "#3E2723", accent: "#8B5A2B" },
  },
  cognac: {
    id: "cognac",
    name: "Cognac & Oatmeal",
    shortLabel: "Cognac",
    thesis: "Heritage warmth. Cognac primary on oatmeal.",
    surface: {
      light: {
        background: "#F4EFE6",
        foreground: "#1F1B16",
        card: "#FFFFFF",
        cardForeground: "#1F1B16",
        muted: "#ECE5D5",
        mutedForeground: "#6B5F4D",
        border: "#DCD3C2",
      },
      dark: {
        background: "#1A1612",
        foreground: "#D9CFB9",
        card: "#2C2620",
        cardForeground: "#D9CFB9",
        muted: "#2C2620",
        mutedForeground: "#A89D85",
        border: "#3F352A",
      },
    },
    accent: { p1: "#A0522D", p2: "#8FA28E", p3: "#B7654E", p4: "#9C7A4A" },
    semantic: { info: "#5C7D74", success: "#5F7A5F", warning: "#C68642", danger: "#A4453C" },
    logo: { body: "#A0522D", accent: "#8FA28E" },
  },
  onyx: {
    id: "onyx",
    name: "Onyx & Champagne",
    shortLabel: "Onyx",
    thesis: "Luxury restraint. Onyx + single emerald accent on champagne.",
    surface: {
      light: {
        background: "#F7F2E7",
        foreground: "#14110F",
        card: "#FFFFFF",
        cardForeground: "#14110F",
        muted: "#EEE8D9",
        mutedForeground: "#5C544A",
        border: "#E5DCC6",
      },
      dark: {
        background: "#0F0E0C",
        foreground: "#E5DCC6",
        card: "#1F1B16",
        cardForeground: "#E5DCC6",
        muted: "#1F1B16",
        mutedForeground: "#A89D85",
        border: "#2D2820",
      },
    },
    accent: { p1: "#14110F", p2: "#0E5340", p3: "#5C1F2C", p4: "#8B6F47" },
    semantic: { info: "#1F4E64", success: "#0E5340", warning: "#A07C2F", danger: "#7A2E2E" },
    logo: { body: "#14110F", accent: "#0E5340" },
  },
};

export const PALETTE_LIST: Palette[] = Object.values(PALETTES);
export const DEFAULT_PALETTE: PaletteId = "blue";
export const DEFAULT_THEME: ThemeMode = "light";

/**
 * Apply a palette + theme mode by writing CSS variables to a target element
 * (defaults to document.documentElement / <html>). Consumers read via
 * `var(--background)`, `var(--palette-1)`, etc.
 */
export function applyPalette(
  paletteId: PaletteId,
  mode: ThemeMode,
  target: HTMLElement = document.documentElement,
): void {
  const palette = PALETTES[paletteId];
  if (!palette) return;
  const surface = palette.surface[mode];

  const cssVars: Record<string, string> = {
    "--background": surface.background,
    "--foreground": surface.foreground,
    "--card": surface.card,
    "--card-foreground": surface.cardForeground,
    "--muted": surface.muted,
    "--muted-foreground": surface.mutedForeground,
    "--border": surface.border,
    "--palette-1": palette.accent.p1,
    "--palette-2": palette.accent.p2,
    "--palette-3": palette.accent.p3,
    "--palette-4": palette.accent.p4,
    "--color-icon-info": palette.semantic.info,
    "--color-icon-success": palette.semantic.success,
    "--color-icon-warning": palette.semantic.warning,
    "--color-icon-danger": palette.semantic.danger,
    "--logo-body": palette.logo.body,
    "--logo-accent": palette.logo.accent,
    "--theme-mode": mode,
  };

  for (const [key, value] of Object.entries(cssVars)) {
    target.style.setProperty(key, value);
  }
  target.dataset["palette"] = paletteId;
  target.dataset["theme"] = mode;
  // Tailwind's `dark:` variants rely on a `.dark` class on <html>.
  if (mode === "dark") target.classList.add("dark");
  else target.classList.remove("dark");
}
