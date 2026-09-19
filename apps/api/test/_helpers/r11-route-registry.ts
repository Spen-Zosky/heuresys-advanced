/**
 * apps/api/test/_helpers/r11-route-registry.ts — mandato K, passo 58, R-11.
 *
 * Una rotta di SCRITTURA per ciascuna risorsa "scrittura-capace" della matrice
 * (`esiti/R-11_matrice.json`): l'universo e' quello dichiarato nel mandato — le sole
 * risorse dove almeno uno dei 10 ruoli nuovi ha un permesso di scrittura
 * (create/update/delete/manage/trigger/decide/erase/retention/write/activate/override/
 * self_assess/publish). Le risorse dove tutti i ruoli hanno solo lettura restano fuori:
 * non sono il confine di sicurezza che questo test difende.
 *
 * Ogni entry porta il permesso ESATTO che il preHandler richiede (`requirePermission`,
 * verificato leggendo `apps/api/src/modules/<modulo>/routes.ts`), cosi' il test puo'
 * decidere l'atteso leggendo `R-11_matrice.json` senza duplicare la conoscenza qui.
 *
 * Scelta sistematica della rotta per risorsa: quando esiste una DELETE/azione che
 * richiede SOLO parametri di percorso (nessun body), e' quella scelta — elimina la
 * variabile "lo schema del body e' soddisfatto?" e lascia il solo RBAC come giudice.
 * Quando serve un body, e' il piu' piccolo che supera la validazione Zod (spesso `{}`
 * perche' gli UpdateXxxBodySchema del progetto sono tutti-opzionali).
 *
 * NIENTE riga qui assume che la risorsa puntata esista: gli id sono sintetici
 * (randomUUID). Il permesso si controlla nel preHandler PRIMA che il service tocchi il
 * DB, quindi un ruolo senza il permesso riceve 403 a prescindere; un ruolo con il
 * permesso ma su un id inesistente riceve tipicamente 404 — entrambi compatibili con
 * l'assert del mandato (negativo: [403,404]; positivo: qualunque cosa tranne 403).
 *
 * ESCLUSA dalla matrice: `bpm_process` (BLUEPRINT_MANAGER ha bpm_process:delete/read/
 * update nel database, ma NESSUNA rotta HTTP in tutto apps/api/src la richiede —
 * verificato con grep su `requirePermission("bpm_process` = zero risultati. I tre
 * permessi di process_kpi_template / organization_unit_kpi_template dichiarano nei loro
 * stessi file "previously proxied on bpm_process:*" — il codice e' vivo nel DB ma senza
 * porta, com'e' l'X-1/X-2 per un dato "importato": l'assenza della rotta e' il confine.
 */
import { randomUUID } from "node:crypto";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface R11Route {
  /** Nome della risorsa come appare in R-11_matrice.json (es. "goal", "tenant_blueprint"). */
  resource: string;
  /** Permesso ESATTO richiesto dal preHandler della rotta scelta. */
  permission: string;
  method: HttpMethod;
  /** Percorso gia' risolto con id sintetici (uno per resource, riusato per tutti i 10 ruoli). */
  url: string;
  /** Body minimo che supera la validazione Zod — undefined per le rotte senza body. */
  body?: Record<string, unknown>;
  /** Perche' questa rotta e non un'altra con lo stesso permesso — per chi rilegge. */
  note: string;
}

/**
 * Data reale nel formato YYYY-MM-DD, per i due campi obbligatori di
 * CreateCompensationRecommendationBodySchema (periodStart/periodEnd, regex data).
 */
const D1 = "2026-01-01";
const D2 = "2026-01-31";

