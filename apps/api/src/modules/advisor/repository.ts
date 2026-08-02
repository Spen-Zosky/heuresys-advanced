/**
 * apps/api/src/modules/advisor/repository.ts
 * Persistenza della traccia di audit delle raccomandazioni (#58 F4).
 *
 * Sostituzione totale e limitata per tenant, come sys_capability_scores (D-18):
 * ri-derivare non fa crescere la tabella.
 */
import type { Pool, PoolClient } from "pg";
import { pool } from "../../db/client.js";
import { withTransaction } from "../../db/client.js";
import type { AdvisorSuggestion } from "@heuresys/shared";

type Queryable = Pool | PoolClient;

export interface StoredSuggestion extends AdvisorSuggestion {
  generatedAt: string;
}

/** Scrive la coorte del tenant in una sola transazione. Ritorna quante righe sono rimaste. */
export async function replaceSuggestions(
  tenantId: string,
  rows: AdvisorSuggestion[],
  modelVersion: string,
): Promise<number> {
  return withTransaction(async (client) => {
    await client.query(
      `DELETE FROM sys.sys_advisor_suggestions WHERE advisor_suggestion_tenant_id = $1`,
      [tenantId],
    );
    if (rows.length === 0) return 0;
    const params: unknown[] = [];
    const tuples = rows.map((r) => {
      const b = params.length;
      params.push(
        tenantId, r.ruleId, r.subjectType, r.subjectId, r.subjectLabel,
        r.priority, r.headlineKey, JSON.stringify(r.headlineParams),
        JSON.stringify(r.citations), modelVersion,
      );
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}::jsonb, $${b + 9}::jsonb, $${b + 10})`;
    });
    await client.query(
      `INSERT INTO sys.sys_advisor_suggestions (
         advisor_suggestion_tenant_id, advisor_suggestion_rule_id, advisor_suggestion_subject_type,
         advisor_suggestion_subject_id, advisor_suggestion_subject_label, advisor_suggestion_priority,
         advisor_suggestion_headline_key, advisor_suggestion_headline_params,
         advisor_suggestion_citations, advisor_suggestion_model_version)
       VALUES ${tuples.join(", ")}`,
      params,
    );
    return rows.length;
  });
}

/** Rilegge la traccia registrata: è ciò che rende l'audit interrogabile invece che solo scritto. */
export async function listSuggestions(
  tenantId: string | null,
  q: Queryable = pool,
): Promise<StoredSuggestion[]> {
  const res = await q.query<{
    rule_id: string; subject_type: string; subject_id: string; subject_label: string;
    priority: string; headline_key: string; headline_params: Record<string, string | number>;
    citations: AdvisorSuggestion["citations"]; generated_at: Date;
  }>(
    `SELECT advisor_suggestion_rule_id AS rule_id,
            advisor_suggestion_subject_type AS subject_type,
            advisor_suggestion_subject_id AS subject_id,
            advisor_suggestion_subject_label AS subject_label,
            advisor_suggestion_priority::text AS priority,
            advisor_suggestion_headline_key AS headline_key,
            advisor_suggestion_headline_params AS headline_params,
            advisor_suggestion_citations AS citations,
            advisor_suggestion_generated_at AS generated_at
       FROM sys.sys_advisor_suggestions
      WHERE ($1::uuid IS NULL OR advisor_suggestion_tenant_id = $1::uuid)
      ORDER BY advisor_suggestion_priority DESC, advisor_suggestion_subject_label`,
    [tenantId],
  );
  return res.rows.map((r) => ({
    ruleId: r.rule_id as AdvisorSuggestion["ruleId"],
    subjectType: r.subject_type as AdvisorSuggestion["subjectType"],
    subjectId: r.subject_id,
    subjectLabel: r.subject_label,
    priority: Number(r.priority),
    headlineKey: r.headline_key,
    headlineParams: r.headline_params ?? {},
    citations: r.citations ?? [],
    generatedAt: r.generated_at.toISOString(),
  }));
}
