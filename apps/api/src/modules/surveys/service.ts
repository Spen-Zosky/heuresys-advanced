/**
 * apps/api/src/modules/surveys/service.ts
 * Engagement surveys CRUD with tenant-only visibility scope (no global rows).
 * PLATFORM_ADMIN: unfiltered. Others: limited to own tenant; not-visible rows surface as 404 (no leak).
 * templates/surveys are mutable CRUD; responses are a read-only immutable event log nested under a survey.
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  SurveyTemplateListQuery, CreateSurveyTemplateBody, UpdateSurveyTemplateBody,
  SurveyListQuery, CreateSurveyBody, UpdateSurveyBody,
  SurveyResponseListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function isPlatform(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}

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
  async listSurveys(a: ActorContext, query: SurveyListQuery) {
    return repo.listSurveys(pool, listTenantFilter(a), query);
  },
  async getSurvey(a: ActorContext, id: string) {
    const s = await repo.findSurveyById(pool, id);
    if (!s) throw new NotFoundError("Survey");
    assertVisible(a, s.tenantId, "Survey");
    return s;
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
  async listResponses(a: ActorContext, surveyId: string, query: SurveyResponseListQuery) {
    const s = await repo.findSurveyById(pool, surveyId);
    if (!s) throw new NotFoundError("Survey");
    assertVisible(a, s.tenantId, "Survey");
    return repo.listResponsesBySurvey(pool, surveyId, query);
  },
  async getResponse(a: ActorContext, id: string) {
    const r = await repo.findResponseById(pool, id);
    if (!r) throw new NotFoundError("Survey response");
    assertVisible(a, r.tenantId, "Survey response");
    return r;
  },
};
