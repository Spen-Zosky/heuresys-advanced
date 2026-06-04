"use client";

/**
 * apps/web/src/components/language-switcher.tsx
 *
 * Flips the active UI locale (IT/EN) via setLocale (i18next.changeLanguage + the
 * NEXT_LOCALE cookie) AND persists it server-side (sys_user_preferences, i18n Fase 0b)
 * so the choice follows the user cross-device. Client-only. The cookie covers same-device
 * reloads; the PATCH covers a fresh device (re-applied on next login by PreferencesApplier).
 * The server write is best-effort: if it fails (e.g. unauthenticated), the client locale
 * still flips. Renders a small IT/EN toggle.
 */

import { useTranslation } from "react-i18next";
import { Button } from "@heuresys/ui";
import { SUPPORTED_LOCALES, setLocale, type AppLocale } from "../lib/i18n";
import { useUpdateMyPreferences } from "../lib/api/auth";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("shell");
  const updatePrefs = useUpdateMyPreferences();
  const active = (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
    ? (i18n.language as AppLocale)
    : "it";

  return (
    <div
      data-testid="language-switcher"
      role="group"
      aria-label={t("language.label")}
      className="flex items-center gap-1"
    >
      {SUPPORTED_LOCALES.map((loc) => (
        <Button
          key={loc}
          type="button"
          size="sm"
          variant={active === loc ? "default" : "outline"}
          data-testid={`language-${loc}`}
          aria-pressed={active === loc}
          className="flex-1"
          onClick={() => {
            setLocale(loc);
            // Persist cross-device (server = source of truth); best-effort, errors are non-fatal.
            updatePrefs.mutate({ locale: loc });
          }}
        >
          {loc.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
