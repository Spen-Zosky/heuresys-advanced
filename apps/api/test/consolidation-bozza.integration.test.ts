/**
 * apps/api/test/consolidation-bozza.integration.test.ts — la bozza, la cascata e l'approvazione definitiva
 * (piano docs/piani/PIANO_registro-corse-consolidamento_20261114.md, W1-W5 e cascata).
 *
 * Su un modello del registro con unità e posizioni (il primo che ne ha): una sessione del Direttore HR,
 * due proposte scritte a mano (un'unità abbinata, una posizione di quell'unità che il tenant non ha).
 *   · la cascata dell'unità si ricava dal modello e porta la posizione come conseguenza;
 *   · «Aggiorna cascata» registra la scelta anche sulla posizione;
 *   · decidere e l'anteprima non cambiano i dati vivi; l'avviso conta le modifiche non approvate;
 *   · un delegato o un lettore non approva;
 *   · l'approvazione riversa: l'unità prende sede e organico dal modello, il giornale lo registra;
 *   · «Scarta modifiche» toglie dalla bozza solo ciò che non è stato approvato.
 * L'isolamento transazionale del file annulla tutto a fine suite.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { tenantConsolidationService as svc } from "../src/modules/tenant-consolidation/service.js";
import { accese } from "../src/modules/tenant-consolidation/approvazione.js";
import { sceltaInCascata } from "../src/modules/tenant-consolidation/cascata.js";

let direttore: ActorContext;
let lettore: ActorContext;
let sessione = "";
let versione = "";
let unitaTenant = "";
let unitaModello = "";
let posizioneModello = "";
let propUnita = "";
let propPosizione = "";

async function ruoliDi(userId: string): Promise<RoleCode[]> {
  const r = await pool.query<{ code: string }>(
    `SELECT ro.auth_role_code AS code FROM sys.sys_user_auth_roles ur
       JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
      WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_revoked_at IS NULL`, [userId]);
  return r.rows.map((x) => x.code) as RoleCode[];
}

async function codiceDi(p: Promise<unknown>): Promise<string | null> {
  try { await p; return null; } catch (e) { return (e as { code?: string }).code ?? String(e); }
}

async function proposta(group: string, outcome: string, pk: string[], tk: string[]): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_tenant_consolidation_proposals
       (tenant_consolidation_proposal_consolidation_id, tenant_consolidation_proposal_group,
        tenant_consolidation_proposal_prototype_keys, tenant_consolidation_proposal_tenant_keys,
        tenant_consolidation_proposal_outcome, tenant_consolidation_proposal_method,
        tenant_consolidation_proposal_confidence, tenant_consolidation_proposal_reason, tenant_consolidation_proposal_round)
     VALUES ($1, $2, $3::text[], $4::text[], $5, 'SEMANTICA', 0.9, 'prova', 1) RETURNING tenant_consolidation_proposal_id AS id`,
    [sessione, group, pk, tk, outcome]);
  return r.rows[0]!.id;
}

const datiUnita = async () => (await pool.query<{ site: string | null; hc: number | null }>(
  `SELECT organization_unit_site_code AS site, organization_unit_planned_headcount AS hc
     FROM sys.sys_organization_units WHERE organization_unit_id = $1`, [unitaTenant])).rows[0]!;

beforeAll(async () => {
  await loadRolePermissionCache();
  const d = await pool.query<{ user_id: string; user_tenant_id: string }>(
    `SELECT u.user_id, u.user_tenant_id FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id AND r.auth_role_code = 'HRMS_MANAGER'
      WHERE u.user_status = 'ACTIVE' AND u.user_tenant_id IS NOT NULL ORDER BY u.user_id LIMIT 1`);
  const dir = d.rows[0]!;
  direttore = { userId: dir.user_id, tenantId: dir.user_tenant_id, roles: await ruoliDi(dir.user_id) };
  const l = await pool.query<{ user_id: string }>(
    `SELECT u.user_id FROM sys.sys_users u
      WHERE u.user_tenant_id = $1 AND u.user_status = 'ACTIVE' AND u.user_id <> $2 ORDER BY u.user_id LIMIT 1`,
    [direttore.tenantId, direttore.userId]);
  lettore = { userId: l.rows[0]!.user_id, tenantId: direttore.tenantId, roles: await ruoliDi(l.rows[0]!.user_id) };

  // un modello che porta un'unità con sede e organico e almeno una posizione in quell'unità
  const m = await pool.query<{ ver: string; unit: string; pos: string }>(
    `SELECT u.blueprint_content_unit_version_id AS ver, u.blueprint_content_unit_code AS unit,
            min(p.blueprint_content_position_code) AS pos
       FROM sys.sys_blueprint_content_units u
       JOIN sys.sys_blueprint_content_positions p
         ON p.blueprint_content_position_version_id = u.blueprint_content_unit_version_id
        AND p.blueprint_content_position_unit_code = u.blueprint_content_unit_code
      WHERE u.blueprint_content_unit_site_code IS NOT NULL AND u.blueprint_content_unit_planned_headcount IS NOT NULL
      GROUP BY 1, 2 ORDER BY 1, 2 LIMIT 1`);
  if (!m.rows[0]) throw new Error("nessun modello con unità, sede e posizioni: la corsa del datastore non è caricata?");
  ({ ver: versione, unit: unitaModello, pos: posizioneModello } = m.rows[0]);
  const u = await pool.query<{ id: string }>(
    `SELECT organization_unit_id AS id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id = $1 AND organization_unit_is_active ORDER BY organization_unit_code LIMIT 1`,
    [direttore.tenantId]);
  unitaTenant = u.rows[0]!.id;
  await pool.query(
    `UPDATE sys.sys_organization_units SET organization_unit_site_code = NULL, organization_unit_site_kind = NULL,
            organization_unit_planned_headcount = NULL, organization_unit_headcount_note = NULL
      WHERE organization_unit_id = $1`, [unitaTenant]);
  await pool.query(
    `UPDATE sys.sys_tenant_consolidations SET tenant_consolidation_status = 'CHIUSA'
      WHERE tenant_consolidation_tenant_id = $1 AND tenant_consolidation_status IN ('GIRI', 'IN_CONFERMA')`, [direttore.tenantId]);
  sessione = (await svc.start(direttore, { trigger: "RICHIESTA", variantVersionId: versione })).consolidationId;
  propUnita = await proposta("ORGANIZATION", "CORRISPONDENZA", [unitaModello], [unitaTenant]);
  propPosizione = await proposta("POSITIONS_ROLES", "LACUNA", [posizioneModello], []);
});

afterAll(async () => { await closePool(); });

describe("bozza, cascata e approvazione definitiva", () => {
  it("la cascata dell'unità viene dal modello e porta la sua posizione", async () => {
    const c = await svc.cascade(direttore, propUnita);
    expect(c.fields).toEqual(["SITE", "PLANNED_HEADCOUNT", "HEADCOUNT_NOTE"]);
    const pos = c.items.find((x) => x.proposalId === propPosizione);
    expect(pos).toMatchObject({ relation: "CONSEGUENZA", group: "POSITIONS_ROLES", outcome: "LACUNA", decision: null });
    expect(sceltaInCascata("CONFERMATA", "LACUNA")).toBe("ADOTTATA");
    expect(sceltaInCascata("RIFIUTATA", "LACUNA")).toBeNull();
  });

  it("«Aggiorna cascata» decide anche la posizione, e niente cambia nei dati vivi", async () => {
    const prima = await datiUnita();
    await svc.decide(direttore, propUnita, { decision: "CONFERMATA", form: "NORMALIZZATA", cascade: true });
    const c = await svc.cascade(direttore, propUnita);
    expect(c.items.find((x) => x.proposalId === propPosizione)?.decision).toBe("ADOTTATA");
    expect(await datiUnita()).toEqual(prima);
    const avviso = await svc.pendingApproval(direttore);
    expect(avviso).toMatchObject({ pending: 2, consolidationId: sessione });
    expect(avviso.since).not.toBeNull();
  });

  it("l'anteprima dice che cosa cambierebbe senza cambiarlo; un lettore non approva", async () => {
    const a = await svc.previewChanges(direttore, sessione);
    expect(a.result.applied).toBe(2);
    expect(a.result.changed).toBeGreaterThanOrEqual(2); // almeno sede e organico dell'unità
    expect(a.violations).toEqual([]);
    expect((await datiUnita()).site).toBeNull();
    expect(await codiceDi(svc.applyChanges(lettore, sessione))).toBe("PERMISSION_DENIED");
    expect(accese(new Map([["v_x", 0], ["v_y", 3]]), new Map([["v_x", 1], ["v_y", 2]]))).toEqual([{ view: "v_x", before: 0, after: 1 }]);
  });

  it("l'approvazione riversa: l'unità prende sede e organico dal modello, e l'avviso si spegne", async () => {
    const r = await svc.applyChanges(direttore, sessione);
    expect(r.applied).toBe(2);
    const dopo = await datiUnita();
    expect(dopo.site).not.toBeNull();
    expect(dopo.hc).not.toBeNull();
    const g = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM staging.tenant_consolidation_undo
        WHERE proposal_id = $1 AND column_name = 'organization_unit_site_code'`, [propUnita]);
    expect(g.rows[0]!.n).toBe(1);
    expect((await svc.pendingApproval(direttore)).pending).toBe(0);
  });

  it("«Scarta modifiche» toglie solo ciò che non è stato approvato", async () => {
    await svc.decide(direttore, propPosizione, { decision: "NON_ADOTTATA" });
    expect((await svc.pendingApproval(direttore)).pending).toBe(1);
    expect(await svc.discardChanges(direttore, sessione)).toEqual({ discarded: 1 });
    expect((await svc.pendingApproval(direttore)).pending).toBe(0);
    const c = await svc.cascade(direttore, propUnita);
    expect(c.items.find((x) => x.proposalId === propPosizione)?.decision).toBe("ADOTTATA");
  });
});
