import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { codiceInParole } from "./enum-labels";

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
import landingIt from "../locales/it/landing.json";
import landingEn from "../locales/en/landing.json";
import investorsIt from "../locales/it/investors.json";
import investorsEn from "../locales/en/investors.json";
import demoIt from "../locales/it/demo.json";
import demoEn from "../locales/en/demo.json";

export const SUPPORTED_LOCALES = ["it", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
/** Italian is the default + the complete source locale; EN falls back to IT. */
export const DEFAULT_LOCALE: AppLocale = "it";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** One namespace per app area (separate locale files → parallel extraction, no conflicts). */
export const NAMESPACES = ["common", "shell", "analytics", "admin", "blueprints", "hr", "ess", "landing", "investors", "demo"] as const;

const resources = {
  it: {
    common: commonIt,
    shell: shellIt,
    analytics: analyticsIt,
    admin: adminIt,
    blueprints: blueprintsIt,
    hr: hrIt,
    ess: essIt,
    landing: landingIt,
    investors: investorsIt,
    demo: demoIt,
  },
  en: {
    common: commonEn,
    shell: shellEn,
    analytics: analyticsEn,
    admin: adminEn,
    blueprints: blueprintsEn,
    hr: hrEn,
    ess: essEn,
    landing: landingEn,
    investors: investorsEn,
    demo: demoEn,
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

/**
 * C4 (piano interfaccia-sistematica): un numero dentro una frase tradotta («campione di 1652»,
 * «1–25 di 14031») si scrive con i separatori della lingua. Nessuna chiave usa specificatori di
 * formato, quindi il formattatore guarda solo il valore: un numero finito si scrive nella forma
 * della lingua; codici, versioni, identificativi e telefoni restano com'erano.
 */
const CHIAVI_GREZZE = new Set(["version", "code", "codice", "id", "requestId", "phone", "year", "anno"]);
const CODICE_DI_LAVORO = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
/** C1: un codice di lavoro dentro una frase («Ruoli: BRANCH_MANAGER, TEAM_LEADER», «Ambito
 *  TENANT») si scrive con la sua etichetta: prima il nome del ruolo, poi i valori enumerati,
 *  infine il codice in parole. */
function vocePerCodice(c: string, lng: string, chiave?: string): string {
  if (!CODICE_DI_LAVORO.test(c) && !/^[A-Z]{4,}$/.test(c)) return c;
  const ruolo = i18next.getResource(lng, "shell", `roles.${c}`) as unknown;
  if (typeof ruolo === "string") return ruolo;
  const enums = (i18next.getResource(lng, "common", "enums") ?? {}) as Record<string, Record<string, string>>;
  // «Ambito {{kind}}»: il genere di perimetro ha il suo dominio, prima degli altri
  if (chiave === "kind" && typeof enums.scopeKind?.[c] === "string") return enums.scopeKind[c];
  for (const dominio of Object.values(enums)) if (typeof dominio?.[c] === "string") return dominio[c];
  return CODICE_DI_LAVORO.test(c) ? codiceInParole(c) : c;
}

/** C1: un testo che arriva già composto dal servizio («ACTIVE · settore Banche», «HIRE · 01/10/2026»)
 *  si legge con le etichette al posto dei codici di lavoro che contiene. */
export function testoLeggibile(v: string, lng: string = i18next.language): string {
  const enums = (i18next.getResource(lng, "common", "enums") ?? {}) as Record<string, Record<string, string>>;
  return v
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b[A-Z]{4,}\b/g, (c) => vocePerCodice(c, lng))
    // un codice minuscolo («salary_recalculation:») si scrive solo se un dominio lo conosce
    .replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (c) => {
      for (const dominio of Object.values(enums)) if (typeof dominio?.[c] === "string") return dominio[c];
      return c;
    });
}

function codiceNellaFrase(v: string, lng: string, chiave?: string): string {
  const voce = (c: string): string => vocePerCodice(c, lng, chiave);
  return v.includes(", ") ? v.split(", ").map(voce).join(", ") : voce(v);
}

export function numeroNellaFrase(value: unknown, lng: string | undefined, chiave: string | undefined): unknown {
  if (chiave && CHIAVI_GREZZE.has(chiave)) return value;
  if (typeof value === "string") return codiceNellaFrase(value, lng ?? DEFAULT_LOCALE, chiave);
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return new Intl.NumberFormat(lng === "en" ? "en-GB" : "it-IT", { useGrouping: "always", maximumFractionDigits: 2 } as unknown as Intl.NumberFormatOptions).format(value);
}
const formattatore = {
  type: "formatter" as const,
  init() {},
  add() {},
  addCached() {},
  format(value: unknown, _format: string | undefined, lng: string | undefined, options?: { interpolationkey?: string }) {
    return numeroNellaFrase(value, lng, options?.interpolationkey);
  },
};

// Single i18next instance shared by SSR and client.
if (!i18next.isInitialized) {
  void i18next
    .use(initReactI18next)
    .use(formattatore)
    .init({
      resources,
      lng: detectLocale(),
      fallbackLng: DEFAULT_LOCALE,
      ns: [...NAMESPACES],
      defaultNS: "common",
      interpolation: { escapeValue: false, alwaysFormat: true },
    });
}

/** Change the active locale + persist it in the NEXT_LOCALE cookie (1-year, lax). */
export function setLocale(locale: AppLocale): void {
  void i18next.changeLanguage(locale);
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    // WCAG 3.1.1: keep <html lang> in sync immediately on a client-side locale switch
    // (the SSR value is set from the cookie in the root layout on the next request).
    document.documentElement.lang = locale;
  }
}

export const i18n = i18next;
