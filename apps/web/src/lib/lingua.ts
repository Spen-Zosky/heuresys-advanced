/**
 * apps/web/src/lib/lingua.ts — la lingua del primo disegno, una regola sola per server e browser.
 *
 * K33 (giro forense del 23/11/2026, errore React #418): il layout radice leggeva il cookie
 * NEXT_LOCALE per `<html lang>`, ma i testi il server li scriveva sempre in italiano, perché
 * l'istanza di i18next sul server non vede `document.cookie`; il browser invece partiva dalla
 * lingua del cookie. Con il cookie a «en» il testo del server e quello del primo disegno nel
 * browser erano diversi, e React lo segnalava con #418 (argomento «text»).
 *
 * Questo modulo non importa niente: lo usano il layout radice, che è un componente del server,
 * e `lib/i18n.ts`, così le due parti risolvono la stessa lingua dallo stesso valore.
 */

export const LINGUE = ["it", "en"] as const;
export type Lingua = (typeof LINGUE)[number];
export const LINGUA_PREDEFINITA: Lingua = "it";
export const COOKIE_LINGUA = "NEXT_LOCALE";

export function eLingua(v: string | undefined | null): v is Lingua {
  return v === "it" || v === "en";
}

/** Cookie NEXT_LOCALE, poi NEXT_PUBLIC_DEFAULT_LOCALE, poi l'italiano. */
export function linguaDa(valoreCookie: string | undefined | null): Lingua {
  if (eLingua(valoreCookie)) return valoreCookie;
  const daAmbiente = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_DEFAULT_LOCALE : undefined;
  return eLingua(daAmbiente) ? daAmbiente : LINGUA_PREDEFINITA;
}
