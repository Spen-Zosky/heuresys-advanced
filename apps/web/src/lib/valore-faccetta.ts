/**
 * apps/web/src/lib/valore-faccetta.ts — il nome e la spiegazione di un valore di faccetta nella lingua
 * della pagina (classe N2 del giro di verifica del 25/11/2026).
 *
 * L'API dà ogni valore del vocabolario chiuso in italiano (`label`, `description`) e in inglese
 * (`labelEn`, `descriptionEn`), letti dalle colonne `_it` e `_en` di `sys.sys_process_facet_values`:
 * la pagina sceglie quello della sua lingua. Prima l'API leggeva solo l'italiano, e la pagina inglese
 * mostrava «Governo e indirizzo» invece di «Governance and direction».
 */
import { linguaDi } from "./testi";

export function nomeNellaLingua(v: { label: string; labelEn: string }, lingua: string | undefined): string {
  return linguaDi(lingua) === "en" ? v.labelEn : v.label;
}

export function spiegazioneNellaLingua(v: { description: string; descriptionEn: string }, lingua: string | undefined): string {
  return linguaDi(lingua) === "en" ? v.descriptionEn : v.description;
}
