/**
 * Le persone, non le utenze tecniche (forense frontend 2026-11-15, D1/D2).
 *
 * Le utenze di servizio (`user_type = 'SERVICE'`: agenti, collaudo) non sono persone dell'organico:
 * ogni conteggio di persone, ogni elenco «ultime persone» e ogni calcolo che valuta persone le
 * lascia fuori. UN punto solo, usato da analytics, dashboard e insights, cosi' la regola non si
 * riscrive (e non si dimentica) in ogni repository.
 */

/** Predicato SQL: l'alias passato e' una riga di `sys.sys_users`. */
export function soloPersone(alias = "u"): string {
  return `${alias}.user_type IS DISTINCT FROM 'SERVICE'`;
}

/**
 * Predicato SQL: l'alias è una persona IN FORZA oggi, cioè una persona (non un'utenza tecnica)
 * che non è uscita dall'organizzazione. Un ex dipendente resta nel tenant con la sua storia, ma
 * non si conta nell'organico di oggi né riceve punteggi su ciò che farà (F3c, 2026-11-26: prima
 * di questo punto la piattaforma dava per scontato che nessuno uscisse mai). Uscito vuol dire
 * utenza disattivata o rapporto di lavoro con la data di cessazione arrivata.
 *
 * Per la storia (eventi passati, assunzioni del mese, chi ha lasciato il perimetro) si usa
 * `soloPersone`, che gli ex dipendenti li tiene.
 */
export function personaInForza(alias = "u"): string {
  return `(${soloPersone(alias)}
           AND ${alias}.user_status IS DISTINCT FROM 'DEACTIVATED'
           AND NOT EXISTS (SELECT 1 FROM sys.sys_user_employment ue_inforza
                            WHERE ue_inforza.user_employment_user_id = ${alias}.user_id
                              AND ue_inforza.user_employment_termination_date <= current_date))`;
}
