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
