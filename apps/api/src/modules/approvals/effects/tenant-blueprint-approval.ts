/**
 * apps/api/src/modules/approvals/effects/tenant-blueprint-approval.ts
 * #131 Tenant Builder P1 — approvare una versione di fascicolo NON e' segnare
 * una casella: e' l'atto che la rende definitiva e ne fissa la prova. Le due
 * cose stanno nella STESSA transazione, quindi una fotografia che fallisce
 * annulla anche l'approvazione — e una versione APPROVED senza prova non puo'
 * esistere.
 *
 * Idioma di applyTenantActivation: UPDATE guardato sullo stato atteso, e uno
 * 0-righe diventa APPLY_EFFECT_FAILED — che fa rollback di markApplied.
 */
import type { PoolClient } from "pg";
import type { ApprovalRequestRow } from "../repository.js";
import { ConflictError } from "../../../errors/index.js";

export const TENANT_BLUEPRINT_APPROVAL = "TENANT_BLUEPRINT_APPROVAL";

export async function applyTenantBlueprintApproval(
  client: PoolClient,
  request: ApprovalRequestRow,
): Promise<void> {
  const versionId = request.resourceId;
  if (!versionId) {
    throw new ConflictError(
      "L'approvazione del fascicolo non indica quale versione (resource_id)",
      "APPLY_EFFECT_FAILED",
    );
  }

  // Chi ha deciso lo dice il passo di approvazione piu' recente: l'effetto non
  // riceve l'approvatore, e inventarlo sarebbe peggio che non scriverlo.
  const approvato = await client.query(
    `UPDATE sys.sys_tenant_blueprint_versions v
        SET tenant_blueprint_version_status      = 'APPROVED',
            tenant_blueprint_version_approved_at = now(),
            tenant_blueprint_version_approved_by = (
              SELECT s.approval_step_decided_by
                FROM sys.sys_approval_steps s
               WHERE s.approval_step_request_id = $2
                 AND s.approval_step_decided_by IS NOT NULL
               ORDER BY s.approval_step_decided_at DESC NULLS LAST
               LIMIT 1),
            updated_at = now()
      WHERE v.tenant_blueprint_version_id = $1
        AND v.tenant_blueprint_version_status = 'IN_APPROVAL'`,
    [versionId, request.approvalRequestId ?? null],
  );
  if ((approvato.rowCount ?? 0) !== 1) {
    throw new ConflictError(
      "La versione del fascicolo non e' in approvazione",
      "APPLY_EFFECT_FAILED",
    );
  }

  // La fotografia: la configurazione risultante, non le sole decisioni.
  // L'impronta si calcola sul payload gia' serializzato in modo stabile
  // (jsonb ordina le chiavi da se', quindi due letture identiche danno lo
  // stesso testo).
  const foto = await client.query(
    `INSERT INTO sys.sys_tenant_blueprint_snapshots
       (tenant_blueprint_snapshot_version_id, tenant_blueprint_snapshot_payload,
        tenant_blueprint_snapshot_content_hash, tenant_blueprint_snapshot_taken_by)
     SELECT v.tenant_blueprint_version_id,
            payload.doc,
            encode(sha256(payload.doc::text::bytea), 'hex'),
            v.tenant_blueprint_version_approved_by
       FROM sys.sys_tenant_blueprint_versions v
       CROSS JOIN LATERAL (
         SELECT jsonb_build_object(
           'versionId',        v.tenant_blueprint_version_id,
           'number',           v.tenant_blueprint_version_number,
           'variantVersionId', v.tenant_blueprint_version_variant_version_id,
           'identity', jsonb_build_object(
             'industryClassId',     v.tenant_blueprint_version_industry_class_id,
             'sizeBandId',          v.tenant_blueprint_version_size_band_id,
             'operatingModelId',    v.tenant_blueprint_version_operating_model_id,
             'regulatoryIntensity', v.tenant_blueprint_version_regulatory_intensity,
             'countryCode',         v.tenant_blueprint_version_country_code,
             'employeeCount',       v.tenant_blueprint_version_employee_count,
             'revenueEur',          v.tenant_blueprint_version_revenue_eur),
           'processes', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'processCode', p.blueprint_process_code,
                      'inclusion',   d.tenant_blueprint_process_decision_inclusion,
                      'rationale',   d.tenant_blueprint_process_decision_rationale)
                    ORDER BY p.blueprint_process_ordinal)
               FROM sys.sys_tenant_blueprint_process_decisions d
               JOIN sys.sys_blueprint_process_registry p
                 ON p.blueprint_process_id = d.tenant_blueprint_process_decision_process_id
              WHERE d.tenant_blueprint_process_decision_version_id = v.tenant_blueprint_version_id),
             '[]'::jsonb)) AS doc
       ) payload
      WHERE v.tenant_blueprint_version_id = $1
     ON CONFLICT (tenant_blueprint_snapshot_version_id) DO NOTHING`,
    [versionId],
  );
  if ((foto.rowCount ?? 0) !== 1) {
    throw new ConflictError(
      "La fotografia della versione non e' stata scattata",
      "APPLY_EFFECT_FAILED",
    );
  }
}