export function buildR11Routes(): R11Route[] {
  return [
    {
      resource: "gdpr",
      permission: "gdpr:export",
      method: "POST",
      url: `/v1/gdpr/users/${randomUUID()}/export`,
      note: "Solo permesso + param userId, nessun body — isola il solo RBAC. DPO e' l'unico dei 10 con gdpr:export (non-self).",
    },
    {
      resource: "skill",
      permission: "skill:create",
      method: "POST",
      url: "/v1/skills",
      body: { code: `IT_R11_${randomUUID().slice(0, 8).toUpperCase()}`, name: "Competenza di collaudo R-11" },
      note: "CreateSkillBodySchema richiede code+name; TAXONOMY_STEWARD e PEOPLE_MANAGER hanno skill:create.",
    },
    {
      resource: "skill_alias",
      permission: "skill_alias:manage",
      method: "DELETE",
      url: `/v1/skill-aliases/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo TAXONOMY_STEWARD ha skill_alias:manage.",
    },
    {
      resource: "candidate",
      permission: "candidate:write",
      method: "PATCH",
      url: `/v1/candidates/${randomUUID()}`,
      // CandidateUpdateBodySchema porta `.refine(Object.keys(b).length > 0)`: un body
      // vuoto e' un 400 di VALIDAZIONE per chiunque, permesso o no (misurato: la corsa
      // iniziale lo dava 400 anche ai ruoli senza candidate:write, mascherando il 403
      // atteso). `metadata: {}` aggiunge una chiave innocua senza toccare alcun campo
      // semantico, e supera il refine per tutti.
      body: { metadata: {} },
      note: "Solo RECRUITER ha candidate:write (HIRING_MANAGER ha solo candidate:read).",
    },
    {
      resource: "interview",
      permission: "interview:feedback",
      method: "PATCH",
      url: `/v1/interviews/${randomUUID()}`,
      // Stesso refine non-vuoto di candidate — vedi nota sopra.
      body: { metadata: {} },
      note: "Un solo verbo per lettura E scrittura: sia RECRUITER sia HIRING_MANAGER hanno interview:feedback, entrambi passano.",
    },
    {
      resource: "offer",
      permission: "offer:manage",
      method: "PATCH",
      url: `/v1/job-offers/${randomUUID()}`,
      // Stesso refine non-vuoto di candidate — vedi nota sopra.
      body: { metadata: {} },
      note: "Solo RECRUITER ha offer:manage (HIRING_MANAGER non lo ha per disegno del mandato R-4).",
    },
    {
      resource: "requisition",
      permission: "requisition:manage",
      method: "PATCH",
      url: `/v1/job-requisitions/${randomUUID()}`,
      // Stesso refine non-vuoto di candidate — vedi nota sopra.
      body: { metadata: {} },
      note: "Solo RECRUITER ha requisition:manage (HIRING_MANAGER ha solo requisition:read).",
    },
    {
      resource: "tenant_blueprint",
      permission: "tenant_blueprint:write",
      method: "DELETE",
      url: `/v1/tenant-blueprints/${randomUUID()}/versions/1/processes/${randomUUID()}`,
      note: "DELETE su una process-decision: solo parametri di percorso (id, number, processId), nessun body. Solo BLUEPRINT_MANAGER ha :write (IMPLEMENTATION_CONSULTANT ha solo :read).",
    },
    {
      resource: "blueprint",
      permission: "blueprint:delete",
      method: "DELETE",
      url: `/v1/blueprint-activations/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo BLUEPRINT_MANAGER ha blueprint:delete/activate/override.",
    },
    // `enterprise_typing`, `operating_model` e `process_kpi_template` sono ESCLUSE, e non
    // per mancanza di rotta: la rotta c'e', e BLUEPRINT_MANAGER ha DAVVERO
    // enterprise_typing:create/update/delete, operating_model:update/delete e
    // process_kpi_template:update/delete concessi in `sys_auth_role_permissions` (verificato
    // sul vivo, `revoked_at` nullo su tutte). Ma OGNI scrittura dei tre service
    // (`activity-classifications/service.ts`, `operating-models/service.ts`,
    // `process-kpi-templates/service.ts`) apre con `if (!isPlatform(actor)) throw new
    // ForbiddenError("PLATFORM_ADMIN required")` — un mandato DI PIATTAFORMA, non un
    // permesso RBAC, e nessuno dei 10 ruoli nuovi ha `auth_role_is_platform = true`
    // (verificato: tutti `f`). Per questi tre il 403 e' quindi STRUTTURALE per QUALUNQUE
    // attore tenant, concesso o no dalla RBAC: testarli qui proverebbe il mandato di
    // piattaforma, non il confine ruolo x modulo che R-11 difende, e romperebbe la
    // premessa "concesso -> mai 403" per BLUEPRINT_MANAGER senza che sia un difetto.
    // `organization_unit_kpi_template` (stesso genere "ex bpm_process:*", mig 000199) NON
    // condivide questo gate — il suo service controlla solo l'appartenenza al tenant, mai
    // `isPlatform` — quindi resta nella matrice.
    {
      resource: "organization_unit_kpi_template",
      permission: "organization_unit_kpi_template:delete",
      method: "DELETE",
      url: `/v1/organization-unit-kpi-templates/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo BLUEPRINT_MANAGER (ex bpm_process:*, mig 000199) — service senza gate PLATFORM_ADMIN, a differenza dei suoi due gemelli.",
    },
    {
      resource: "visualization",
      permission: "visualization:delete",
      method: "DELETE",
      url: `/v1/visualization-nodes/${randomUUID()}`,
      note: "DELETE /:id, nessun body. BLUEPRINT_MANAGER e PEOPLE_MANAGER hanno entrambi visualization:create/delete/update_layout.",
    },
    {
      resource: "seed_acquisition",
      permission: "seed_acquisition:trigger",
      method: "PATCH",
      url: `/v1/seed-acquisition-runs/${randomUUID()}`,
      body: {},
      note: "UpdateSeedAcquisitionRunBodySchema tutto-opzionale. Solo IMPLEMENTATION_CONSULTANT ha seed_acquisition:trigger fra i 10 (occhio: seed_acquisition:delete e' un permesso DIVERSO, non nella sua lista).",
    },
    {
      resource: "auth",
      permission: "auth:revoke_user",
      method: "POST",
      url: `/v1/auth/admin/revoke-user/${randomUUID()}`,
      note: "Solo param userId, nessun body. Solo SECURITY_ADMIN ha auth:revoke_user fra i 10 (auth:sessions_read e' sola lettura, escluso dalla matrice).",
    },
    {
      resource: "delegation",
      permission: "delegation:manage",
      method: "POST",
      url: `/v1/delegations/${randomUUID()}/revoke`,
      body: {},
      note: "RevokeDelegationBodySchema: reason opzionale, {} valida. Solo SECURITY_ADMIN ha delegation:manage.",
    },
    {
      resource: "mfa_policy",
      permission: "mfa_policy:manage",
      method: "PUT",
      url: `/v1/mfa-policy/${randomUUID()}`,
      body: { enabled: true },
      note: "tenantId sintetico: chi ha il permesso ma un tenant che non e' il proprio riceve 404 (mai 403) dal service, prima ancora di guardare se il tenant esiste — comportamento verificato in service.upsert. Solo SECURITY_ADMIN ha mfa_policy:manage.",
    },
    {
      resource: "role",
      permission: "role:assign",
      method: "DELETE",
      url: `/v1/users/${randomUUID()}/roles/${randomUUID()}`,
      note: "DELETE /:id/roles/:grantId, solo parametri, nessun body. Solo SECURITY_ADMIN ha role:assign fra i 10.",
    },
    {
      resource: "leads",
      permission: "leads:update",
      method: "PATCH",
      url: `/v1/leads/${randomUUID()}`,
      body: { status: "CONTACTED" },
      note: "LeadUpdateSchema richiede status (no default); CONTACTED e' un valore valido di LeadStatusEnum. Solo SALES ha leads:update.",
    },
    {
      resource: "job_role",
      permission: "job_role:update",
      method: "PATCH",
      url: `/v1/job-roles/${randomUUID()}`,
      body: {},
      note: "UpdateJobRoleBodySchema tutto-opzionale. TAXONOMY_STEWARD e PEOPLE_MANAGER hanno entrambi job_role:create/update.",
    },
    {
      resource: "career_succession",
      permission: "career_succession:delete",
      method: "DELETE",
      url: `/v1/career-paths/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha career_succession:create/delete/update.",
    },
    {
      resource: "compensation_intelligence",
      permission: "compensation_intelligence:update",
      method: "POST",
      url: "/v1/compensation/recommendations",
      body: { userId: randomUUID(), periodStart: D1, periodEnd: D2 },
      note: "CreateCompensationRecommendationBodySchema richiede userId/periodStart/periodEnd; il service verifica l'esistenza dell'utente PRIMA di ogni altra cosa (findUserTenantId) quindi un id sintetico da' 404, mai 500. Solo PEOPLE_MANAGER ha compensation_intelligence:update.",
    },
    {
      resource: "content",
      permission: "content:delete",
      method: "DELETE",
      url: `/v1/content/categories/${randomUUID()}`,
      note: "DELETE /categories/:id, nessun body. Solo PEOPLE_MANAGER ha content:create/delete/publish/update.",
    },
    {
      resource: "engagement_feedback",
      permission: "engagement_feedback:delete",
      method: "DELETE",
      url: `/v1/engagement-feedback/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha engagement_feedback:create/delete/update.",
    },
    {
      resource: "gap_analysis",
      permission: "gap_analysis:delete",
      method: "DELETE",
      url: `/v1/learning-gaps/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha gap_analysis:create/delete/update.",
    },
    {
      resource: "goal",
      permission: "goal:delete",
      method: "DELETE",
      url: `/v1/goals/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha goal:create/delete/update.",
    },
    {
      resource: "kpi",
      permission: "kpi:delete",
      method: "DELETE",
      url: `/v1/kpi-definitions/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha kpi:create/delete/update.",
    },
    {
      resource: "learning",
      permission: "learning:delete",
      method: "DELETE",
      url: `/v1/learning-paths/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha learning:create/delete/update.",
    },
    {
      resource: "mentorship",
      permission: "mentorship:delete",
      method: "DELETE",
      url: `/v1/mentorship/programs/${randomUUID()}`,
      note: "DELETE /programs/:id, nessun body. Solo PEOPLE_MANAGER ha mentorship:create/delete/update.",
    },
    {
      resource: "okr",
      permission: "okr:delete",
      method: "DELETE",
      url: `/v1/okrs/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha okr:create/delete/update.",
    },
    {
      resource: "organization_unit",
      permission: "organization_unit:delete",
      method: "DELETE",
      url: `/v1/organization-units/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha organization_unit:create/delete/update.",
    },
    {
      resource: "organization_unit_processes",
      permission: "organization_unit_processes:delete",
      method: "DELETE",
      url: `/v1/organization-unit-processes/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha organization_unit_processes:create/delete.",
    },
    {
      resource: "position",
      permission: "position:delete",
      method: "DELETE",
      url: `/v1/positions/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha position:create/delete/update fra i 10 (oltre a :read che BLUEPRINT_MANAGER ha anch'esso).",
    },
    {
      resource: "surveys",
      permission: "surveys:delete",
      method: "DELETE",
      url: `/v1/surveys/${randomUUID()}`,
      note: "DELETE /:id, nessun body. Solo PEOPLE_MANAGER ha surveys:create/delete/update.",
    },
    {
      resource: "team",
      permission: "team:manage",
      method: "DELETE",
      url: `/v1/teams/${randomUUID()}/members/${randomUUID()}`,
      note: "DELETE /:id/members/:userId, solo parametri. Solo PEOPLE_MANAGER ha team:manage fra i 10.",
    },
    {
      resource: "training_initiative",
      permission: "training_initiative:update",
      method: "PATCH",
      url: `/v1/training-initiatives/${randomUUID()}`,
      body: {},
      note: "UpdateTrainingInitiativeBodySchema tutto-opzionale. Solo PEOPLE_MANAGER ha training_initiative:create/update (no delete in questo modulo).",
    },
    {
      resource: "user",
      permission: "user:delete",
      method: "DELETE",
      url: `/v1/users/${randomUUID()}`,
      note: "DELETE /:id (soft -> DEACTIVATED), nessun body. Solo PEOPLE_MANAGER ha user:create/delete/update fra i 10.",
    },
    {
      resource: "assessment",
      permission: "assessment:update",
      method: "PATCH",
      url: `/v1/assessments/${randomUUID()}`,
      body: {},
      note: "UpdateAssessmentBodySchema tutto-opzionale. Solo PEOPLE_MANAGER ha assessment:create/update.",
    },
    {
      resource: "approval",
      permission: "approval:decide",
      method: "POST",
      url: `/v1/approvals/${randomUUID()}/steps/${randomUUID()}/decide`,
      body: { decision: "APPROVE" },
      note: "DecideApprovalStepBodySchema richiede decision (enum). BLUEPRINT_MANAGER e PEOPLE_MANAGER hanno entrambi approval:decide (solo PEOPLE_MANAGER ha anche approval:create).",
    },
  ];
}
