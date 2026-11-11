/**
 * apps/web/src/lib/valori-leggibili.ts — il dizionario dei valori che arrivano dai dati in
 * inglese o in forma di macchina (classe C1 del piano docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Due livelli, nell'ordine:
 *   1. i valori enumerati del layer i18n (`common:enums.<dominio>.<VALORE>`): se un codice
 *      compare in un dominio, la sua etichetta vale ovunque compaia lo stesso codice;
 *   2. questo dizionario, per le frasi libere che i dati importati portano in inglese
 *      («Year-end adjustment», «Long term») e per i codici di stato che non hanno un dominio.
 *
 * Le chiavi sono confrontate senza maiuscole e con gli spazi normalizzati. Ogni voce nuova nasce
 * da un valore visto a video nel giro (§3 del piano), non da un elenco immaginato. La correzione
 * vera di una frase inglese nei dati è alla fonte (migrazione); il dizionario impedisce che un
 * valore non ancora corretto arrivi davanti a una persona.
 */

export const FRASI_IT: Record<string, string> = {
  /* stati generici */
  approved: "Approvato",
  rejected: "Respinto",
  pending: "In attesa",
  completed: "Completato",
  complete: "Completato",
  cancelled: "Annullato",
  canceled: "Annullato",
  draft: "Bozza",
  submitted: "Inviato",
  active: "Attivo",
  inactive: "Non attivo",
  archived: "Archiviato",
  open: "Aperto",
  closed: "Chiuso",
  in_progress: "In corso",
  "in progress": "In corso",
  not_started: "Non iniziato",
  "not started": "Non iniziato",
  done: "Fatto",
  failed: "Non riuscito",
  expired: "Scaduto",
  overdue: "In ritardo",
  on_track: "In linea",
  at_risk: "A rischio",
  off_track: "Fuori linea",
  scheduled: "Pianificato",
  planned: "Pianificato",
  ready: "Pronto",
  ready_now: "Pronto ora",
  yes: "Sì",
  no: "No",
  true: "Sì",
  false: "No",
  high: "Alto",
  medium: "Medio",
  low: "Basso",
  critical: "Critico",
  none: "Nessuno",
  other: "Altro",
  unknown: "Non noto",
  tenant: "Tenant",
  platform: "Piattaforma",
  /* orizzonti e periodi */
  "long term": "Lungo termine",
  "long-term": "Lungo termine",
  long_term: "Lungo termine",
  "short term": "Breve termine",
  "short-term": "Breve termine",
  short_term: "Breve termine",
  "medium term": "Medio termine",
  "mid term": "Medio termine",
  medium_term: "Medio termine",
  monthly: "Mensile",
  quarterly: "Trimestrale",
  yearly: "Annuale",
  annual: "Annuale",
  weekly: "Settimanale",
  daily: "Giornaliero",
  "semi-annual": "Semestrale",
  /* ferie e permessi: movimenti di saldo */
  "year-end adjustment": "Rettifica di fine anno",
  "carryover from previous year": "Riporto dall'anno precedente",
  "leave taken": "Assenza goduta",
  "monthly accrual": "Maturazione mensile",
  "annual accrual": "Maturazione annuale",
  accrual: "Maturazione",
  adjustment: "Rettifica",
  carryover: "Riporto",
  usage: "Utilizzo",
  leave_request: "Richiesta di assenza",
  "leave request": "Richiesta di assenza",
  manual: "Manuale",
  system: "Sistema",
  import: "Importazione",
  /* tipi di assenza (anche dentro «<tipo> Accrual Policy») */
  vacation: "Ferie",
  annual_leave: "Ferie",
  sick: "Malattia",
  sick_leave: "Malattia",
  bereavement: "Lutto",
  parental: "Congedo parentale",
  maternity: "Maternità",
  paternity: "Paternità",
  personal: "Permesso personale",
  unpaid: "Non retribuita",
  study: "Studio",
  marriage: "Matrimonio",
  rol: "ROL",
};

/** «bereavement Accrual Policy» → «Regola di maturazione: Lutto» */
export function frasiComposte(testo: string, voce: (k: string) => string | undefined): string | undefined {
  const m = /^(.+?)\s+accrual policy$/i.exec(testo.trim());
  if (m) {
    const tipo = voce(m[1]!) ?? m[1]!;
    return `Regola di maturazione: ${tipo}`;
  }
  return undefined;
}

/** Chiave di confronto: minuscole, spazi singoli. */
export function chiaveFrase(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
