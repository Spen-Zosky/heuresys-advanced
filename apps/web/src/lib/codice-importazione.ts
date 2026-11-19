/**
 * C5 del giro qa-web 18/11/2026: alcune righe portano come codice la chiave con cui sono
 * state importate («ESCO::<uuid>», «OLDDB::competency_frameworks::<uuid>», «LEGACY_BP::<uuid>»).
 * Non è un codice da leggere: si mostra solo quando è un codice vero.
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function eCodiceDiImportazione(codice: string | null | undefined): boolean {
  if (!codice) return false;
  return codice.includes("::") || UUID.test(codice);
}

/** Il codice se è leggibile, altrimenti `null` (la cella mostra un trattino). */
export function codiceLeggibile(codice: string | null | undefined): string | null {
  if (!codice) return null;
  return eCodiceDiImportazione(codice) ? null : codice;
}
