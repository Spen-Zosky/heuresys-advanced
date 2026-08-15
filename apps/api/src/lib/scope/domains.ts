/**
 * apps/api/src/lib/scope/domains.ts — the ACTIVE DOMAINS of a person (#119).
 *
 * A domain is a standing reason to see something beyond your own record. The
 * domain-definition work names five, and four of them are FACTS IN THE DATA, not
 * role names: you manage an org unit, you lead a team, you own a process. Only
 * the two mandates are role-shaped, and ADR-0027 §2.5 defines them that way on
 * purpose ("by explicit mandate, not via the axes").
 *
 * WHY THIS MODULE EXISTS. Three hand-written role lists were deciding what a
 * person may see, and each was wrong in the same way — it answered "who are
 * you?" instead of "what do you hold?".
 *
 *  - `UI_ADMIN_ROLES` (me/service.ts) listed 7 roles and **omitted `CEO`**, so
 *    the person running the whole company saw no administrative section at all.
 *  - The same tier ladder was **copy-pasted into three services** (dashboard,
 *    analytics, insights), each ending in a silent `return "TEAM"` that sent
 *    anyone unmatched to an empty dashboard rather than saying so.
 *
 * A list cannot be right for long: it has to be edited every time a role is
 * created, and nothing fails when it isn't. `CEO` was added to the RBAC map and
 * to nobody's list, and the defect sat there silently. Derivation has no such
 * failure mode — `federica.marchetti` gets her sections because she manages an
 * org unit, and the word "CEO" appears nowhere in the decision.
 *
 * MEASURED IMPACT of the switch (live map, 2026-08-04, all 163 active users):
 * **37 people gain** the administrative sections — 25 unit managers with
 * `TEAM_LEADER`, 9 team leads / process owners with only `TEAM_MEMBER+USER`, 2
 * more unit managers, 1 custodian — and **nobody loses anything**. The entries
 * they gain (12-13 each) are entries whose permission they ALREADY hold: the
 * sidebar gate is hybrid, the permission pair is checked first, so this widens
 * what is offered to exactly what the API would already have served.
 */

import type { DbConnector } from "./org.js";
import { isPlatform, type ActorContext } from "../actor.js";
import { HR_MANDATED_ROLES } from "./resolver.js";

/**
 * I domini funzionali della matrice (ADR-0036).
 *
 * I primi cinque esistevano dal principio. I tre in coda sono stati aggiunti da **#99 F6**
 * (2026-08-15): l'ADR li dichiarava e nessuno li calcolava — «no production consumer of the
 * functional-scope helpers yet». Ora `activeDomainsOf` li deriva dalle tabelle che li
 * DEFINISCONO, quindi una nomina fatta oggi è in effetto oggi.
 *
 * `delegation` è arrivato per ultimo, in **F6b**, e con la sua tabella (`000314`): all'inizio
 * di F6 non esisteva alcuna colonna di delega nel database, e dichiarare un dominio che non
 * può accendersi sarebbe stato l'errore appena classificato `[RESIDUO]` sugli OKR.
 */
export type Domain =
  | "platform_mandate"
  | "hr_mandate"
  | "line_management"
  | "team_lead"
  | "process_owner"
  | "mentor"
  | "approver"
  | "team_peer"
  | "delegation"
  | "custody";

/**
 * Il mandato di CUSTODIA delle segnalazioni — arrivato con **#99 F7**, e serviva.
 *
 * F6 lo aveva lasciato fuori dichiarando che «aggiungerlo richiede una decisione, non del
 * codice». La decisione l'ha imposta F7: la derivazione della sidebar da M1 ha bisogno di
 * una riga `custody`, perche' la console delle segnalazioni e' precisamente la voce la cui
 * visibilita' deve discendere dalla matrice — e' il difetto **D1**, quello da cui e' partito
 * tutto il lavoro sui domini.
 *
 * E' role-shaped come i due mandati, per la stessa ragione di ADR-0036 §2.5: un mandato si
 * CONFERISCE, non si deduce dall'organigramma. Nessuno diventa custode perche' dirige
 * un'unita'.
 */
const CUSTODY_ROLES: ReadonlySet<string> = new Set(["WHISTLEBLOWING_CUSTODIAN"]);

