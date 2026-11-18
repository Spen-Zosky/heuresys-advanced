/**
 * apps/api/src/modules/whistleblowing/custodia.ts — le tabelle sotto custodia assoluta.
 *
 * ADR-0036 §5: le segnalazioni le legge solo la custodia, nemmeno il mandato tecnico. Il nome di
 * queste tabelle vive solo in questo modulo (lo fa rispettare whistleblowing-isolation). Chi legge
 * il database in modo generale, come il Faldone dell'Utente che scopre le tabelle dal catalogo di
 * sistema, importa questo elenco per toglierle prima ancora di guardarle: non le maschera, non le
 * conta, non sa che esistono.
 */
export const TABELLE_CUSTODITE: readonly string[] = ["sys.sys_whistleblowing_reports"];
