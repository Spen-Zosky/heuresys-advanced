/**
 * apps/web/src/lib/testi.ts — i testi dei moduli che non sono componenti (glossario, lettura dei
 * grafici, risposte dell'assistente alla pagina).
 *
 * Questi moduli sono funzioni pure, provate senza browser e chiamate anche fuori da un componente:
 * non hanno l'hook `useTranslation`. Leggono lo stesso dizionario di tutto il prodotto
 * (`locales/<lingua>/common.json`, con parità it/en controllata da `pnpm i18n:check`), scegliendo la
 * lingua dal parametro. Forense frontend 15/11/2026, S-06: prima erano frasi italiane scritte nel codice.
 */
import commonIt from "../locales/it/common.json";
import commonEn from "../locales/en/common.json";

type Nodo = { [k: string]: Nodo | string };

const DIZIONARI: Record<"it" | "en", Nodo> = { it: commonIt as unknown as Nodo, en: commonEn as unknown as Nodo };

/** «it», «en-GB», «it-IT» → la lingua del dizionario; ogni altra cosa ricade sull'italiano. */
export function linguaDi(lingua: string | undefined): "it" | "en" {
  return (lingua ?? "it").toLowerCase().startsWith("en") ? "en" : "it";
}

/** Il sottoalbero del dizionario (per esempio `glossario.concetti`) nella lingua data. */
export function ramo(lingua: string | undefined, percorso: string): Nodo | undefined {
  let n: Nodo | string | undefined = DIZIONARI[linguaDi(lingua)];
  for (const k of percorso.split(".")) {
    if (n === undefined || typeof n === "string") return undefined;
    n = n[k];
  }
  return typeof n === "object" ? n : undefined;
}

/** Un testo del dizionario con i segnaposto `{{nome}}` sostituiti; la chiave se non esiste. */
export function testo(lingua: string | undefined, chiave: string, parametri?: Record<string, string | number>): string {
  const cerca = (l: "it" | "en") => {
    let n: Nodo | string | undefined = DIZIONARI[l];
    for (const k of chiave.split(".")) {
      if (n === undefined || typeof n === "string") return undefined;
      n = n[k];
    }
    return typeof n === "string" ? n : undefined;
  };
  const grezzo = cerca(linguaDi(lingua)) ?? cerca("it") ?? chiave;
  return grezzo.replace(/\{\{(\w+)\}\}/g, (_m, nome: string) => String(parametri?.[nome] ?? ""));
}
