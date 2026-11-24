/**
 * apps/web/src/lib/attivita-processo.ts — quali colonne della scheda Attività di un processo del
 * tenant non portano niente (classe K24 del controllo forense del 23/11/2026).
 *
 * Le attività di RTL non hanno ancora ingresso, uscita, chi esegue, natura del lavoro, modalità e ore
 * per ciclo: sei colonne di soli «—» in ogni riga. Decisione di Enzo del 24/11/2026: una colonna vuota
 * in tutte le righe esce dalla tabella, e la pagina lo dice con una riga; una colonna con almeno un
 * valore resta. Si guarda il dato, non la cella disegnata.
 */
import type { TenantProcessActivity } from "@heuresys/shared";

/** Le colonne che possono uscire; numero, nome, sottoprocesso e unità restano sempre. */
export type ColonnaAttivita = "input" | "output" | "executor" | "nature" | "delivery" | "hours" | "apqc";

const testo = (x: string | null) => x !== null && x.trim() !== "";

const HA_VALORE: Record<ColonnaAttivita, (a: TenantProcessActivity) => boolean> = {
  input: (a) => testo(a.input),
  output: (a) => testo(a.output),
  executor: (a) => testo(a.executorName) || a.executorPositionId !== null,
  nature: (a) => testo(a.workNature),
  delivery: (a) => testo(a.deliveryModel),
  hours: (a) => a.typicalHoursPerCycle !== null,
  // la cella APQC mostra la voce anche quando il tipo è da dichiarare: è vuota solo senza voce
  apqc: (a) => testo(a.apqcCode),
};

/** Le colonne vuote in tutte le attività in vista; nessuna se non ci sono attività. */
export function colonneAttivitaVuote(attivita: readonly TenantProcessActivity[]): Set<ColonnaAttivita> {
  const vuote = new Set<ColonnaAttivita>();
  if (attivita.length === 0) return vuote;
  for (const c of Object.keys(HA_VALORE) as ColonnaAttivita[]) if (!attivita.some(HA_VALORE[c])) vuote.add(c);
  return vuote;
}
