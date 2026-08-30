/**
 * apps/api/src/modules/surveys/service.ts
 * Engagement surveys CRUD with tenant-only visibility scope (no global rows).
 * PLATFORM_ADMIN: unfiltered. Others: limited to own tenant; not-visible rows surface as 404 (no leak).
 * templates/surveys are mutable CRUD; responses are a read-only immutable event log nested under a survey.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";
import type {
  SurveyTemplateListQuery, CreateSurveyTemplateBody, UpdateSurveyTemplateBody,
  SurveyListQuery, CreateSurveyBody, UpdateSurveyBody,
  SurveyResponseListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

/** List-scope filter: undefined = no filter (PLATFORM_ADMIN); else own tenant (zero-uuid if tenantless → 0 rows). */
function listTenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  return a.tenantId ?? ZERO_UUID;
}

/** Throw 404 (not 403, to avoid tenant enumeration) when a row is outside the actor's scope. */
function assertVisible(a: ActorContext, rowTenantId: string, resource: string): void {
  if (isPlatform(a)) return;
  if (a.tenantId === null || rowTenantId !== a.tenantId) throw new NotFoundError(resource);
}

/**
 * #235 — la lista di utenti che l'attore puo' leggere sull'asse organizzativo, o `undefined`
 * quando non c'e' limite (piattaforma, mandato HR). Un solo posto da cui esce, cosi' lista e
 * platea non possono divergere.
 */
async function orgAllowList(a: ActorContext): Promise<string[] | undefined> {
  const scope = await resolveOrgReadScope(pool, a);
  return scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
}

/** Resolve the tenant a write lands in. */
function resolveWriteTenant(a: ActorContext, bodyTenantId?: string): string {
  if (isPlatform(a)) {
    const t = bodyTenantId ?? a.tenantId;
    if (!t) throw new ForbiddenError("PLATFORM_ADMIN must supply tenantId", "TENANT_ID_REQUIRED");
    return t;
  }
  if (!a.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return a.tenantId;
}

/** #235 — la platea ridotta a chi l'attore puo' leggere. `null` resta `null`. */
function filtraPlatea<T extends { audienceIds: string[] | null }>(s: T, consentiti: string[]): T {
  if (s.audienceIds === null) return s;
  const visti = new Set(consentiti);
  return { ...s, audienceIds: s.audienceIds.filter((id) => visti.has(id)) };
}

export const surveysService = {
  // ── Templates ──
  async listTemplates(a: ActorContext, query: SurveyTemplateListQuery) {
    return repo.listTemplates(pool, listTenantFilter(a), query);
  },
  async getTemplate(a: ActorContext, id: string) {
    const t = await repo.findTemplateById(pool, id);
    if (!t) throw new NotFoundError("Survey template");
    assertVisible(a, t.tenantId, "Survey template");
    return t;
  },
  async createTemplate(a: ActorContext, body: CreateSurveyTemplateBody) {
    const tenantId = resolveWriteTenant(a, body.tenantId);
    return repo.insertTemplate(pool, tenantId, body);
  },
  async updateTemplate(a: ActorContext, id: string, patch: UpdateSurveyTemplateBody) {
    const t = await repo.findTemplateById(pool, id);
    if (!t) throw new NotFoundError("Survey template");
    assertVisible(a, t.tenantId, "Survey template");
    const updated = await repo.updateTemplatePartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Survey template");
    return updated;
  },
  async deleteTemplate(a: ActorContext, id: string): Promise<void> {
    const t = await repo.findTemplateById(pool, id);
    if (!t) throw new NotFoundError("Survey template");
    assertVisible(a, t.tenantId, "Survey template");
    await repo.deleteTemplate(pool, id);
  },

  // ── Surveys ──
  // #235 — la campagna e' struttura (titolo, periodo, stato) e resta visibile a chi ha il
  // permesso: nasconderla non proteggerebbe nessuno e toglierebbe l'uso legittimo. Cio' che
  // porta persone e' `audienceIds`, la platea: quella si filtra con l'asse organizzativo.
  // Oggi e' vuota su tutte e 6 le campagne (misurato 2026-08-30) — ed e' proprio per questo
  // che il filtro va messo adesso: una riga che oggi non fa nulla, ma che rende la
  // dichiarazione `orgGate` vera per COSTRUZIONE invece che per una misura che puo' cambiare.
  async listSurveys(a: ActorContext, query: SurveyListQuery) {
    const page = await repo.listSurveys(pool, listTenantFilter(a), query);
    const consentiti = await orgAllowList(a);
    if (!consentiti) return page;
    return { ...page, items: page.items.map((s) => filtraPlatea(s, consentiti)) };
  },
  async getSurvey(a: ActorContext, id: string) {
    const s = await repo.findSurveyById(pool, id);
    if (!s) throw new NotFoundError("Survey");
    assertVisible(a, s.tenantId, "Survey");
    const consentiti = await orgAllowList(a);
    return consentiti ? filtraPlatea(s, consentiti) : s;
  },
  async createSurvey(a: ActorContext, body: CreateSurveyBody) {
    const tenantId = resolveWriteTenant(a, body.tenantId);
    return repo.insertSurvey(pool, tenantId, body);
  },
  async updateSurvey(a: ActorContext, id: string, patch: UpdateSurveyBody) {
    const s = await repo.findSurveyById(pool, id);
    if (!s) throw new NotFoundError("Survey");
    assertVisible(a, s.tenantId, "Survey");
    const updated = await repo.updateSurveyPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Survey");
    return updated;
  },
  async deleteSurvey(a: ActorContext, id: string): Promise<void> {
    const s = await repo.findSurveyById(pool, id);
    if (!s) throw new NotFoundError("Survey");
    assertVisible(a, s.tenantId, "Survey");
    await repo.deleteSurvey(pool, id);
  },

  // ── Responses (read-only, nested under a survey) ──
  // #235 — chi ha detto cosa sul clima aziendale si legge SOLO dentro la propria catena
  // organizzativa (I18: l'appartenenza funzionale non apre un dato sensibile). Self resta
  // sempre leggibile: `resolveOrgReadScope` mette l'attore nella propria allow-list (I17).
  async listResponses(a: ActorContext, surveyId: string, query: SurveyResponseListQuery) {
    const s = await repo.findSurveyById(pool, surveyId);
    if (!s) throw new NotFoundError("Survey");
    assertVisible(a, s.tenantId, "Survey");
    return repo.listResponsesBySurvey(pool, surveyId, query, await orgAllowList(a));
  },
  async getResponse(a: ActorContext, id: string) {
    const r = await repo.findResponseById(pool, id);
    if (!r) throw new NotFoundError("Survey response");
    assertVisible(a, r.tenantId, "Survey response");
    // 404 e non 403, come `assertVisible`: un 403 direbbe «esiste ma non te la do», cioe'
    // confermerebbe che quella persona ha risposto — che e' meta' del dato da proteggere.
    if (r.subjectUserId && !(await canReadOrgTarget(pool, a, r.subjectUserId, r.tenantId))) {
      throw new NotFoundError("Survey response");
    }
    return r;
  },
};