/**
 * I domini che aprono una superficie OLTRE il proprio record.
 *
 * ⚠ Questa distinzione **non è un dettaglio, è la ragione per cui i tre domini nuovi si
 * potevano aggiungere senza rompere nulla.** `hasAnyDomain` decide se il menu mostra le voci
 * amministrative, ed era `activeDomainsOf(...).size > 0`: aggiungere `team_peer` avrebbe reso
 * vero quel predicato per **159 persone su 161** — cioè avrebbe aperto il menu di governo a
 * quasi tutta l'azienda. L'API avrebbe poi risposto 403 e nessun dato sarebbe uscito, ma un
 * menu che offre una funzione altrui è comunque una bugia (è il difetto già corretto in
 * `#101`, e la lezione non va ri-pagata).
 *
 * Essere mentore, approvatore o compagno di squadra dice **cosa fai**, non **su chi puoi
 * guardare**: è la distinzione di I18, dove l'appartenenza funzionale non apre mai i dati
 * sensibili di un altro.
 *
 * ⚠ **`custody` non entra qui, ed e' una decisione di F7.** Questo insieme risponde «apri una
 * superficie amministrativa GENERALE?», e da esso discende anche il livello di ampiezza delle
 * pagine aggregate (`scopeTierOf`). La custodia apre **una sola** superficie, la propria: se
 * fosse qui, il custode otterrebbe il livello `TEAM` su dashboard, analytics e insights —
 * superfici che M1 gli nega su ogni classe (`SKILL`/`EVALUATION`/`COMPENSATION` = `none`).
 * La sua voce di menu gli arriva dalla derivazione M1, che e' precisa dove questo insieme e'
 * grossolano.
 */
const DOMINI_CHE_APRONO_UNA_SUPERFICIE: ReadonlySet<Domain> = new Set<Domain>([
  "platform_mandate",
  "hr_mandate",
  "line_management",
  "team_lead",
  "process_owner",
]);

/**
 * The domains this person actually holds, right now.
 *
 * The three organizational/functional ones are single existence checks against
 * the tables that DEFINE them, so a nomination made today is in effect today —
 * no list to remember to edit.
 */
export async function activeDomainsOf(
  q: DbConnector,
  actor: ActorContext,
): Promise<Set<Domain>> {
  const domains = new Set<Domain>();
  if (isPlatform(actor)) domains.add("platform_mandate");
  if (actor.roles.some((r) => HR_MANDATED_ROLES.has(r))) domains.add("hr_mandate");
  if (actor.roles.some((r) => CUSTODY_ROLES.has(r))) domains.add("custody");

  const { rows } = await q.query<{
    line_management: boolean;
    team_lead: boolean;
    process_owner: boolean;
    mentor: boolean;
    approver: boolean;
    team_peer: boolean;
    delegation: boolean;
  }>(
    `SELECT
       EXISTS (SELECT 1 FROM sys.sys_organization_units o
                WHERE o.organization_unit_manager_user_id = $1
                  AND o.organization_unit_is_active)          AS line_management,
       EXISTS (SELECT 1 FROM sys.sys_teams t
                WHERE t.team_lead_user_id = $1)               AS team_lead,
       EXISTS (SELECT 1 FROM sys.sys_process_participants p
                WHERE p.process_participant_user_id = $1
                  AND p.process_participant_role = 'OWNER'
                  AND p.process_participant_is_active)        AS process_owner,
       -- #99 F6 — i tre domini che ADR-0036 dichiarava e nessuno calcolava.
       -- Ciascuno esce dalla tabella che lo DEFINISCE, non da una lista di ruoli.
       EXISTS (SELECT 1 FROM sys.sys_mentorships m
                WHERE m.mentorship_mentor_user_id = $1)       AS mentor,
       EXISTS (SELECT 1 FROM sys.sys_approval_steps a
                WHERE a.approval_step_approver_user_id = $1)  AS approver,
       -- Compagno di squadra: MEMBRO, non capo. Chi guida e' gia' team_lead, e un capo
       -- che risultasse anche «pari» renderebbe i due domini indistinguibili.
       EXISTS (SELECT 1 FROM sys.sys_team_members tm
                 JOIN sys.sys_teams t2 ON t2.team_id = tm.team_member_team_id
                WHERE tm.team_member_user_id = $1
                  AND tm.team_member_is_active
                  AND t2.team_is_active
                  AND t2.team_lead_user_id IS DISTINCT FROM $1) AS team_peer,
       -- F6b: si ha il dominio se si RICEVE una delega IN VIGORE oggi. «In vigore» si
       -- calcola, non si memorizza: una colonna sarebbe vera il giorno che la scrivi e
       -- falsa il giorno dopo, senza che nessuno se ne accorga.
       EXISTS (SELECT 1 FROM sys.sys_user_delegations dl
                WHERE dl.user_delegation_delegate_id = $1
                  AND dl.user_delegation_status = 'ACTIVE'
                  AND dl.user_delegation_starts_on <= current_date
                  AND (dl.user_delegation_ends_on IS NULL
                       OR dl.user_delegation_ends_on >= current_date)) AS delegation`,
    [actor.userId],
  );
  const r = rows[0];
  if (r?.line_management) domains.add("line_management");
  if (r?.team_lead) domains.add("team_lead");
  if (r?.process_owner) domains.add("process_owner");
  if (r?.mentor) domains.add("mentor");
  if (r?.approver) domains.add("approver");
  if (r?.team_peer) domains.add("team_peer");
  if (r?.delegation) domains.add("delegation");
  return domains;
}

