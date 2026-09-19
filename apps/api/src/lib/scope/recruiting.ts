/**
 * apps/api/src/lib/scope/recruiting.ts — mandato K, R-4 (D8=A).
 *
 * Il PERCHE'. I sei permessi granulari nati da R-10 (requisition:*, candidate:*,
 * interview:feedback, offer:manage) sono tutti a scope TENANT: PLATFORM_ADMIN, i
 * plenipotenziari e RECRUITER vedono ogni richiesta/candidato/colloquio del tenant.
 * HIRING_MANAGER e' diverso per costruzione (mandato, passo 50): vede SOLO cio' che
 * appartiene alla propria catena organizzativa — la stessa nozione di "capo" gia'
 * usata dall'asse gerarchico (I16/I19, MANAGERIAL_ROLES/isOrgUnitManager), applicata
 * qui a un dato di PROCESSO (la richiesta di personale), non a una persona sensibile.
 * Per questo NON si riusa `resolveOrgReadScope` (quello risolve "quali PERSONE",
 * I18/I20): serve un resolver suo, che risolve "quali UNITA'" via
 * `position_organization_unit_id` — la richiesta appartiene a un posto, il posto a
 * un'unita', non a una persona.
 */

import type { ActorContext } from "../actor.js";
import { isPlatform } from "../actor.js";
import { HR_MANDATED_ROLES } from "./resolver.js";
import { orgSubtreeUnitIds, isOrgUnitManager, type DbConnector } from "./org.js";

/** Ruoli che vedono OGNI richiesta/candidato/colloquio/offerta del tenant, senza filtro
 *  di unita': PLATFORM_ADMIN (mandato tecnico, gestito a parte) + i plenipotenziari HR +
 *  RECRUITER (conduce l'intero ciclo, mandato K R-4). */
export const RECRUITING_TENANT_WIDE_ROLES: ReadonlySet<string> = new Set<string>([
  ...HR_MANDATED_ROLES,
  "RECRUITER",
]);

/** Lo scope organizzativo per i dati del recruiting. `tenant` = nessun filtro oltre al
 *  tenant; `org-units` = solo le richieste/candidati/colloqui la cui posizione appartiene
 *  a una di queste unita' (sotto-albero dell'attore, incluse le unita' dirette). Un array
 *  vuoto in `org-units` nega tutto: un HIRING_MANAGER che non dirige alcuna unita' non ha
 *  ancora un perimetro, non ne ha uno "pieno" per difetto. */
export type RecruitingOrgScope =
  | { kind: "tenant" }
  | { kind: "org-units"; unitIds: string[] };

export async function resolveRecruitingOrgScope(
  q: DbConnector,
  actor: ActorContext,
): Promise<RecruitingOrgScope> {
  if (isPlatform(actor)) return { kind: "tenant" };
  if (actor.roles.some((r) => RECRUITING_TENANT_WIDE_ROLES.has(r))) return { kind: "tenant" };
  // HIRING_MANAGER (o chiunque altro finisse per avere solo requisition:read/candidate:read/
  // interview:feedback senza i permessi tenant-wide): il segnale e' dirigere un'unita', stesso
  // segnale primario di I16 (isOrgUnitManager), non il nome del ruolo.
  if (await isOrgUnitManager(q, actor.userId)) {
    const unitIds = await orgSubtreeUnitIds(q, actor.userId);
    return { kind: "org-units", unitIds };
  }
  return { kind: "org-units", unitIds: [] };
}
