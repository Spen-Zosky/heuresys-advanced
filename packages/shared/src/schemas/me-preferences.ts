/**
 * packages/shared/src/schemas/me-preferences.ts
 *
 * WS-4 P1 — per-user UI preferences (theme + palette), server = source of truth
 * (RBAC_UIX_PERSPECTIVES_PLAN locked decision 3c). Self-scoped at the route level
 * (GET/PATCH /v1/me/preferences); no :userId in any URL.
 *
 * - theme   : 'dark' | 'light'  (default 'dark')
 * - palette : one of the 4 @heuresys/ui palette slugs that map 1:1 to PaletteIdx 0|1|2|3:
 *               balanced (PALETTES[0], default) / cool-ocean (1) / warm-sunset (2) / brand-mono (3).
 * - locale  : 'it' | 'en'  (default 'it')  — the UI language (i18n milestone Fase 0b). Kept in sync
 *               with the NEXT_LOCALE cookie by the web LanguageSwitcher; server = source of truth.
 */
import { z } from "zod";

export const ME_THEMES = ["dark", "light"] as const;
export const MeThemeSchema = z.enum(ME_THEMES);
export type MeTheme = z.infer<typeof MeThemeSchema>;

/** Palette slugs — kept 1:1 with @heuresys/ui PALETTES indices (idx in declaration order). */
export const ME_PALETTES = ["balanced", "cool-ocean", "warm-sunset", "brand-mono"] as const;
export const MePaletteSchema = z.enum(ME_PALETTES);
export type MePalette = z.infer<typeof MePaletteSchema>;

/** UI locale slugs — must match SUPPORTED_LOCALES in apps/web/src/lib/i18n.ts (IT default). */
export const ME_LOCALES = ["it", "en"] as const;
export const MeLocaleSchema = z.enum(ME_LOCALES);
export type MeLocale = z.infer<typeof MeLocaleSchema>;

export const ME_PREFERENCE_DEFAULTS = {
  theme: "dark",
  palette: "balanced",
  locale: "it",
} as const satisfies { theme: MeTheme; palette: MePalette; locale: MeLocale };

/** GET /v1/me/preferences — the caller's own UI preferences (defaults if no row exists yet). */
export const UserPreferenceSchema = z.object({
  theme: MeThemeSchema,
  palette: MePaletteSchema,
  locale: MeLocaleSchema,
});
export type UserPreference = z.infer<typeof UserPreferenceSchema>;

/** PATCH /v1/me/preferences — partial update; at least one field must be present. */
export const UpdateUserPreferenceBodySchema = z
  .object({
    theme: MeThemeSchema.optional(),
    palette: MePaletteSchema.optional(),
    locale: MeLocaleSchema.optional(),
  })
  .refine((b) => b.theme !== undefined || b.palette !== undefined || b.locale !== undefined, {
    message: "At least one of theme / palette / locale required",
  });
export type UpdateUserPreferenceBody = z.infer<typeof UpdateUserPreferenceBodySchema>;
