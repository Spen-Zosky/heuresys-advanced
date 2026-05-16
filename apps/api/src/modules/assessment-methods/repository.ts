/**
 * apps/api/src/modules/assessment-methods/repository.ts
 * Read-only catalog (5 methods seeded in migration 000017).
 */

import type { Pool, PoolClient } from "pg";
import type { AssessmentMethod, AssessmentMethodCode } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  assessment_method_id: string;
  assessment_method_code: AssessmentMethodCode;
  assessment_method_name: string;
  assessment_method_description: string | null;
  assessment_method_metadata: Record<string, unknown>;
  created_at: Date;
}

const COLS = `assessment_method_id, assessment_method_code, assessment_method_name,
  assessment_method_description, assessment_method_metadata, created_at`;

function toMethod(r: Row): AssessmentMethod {
  return {
    assessmentMethodId: r.assessment_method_id,
    code: r.assessment_method_code,
    name: r.assessment_method_name,
    description: r.assessment_method_description,
    metadata: r.assessment_method_metadata,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listMethods(
  q: DbConnector,
): Promise<{ items: AssessmentMethod[]; total: number }> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_assessment_methods ORDER BY assessment_method_code`,
  );
  const items = res.rows.map(toMethod);
  return { items, total: items.length };
}

export async function methodExists(q: DbConnector, methodId: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_assessment_methods WHERE assessment_method_id = $1 LIMIT 1`,
    [methodId],
  );
  return res.rows.length > 0;
}
