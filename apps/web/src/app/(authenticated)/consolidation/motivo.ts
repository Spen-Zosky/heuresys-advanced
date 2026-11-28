import type { ConsolidationProposal } from "@heuresys/shared";

/**
 * Il motivo di una proposta nella lingua della pagina (difetto del 2026-11-28: la pagina inglese
 * mostrava il motivo in italiano). In inglese si usa la versione inglese; se la proposta non ce l'ha
 * ancora (salvata prima della colonna e non tradotta) si ripiega sull'italiano, l'unico testo che c'è.
 */
export function motivoNellaLingua(p: Pick<ConsolidationProposal, "reason" | "reasonEn">, lingua: string): string {
  return lingua.toLowerCase().startsWith("en") && p.reasonEn ? p.reasonEn : p.reason;
}
