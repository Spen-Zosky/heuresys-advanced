"use client";

/**
 * apps/web/src/components/language-switcher.tsx
 *
 * Flips the active UI locale (IT/EN) via setLocale (i18next.changeLanguage + the
 * NEXT_LOCALE cookie). Client-only. The cookie makes the choice survive reloads;
 * cross-device persistence (sys_user_preferences) is wired in Fase 0b via
 * PreferencesApplier. Renders a small IT/EN toggle.
 */

import { useTranslation } from "react-i18next";
import { Button } from "@heuresys/ui";
import { SUPPORTED_LOCALES, setLocale, type AppLocale } from "../lib/i18n";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("shell");
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
          onClick={() => setLocale(loc)}
        >
          {loc.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
