/**
 * packages/shared/src/schemas/me-preferences.ts
 *
 * WS-4 P1 — per-user UI preferences (theme + locale), server = source of truth
 * (RBAC_UIX_PERSPECTIVES_PLAN locked decision 3c). Self-scoped at the route level
 * (GET/PATCH /v1/me/preferences); no :userId in any URL.
 *
 * - theme   : 'dark' | 'light'  (default 'dark')
 * - palette : RIMOSSA (24/11/2026, decisione di Enzo): resta solo la tavolozza standard del design
 *             system. La colonna `user_preference_palette` esiste ancora nel DB (NOT NULL DEFAULT 'balanced')
 *             ma nessuno la legge né la scrive.
 * - locale  : 'it' | 'en'  (default 'it')  — the UI language (i18n milestone Fase 0b). Kept in sync
 *               with the NEXT_LOCALE cookie by the web LanguageSwitcher; server = source of truth.
 */
import { z } from "zod";

export const ME_THEMES = ["dark", "light"] as const;
export const MeThemeSchema = z.enum(ME_THEMES);
export type MeTheme = z.infer<typeof MeThemeSchema>;

/** UI locale slugs — must match SUPPORTED_LOCALES in apps/web/src/lib/i18n.ts (IT default). */
export const ME_LOCALES = ["it", "en"] as const;
export const MeLocaleSchema = z.enum(ME_LOCALES);
export type MeLocale = z.infer<typeof MeLocaleSchema>;

/** Gli id dei gruppi della barra laterale nell'ordine scelto (il registro ne dichiara una dozzina). */
export const SidebarOrderSchema = z.array(z.string().min(1).max(64)).max(40);

export const ME_PREFERENCE_DEFAULTS = {
  theme: "dark",
  locale: "it",
} as const satisfies { theme: MeTheme; locale: MeLocale };

/** GET /v1/me/preferences — the caller's own UI preferences (defaults if no row exists yet). */
export const UserPreferenceSchema = z.object({
  theme: MeThemeSchema,
  locale: MeLocaleSchema,
  /** Ordine dei gruppi della barra laterale scelto dalla persona; `null` = ordine standard. */
  sidebarOrder: SidebarOrderSchema.nullable(),
});
export type UserPreference = z.infer<typeof UserPreferenceSchema>;

/** PATCH /v1/me/preferences — partial update; at least one field must be present. */
export const UpdateUserPreferenceBodySchema = z
  .object({
    theme: MeThemeSchema.optional(),
    locale: MeLocaleSchema.optional(),
    /** `null` = «Ripristina ordine standard». */
    sidebarOrder: SidebarOrderSchema.nullable().optional(),
  })
  .refine((b) => b.theme !== undefined || b.locale !== undefined || b.sidebarOrder !== undefined, {
    error: "At least one of theme / locale / sidebarOrder required",
  });
export type UpdateUserPreferenceBody = z.infer<typeof UpdateUserPreferenceBodySchema>;
