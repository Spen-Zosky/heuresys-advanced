/**
 * apps/api/test/tenant-blueprint-approval.integration.test.ts
 * #131 Tenant Builder P1 — l'effetto di approvazione del fascicolo.
 *
 * Le tre prove coprono i tre modi in cui puo' andare storto, non solo quello
 * che va bene: la via felice, uno stato sbagliato, e la doppia approvazione.
 * La terza e' quella che conta — se passa quando non dovrebbe, la guardia sullo
 * stato non morde e una versione potrebbe essere approvata due volte.
 *
 * Nessun dato scritto a mano che duplichi una fonte di verita': la versione del
 * modello si legge da quella PUBLISHED che esiste davvero.
 */
import { describe, it, expect } from "vitest";
import { pool } from "../src/db/client.js";
import {
  TENANT_BLUEPRINT_APPROVAL,
  applyTenantBlueprintApproval,
} from "../src/modules/approvals/effects/tenant-blueprint-approval.js";
import type { ApprovalRequestRow } from "../src/modules/approvals/repository.js";

/** Una versione di fascicolo IN_APPROVAL, ancorata alla versione 1 del modello reale. */
async function versioneInApprovazione(codice: string): Promise<string> {
  const {
    rows: [bp],
  } = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_tenant_blueprints (tenant_blueprint_code, tenant_blueprint_name)
     VALUES ($1, $1) RETURNING tenant_blueprint_id AS id`,
    [codice],
  );
  const {
    rows: [vv],
  } = await pool.query<{ id: string }>(
    `SELECT blueprint_variant_version_id AS id FROM sys.sys_blueprint_variant_versions
      WHERE blueprint_variant_version_status = 'PUBLISHED' LIMIT 1`,
  );
  const {
    rows: [v],
  } = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_tenant_blueprint_versions
       (tenant_blueprint_version_blueprint_id, tenant_blueprint_version_number,
        tenant_blueprint_version_status, tenant_blueprint_version_variant_version_id)
     VALUES ($1, 1, 'IN_APPROVAL', $2) RETURNING tenant_blueprint_version_id AS id`,
    [bp!.id, vv!.id],
  );
  return v!.id;
}

const richiesta = (versionId: string): ApprovalRequestRow =>
  ({ resourceId: versionId, resourceType: TENANT_BLUEPRINT_APPROVAL } as ApprovalRequestRow);

describe("effetto di approvazione del fascicolo", () => {
  it("porta la versione ad APPROVED e scatta la fotografia", async () => {
    const versionId = await versioneInApprovazione("PROVA-APPROVA-1");
    const client = await pool.connect();
    try {
      await applyTenantBlueprintApproval(client, richiesta(versionId));
    } finally {
      client.release();
    }
    const { rows } = await pool.query<{ stato: string; foto: string }>(
      `SELECT v.tenant_blueprint_version_status AS stato,
              s.tenant_blueprint_snapshot_content_hash AS foto
         FROM sys.sys_tenant_blueprint_versions v
         LEFT JOIN sys.sys_tenant_blueprint_snapshots s
                ON s.tenant_blueprint_snapshot_version_id = v.tenant_blueprint_version_id
        WHERE v.tenant_blueprint_version_id = $1`,
      [versionId],
    );
    expect(rows[0]?.stato).toBe("APPROVED");
    expect(rows[0]?.foto).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rifiuta una versione che non è in approvazione", async () => {
    const versionId = await versioneInApprovazione("PROVA-APPROVA-2");
    await pool.query(
      `UPDATE sys.sys_tenant_blueprint_versions
          SET tenant_blueprint_version_status = 'DRAFT'
        WHERE tenant_blueprint_version_id = $1`,
      [versionId],
    );
    const client = await pool.connect();
    try {
      await expect(applyTenantBlueprintApproval(client, richiesta(versionId))).rejects.toMatchObject({
        code: "APPLY_EFFECT_FAILED",
      });
    } finally {
      client.release();
    }
  });

  it("approvare due volte fallisce la seconda", async () => {
    const versionId = await versioneInApprovazione("PROVA-APPROVA-3");
    const client = await pool.connect();
    try {
      await applyTenantBlueprintApproval(client, richiesta(versionId));
      await expect(applyTenantBlueprintApproval(client, richiesta(versionId))).rejects.toMatchObject({
        code: "APPLY_EFFECT_FAILED",
      });
    } finally {
      client.release();
    }
  });
});
