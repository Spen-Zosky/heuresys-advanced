/**
 * apps/api/src/modules/engagement/service.ts
 * B-10b m2b — normalized engagement read-model with tenant-only visibility.
 * READ-ONLY. PLATFORM_ADMIN: unfiltered. Others: own tenant only; out-of-scope rows → 404 (no leak).
 */
import { pool } from "../../db/client.js";
import { NotFoundError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  EngagementSurveyListResponse,
  EngagementSurveyResultsResponse,
  EngagementPulseResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

const isPlatform = (a: ActorContext): boolean => a.roles.includes("PLATFORM_ADMIN");

/** List-scope filter: undefined = no filter (PLATFORM_ADMIN); else own tenant (zero-uuid if tenantless → 0 rows). */
function listTenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  return a.tenantId ?? ZERO_UUID;
}

function assertVisible(a: ActorContext, rowTenantId: string, resource: string): void {
  if (isPlatform(a)) return;
  if (a.tenantId === null || rowTenantId !== a.tenantId) throw new NotFoundError(resource);
}

export const engagementService = {
  async listSurveys(a: ActorContext): Promise<EngagementSurveyListResponse> {
    const items = await repo.listSurveys(pool, listTenantFilter(a));
    return { items, total: items.length };
  },

  async surveyResults(a: ActorContext, surveyId: string): Promise<EngagementSurveyResultsResponse> {
    const meta = await repo.findSurveyMeta(pool, surveyId);
    if (!meta) throw new NotFoundError("Survey");
    assertVisible(a, meta.tenantId, "Survey");
    const questions = await repo.surveyResults(pool, surveyId);
    return { surveyId: meta.surveyId, title: meta.title, questions };
  },

  async pulse(a: ActorContext): Promise<EngagementPulseResponse> {
    return repo.pulseAggregation(pool, listTenantFilter(a));
  },
};