/**
 * Does this person hold any standing reason to look beyond their own record?
 *
 * This is the replacement for `UI_ADMIN_ROLES`. Everyone keeps their own data
 * unconditionally (**I17**), so `false` here means "the personal area is your
 * whole surface", not "you are locked out".
 */
export async function hasAnyDomain(q: DbConnector, actor: ActorContext): Promise<boolean> {
  // NON `size > 0` su TUTTI i domini: dal 2026-08-15 `activeDomainsOf` restituisce anche
  // domini che dicono cosa fai e non su chi puoi guardare. Misurato togliendo la
  // distinzione: **109 persone in più** vedrebbero il menu amministrativo. Non è
  // un'ipotesi, è il numero che il test stampa quando si sabota.
  return (await dominiCheApronoUnaSuperficie(q, actor)).size > 0;
}

/**
 * Quali domini fra quelli attivi aprono una superficie — l'insieme, non il predicato.
 *
 * `hasAnyDomain` risponde «sì/no» e basta a decidere se una sezione amministrativa esiste
 * per questa persona. **#99 F7** ha bisogno di sapere *quali*, perché M1 va interrogata
 * dominio per dominio: chi guida una squadra apre una superficie, ma sulla classe
 * `COMPENSATION` la sua cella vale `none`, e la pagina delle retribuzioni non gli va offerta.
 *
 * I domini che restano fuori non sono «minori»: dicono **cosa fai** (mentore, approvatore,
 * pari, delegato), non **su chi puoi guardare** — I18. Interrogare M1 su quelli produrrebbe
 * il difetto misurato dal contro-oracolo di F7: 109 persone con la pagina di gestione utenti.
 */
export async function dominiCheApronoUnaSuperficie(
  q: DbConnector,
  actor: ActorContext,
): Promise<Set<Domain>> {
  const domini = await activeDomainsOf(q, actor);
  const out = new Set<Domain>();
  for (const d of domini) if (DOMINI_CHE_APRONO_UNA_SUPERFICIE.has(d)) out.add(d);
  return out;
}

/* --- the breadth tier of an aggregate surface -------------------------------- */

/**
 * How wide a dashboard / analytics / insights surface may look.
 *
 * This is NOT `resolveOrgReadScope`, and the difference is deliberate: that one
 * answers "whose SENSITIVE PERSONAL data may you read" (I18) and correctly gives
 * a `BLUEPRINT_MANAGER` nothing. A tenant-wide business aggregate is a different
 * question — a blueprint manager legitimately reads tenant-wide catalogue and
 * process statistics without reading anyone's salary. Conflating the two would
 * either leak pay or blank the catalogue dashboards.
 */
export type ScopeTier = "PLATFORM" | "TENANT" | "TEAM";

/**
 * Mandates that reach the whole tenant on BUSINESS aggregates.
 *
 * Yes, this is a set of role names — and here that is the definition rather than
 * a shortcut, for the same reason `HR_MANDATED_ROLES` is (ADR-0027 §2.5): a
 * mandate is conferred by grant, not inferred from the org chart. `BLUEPRINT_MANAGER`
 * and `PROCESS_OWNER` sit beside the HR mandate because their remit is the
 * tenant's catalogues and processes, which are tenant-wide by nature.
 *
 * It lives HERE, once, instead of being copy-pasted into three services.
 */
const TENANT_WIDE_MANDATES: ReadonlySet<string> = new Set([
  ...HR_MANDATED_ROLES,
  "BLUEPRINT_MANAGER",
  "PROCESS_OWNER",
]);

/** Raised when an actor reaches an aggregate surface with no breadth at all. */
export class NoScopeTierError extends Error {
  readonly code = "NO_SCOPE_TIER";
  constructor(surface: string) {
    super(
      `No scope tier on ${surface}: the caller holds no active domain. ` +
        "The personal area is their surface — see #119.",
    );
  }
}

/**
 * The widest tier the actor holds, or a loud failure.
 *
 * The old shape ended in `return "TEAM"` for anyone unmatched, which rendered an
 * empty dashboard that reads as "you have no data" when the truth is "we could
 * not place you". Measured on the live map 2026-08-04: **no role that holds
 * `dashboard:view` / `analytics:view` / `insights:view` reaches the fallback**,
 * so it was dead code — but dead code that would silently mis-place the next
 * role added, exactly as `CEO` was mis-placed by `UI_ADMIN_ROLES`. It now
 * throws, and the caller can send the person to their personal area.
 */
export async function scopeTierOf(
  q: DbConnector,
  actor: ActorContext,
  surface: string,
): Promise<ScopeTier> {
  if (isPlatform(actor)) return "PLATFORM";
  if (actor.roles.some((r) => TENANT_WIDE_MANDATES.has(r))) return "TENANT";
  if (await hasAnyDomain(q, actor)) return "TEAM";
  throw new NoScopeTierError(surface);
}
