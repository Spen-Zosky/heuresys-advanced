/**
 * apps/api/src/lib/nome-persona-sql.ts — R1 del repertorio interfacce (Enzo, 10/11/2026):
 * una persona si scrive «Cognome, Nome», con l'ordine fatto dall'API.
 *
 * Lo stesso criterio di `cognomeNome()` del web (apps/web/src/lib/person-label.ts): «Cognome, Nome»
 * se la riga ha entrambi, solo il cognome o solo il nome se manca l'altro, il nome visibile come
 * ripiego (utenze di servizio senza anagrafica).
 */

/**
 * In TypeScript, per le risposte che non passano da una SELECT col nome (per esempio la scheda
 * di una persona, che parte da una riga gia' letta).
 */
export function cognomeNome(u: { displayName: string | null; firstName?: string | null; lastName?: string | null }): string | null {
  const cognome = u.lastName?.trim();
  const nome = u.firstName?.trim();
  if (cognome && nome) return `${cognome}, ${nome}`;
  if (cognome) return cognome;
  if (nome) return nome;
  return u.displayName;
}

/**
 * In SQL: l'espressione da mettere al posto di `u.user_display_name` in ogni SELECT che nomina
 * una persona. L'alias deve essere quello di una riga di `sys.sys_users` gia' filtrata sul tenant
 * della riga che la nomina (I5): questa funzione compone un testo, non filtra.
 */
export function cognomeNomeSql(alias: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`alias SQL non valido: ${alias}`);
  return `COALESCE(NULLIF(concat_ws(', ', NULLIF(trim(${alias}.user_last_name), ''), NULLIF(trim(${alias}.user_first_name), '')), ''), ${alias}.user_display_name)`;
}
