/**
 * apps/web/src/lib/role-precedence.ts — quale ruolo RAPPRESENTA una persona.
 *
 * Perche' esiste. Ogni utente ha piu' ruoli: l'invariante I17 garantisce a
 * chiunque almeno `USER`, e i ruoli funzionali e gerarchici si sommano. Chi
 * doveva mostrarne UNO — il badge dell'intestazione, il piede di pagina —
 * prendeva `roles[0]`, cioe' il primo che capitava dall'API. Risultato
 * osservato nella dimostrazione del C12: `federica.marchetti` ha
 * `{USER, TEAM_LEADER, TENANT_ADMIN, CEO}` e l'intestazione la presentava come
 * **«Dipendente»** — mentre la stessa pagina, nel titolo, diceva
 * «Ambito TENANT · Amministratore tenant». Due verita' diverse nella stessa
 * schermata.
 *
 * La precedenza qui sotto risponde alla domanda «con che cappello questa
 * persona sta usando la piattaforma»: prima l'ampiezza amministrativa (chi
 * governa la piattaforma, poi il tenant, poi un dominio), poi i ruoli
 * gerarchici e operativi. Non e' una gerarchia di potere sulle persone: per
 * l'autorizzazione valgono RBAC e i due assi di ADR-0027, non questa lista.
 *
 * Un ruolo non elencato non e' un errore: finisce in coda in ordine alfabetico,
 * cosi' un ruolo nuovo si vede comunque invece di sparire.
 */

/** Dal piu' rappresentativo al meno. Vedi il commento sopra per il criterio. */
export const ROLE_PRECEDENCE: readonly string[] = [
  "PLATFORM_ADMIN",
  "TENANT_ADMIN",
  "HRMS_MANAGER",
  "BLUEPRINT_MANAGER",
  "PROCESS_OWNER",
  "ORG_DIRECTOR",
  "WHISTLEBLOWING_CUSTODIAN",
  "CEO",
  "MANAGER",
  "TEAM_LEADER",
  "TEAM_MEMBER",
  "USER",
  "READ_ONLY",
] as const;

/**
 * Il ruolo da mostrare per una persona che ne ha piu' d'uno.
 * Ritorna `USER` se l'elenco e' vuoto (I17: nessuno e' senza ruolo).
 */
export function primaryRoleOf(roles: readonly string[] | undefined): string {
  if (!roles || roles.length === 0) return "USER";
  const noti = ROLE_PRECEDENCE.filter((r) => roles.includes(r));
  if (noti.length > 0) return noti[0]!;
  return [...roles].sort()[0]!;
}

/** Ordina un elenco di codici ruolo per precedenza; gli sconosciuti in coda, alfabetici. */
export function sortByPrecedence(roles: readonly string[]): string[] {
  return [
    ...ROLE_PRECEDENCE.filter((r) => roles.includes(r)),
    ...roles.filter((r) => !ROLE_PRECEDENCE.includes(r)).sort(),
  ];
}
