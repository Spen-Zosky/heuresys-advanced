/**
 * apps/api/src/modules/provenance/service.ts — #28 (S1018) Trust Ledger.
 * Scope: PLATFORM_ADMIN unfiltered; TENANT_ADMIN own tenant (RBAC already
 * restricts provenance:read to those two roles — mig 000171). Lineage rows are
 * record-level provenance METADATA (source table/id, confidence, approver
 * marks), not person-level content → no org-axis resolver here; the D-51
 * data-class decision is documented in routes.ts.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { ForbiddenError } from "../../errors/index.js";
import type { ProvenanceListQuery } from "@heuresys/shared";
import * as repo from "./repository.js";

function tenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  if (!a.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return a.tenantId;
}

export const provenanceService = {
  async list(a: ActorContext, query: ProvenanceListQuery) {
    return repo.listRecords(pool, tenantFilter(a), query);
  },
  async summary(a: ActorContext, runId?: string) {
    return repo.summarize(pool, tenantFilter(a), runId);
  },
};
