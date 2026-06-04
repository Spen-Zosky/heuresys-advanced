import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import commonIt from "../locales/it/common.json";
import commonEn from "../locales/en/common.json";
import shellIt from "../locales/it/shell.json";
import shellEn from "../locales/en/shell.json";
import analyticsIt from "../locales/it/analytics.json";
import analyticsEn from "../locales/en/analytics.json";
import adminIt from "../locales/it/admin.json";
import adminEn from "../locales/en/admin.json";
import blueprintsIt from "../locales/it/blueprints.json";
import blueprintsEn from "../locales/en/blueprints.json";
import hrIt from "../locales/it/hr.json";
import hrEn from "../locales/en/hr.json";
import essIt from "../locales/it/ess.json";
import essEn from "../locales/en/ess.json";

export const SUPPORTED_LOCALES = ["it", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
/** Italian is the default + the complete source locale; EN falls back to IT. */
export const DEFAULT_LOCALE: AppLocale = "it";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** One namespace per app area (separate locale files → parallel extraction, no conflicts). */
export const NAMESPACES = ["common", "shell", "analytics", "admin", "blueprints", "hr", "ess"] as const;

const resources = {
  it: {
    common: commonIt,
    shell: shellIt,
    analytics: analyticsIt,
    admin: adminIt,
    blueprints: blueprintsIt,
    hr: hrIt,
    ess: essIt,
  },
  en: {
    common: commonEn,
    shell: shellEn,
    analytics: analyticsEn,
    admin: adminEn,
    blueprints: blueprintsEn,
    hr: hrEn,
    ess: essEn,
  },
} as const;

function isLocale(v: string | undefined): v is AppLocale {
  return v === "it" || v === "en";
}

/** Resolve the active locale: NEXT_LOCALE cookie → NEXT_PUBLIC_DEFAULT_LOCALE env → IT. */
function detectLocale(): AppLocale {
  if (typeof document !== "undefined") {
    const m = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=(it|en)\b/);
    const fromCookie = m?.[1];
    if (isLocale(fromCookie)) return fromCookie;
  }
  const fromEnv = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_DEFAULT_LOCALE : undefined;
  return isLocale(fromEnv) ? fromEnv : DEFAULT_LOCALE;
}

// Single i18next instance shared by SSR and client.
if (!i18next.isInitialized) {
  void i18next
    .use(initReactI18next)
    .init({
      resources,
      lng: detectLocale(),
      fallbackLng: DEFAULT_LOCALE,
      ns: [...NAMESPACES],
      defaultNS: "common",
      interpolation: { escapeValue: false },
    });
}

/** Change the active locale + persist it in the NEXT_LOCALE cookie (1-year, lax). */
export function setLocale(locale: AppLocale): void {
  void i18next.changeLanguage(locale);
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }
}

export const i18n = i18next;
