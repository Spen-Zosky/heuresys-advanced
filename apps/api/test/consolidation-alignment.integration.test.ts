/**
 * apps/api/test/consolidation-alignment.integration.test.ts — la scheda «Allineamento» (piano 20261118).
 *
 * Stesso modello di prova della distanza: un'unità con il nome di un'unità vera del tenant, una posizione con il
 * titolo di una posizione vera e un'unità che il tenant non ha. Si prova che la scheda porta i 24 domini con
 * famiglia e copertura, che propone Adotto per l'unità che manca, che il Direttore HR salva una bozza, la
 * approva con il pulsante rosso e scarta una bozza successiva tornando all'approvata, che una decisione non
 * ammessa o su una voce che non c'è si scarta con il motivo, che chi non ha `consolidation:decide` non salva, e
 * che niente di tutto questo cambia le unità e le posizioni del tenant. L'isolamento transazionale annulla tutto.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { tenantConsolidationService as svc } from "../src/modules/tenant-consolidation/service.js";
import { registraCorsa } from "../src/modules/tenant-consolidation/corse.js";
import { DOMINI_DISTANZA } from "../src/modules/tenant-consolidation/distanza.js";
import { vociDelPrototipo, vociDelTenant } from "../src/modules/tenant-consolidation/sorgenti.js";
import { CONSOLIDATION_GROUP_VALUES } from "@heuresys/shared";

let direttore: ActorContext;
let runId = "";
let versioneProva = "";
let unitaVera = "";
let posizioneVera = "";
const UNICA = "Unità che il tenant non ha, prova dell'allineamento";

async function impronta(tenantId: string): Promise<string> {
  const r = await pool.query<{ h: string }>(
    `SELECT md5(coalesce((SELECT string_agg(u::text, '|' ORDER BY u.organization_unit_id) FROM sys.sys_organization_units u
                           WHERE u.organization_unit_tenant_id = $1), '')
             || coalesce((SELECT string_agg(p::text, '|' ORDER BY p.position_id) FROM sys.sys_positions p
                           WHERE p.position_tenant_id = $1), '')) AS h`, [tenantId]);
  return r.rows[0]!.h;
}

beforeAll(async () => {
  await loadRolePermissionCache();
  const d = await pool.query<{ user_id: string; user_tenant_id: string }>(
    `SELECT u.user_id, u.user_tenant_id FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'consolidation:decide' AND u.user_status = 'ACTIVE' AND u.user_tenant_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur2 JOIN sys.sys_auth_roles r2 ON r2.auth_role_id = ur2.user_auth_role_role_id
                         WHERE ur2.user_auth_role_user_id = u.user_id AND ur2.user_auth_role_revoked_at IS NULL AND r2.auth_role_is_platform)
      ORDER BY u.user_id LIMIT 1`);
  const dir = d.rows[0];
  if (!dir) throw new Error("nessun utente con consolidation:decide");
  const ruoli = await pool.query<{ code: string }>(
    `SELECT ro.auth_role_code AS code FROM sys.sys_user_auth_roles ur JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
      WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_revoked_at IS NULL`, [dir.user_id]);
  direttore = { userId: dir.user_id, tenantId: dir.user_tenant_id, roles: ruoli.rows.map((x) => x.code) as RoleCode[] };

  // Una posizione attiva vera del tenant, con la sua unità: il modello le ripete con lo stesso nome.
  const p = await pool.query<{ titolo: string; unita: string }>(
    `SELECT x.position_title AS titolo, u.organization_unit_name AS unita
       FROM sys.sys_positions x JOIN sys.sys_organization_units u ON u.organization_unit_id = x.position_organization_unit_id
      WHERE x.position_tenant_id = $1 AND x.position_is_active AND u.organization_unit_is_active
      ORDER BY x.position_code LIMIT 1`, [direttore.tenantId]);
  if (!p.rows[0]) throw new Error("il tenant non ha posizioni attive");
  ({ titolo: posizioneVera, unita: unitaVera } = p.rows[0]);

  const fam = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name)
     VALUES ('PROVA_ALLINEAMENTO', 'Famiglia di prova dell''allineamento') RETURNING blueprint_family_id AS id`);
  const v = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_variants (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name)
     VALUES ($1, 'p20261118000000aln', 'Modello di prova dell''allineamento') RETURNING blueprint_variant_id AS id`, [fam.rows[0]!.id]);
  const vv = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_variant_versions
       (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status)
     VALUES ($1, 2, 'DRAFT') RETURNING blueprint_variant_version_id AS id`, [v.rows[0]!.id]);
  const versione = vv.rows[0]!.id;
  versioneProva = versione;
  await pool.query(
    `INSERT INTO sys.sys_blueprint_content_units
       (blueprint_content_unit_version_id, blueprint_content_unit_code, blueprint_content_unit_name, blueprint_content_unit_type)
     VALUES ($1, 'U-VERA', $2, 'DIVISION'), ($1, 'U-UNICA', $3, 'DIVISION')`, [versione, unitaVera, UNICA]);
  await pool.query(
    `INSERT INTO sys.sys_blueprint_content_positions
       (blueprint_content_position_version_id, blueprint_content_position_code, blueprint_content_position_title, blueprint_content_position_unit_code)
     VALUES ($1, 'P-VERA', $2, 'U-VERA')`, [versione, posizioneVera]);
  runId = await registraCorsa(pool, direttore.tenantId!, {
    code: "p20261118000000aln", packageVersion: 1, packageHash: "d".repeat(64), description: "Prova dell'allineamento",
    executedFrom: null, executedTo: null,
  }, versione, direttore.userId);
});

afterAll(async () => {
  await closePool();
});

describe("scheda Allineamento", () => {
  it("porta i 24 domini con famiglia e copertura, e propone Adotto per l'unità che manca", async () => {
    const a = await svc.alignment(direttore, runId);
    expect(a.domini.map((x) => x.dominio)).toEqual([...DOMINI_DISTANZA]);
    expect(a.puoDecidere).toBe(true);
    const unita = a.domini.find((x) => x.dominio === "unita")!;
    expect(unita).toMatchObject({ famiglia: "organizzazione", copertura: "GIRI" });
    expect(unita.righe_voci.length).toBe(unita.righe);
    expect(unita.righe_voci).toContainEqual(expect.objectContaining({ esito: "solo_modello", modello: UNICA, proposta: "ADOTTO", bozza: null }));
    expect(unita.righe_voci).toContainEqual(expect.objectContaining({ esito: "uguale", modello: unitaVera, proposta: null }));
    expect(a.domini.find((x) => x.dominio === "obblighi")!.copertura).toBe("MISURA");
  });

  it("salva una bozza, la approva, scarta la bozza dopo e torna all'approvata, senza toccare il tenant", async () => {
    const prima = await impronta(direttore.tenantId!);
    const a = await svc.alignment(direttore, runId);
    const voce = a.domini.find((x) => x.dominio === "unita")!.righe_voci.find((r) => r.modello === UNICA)!;
    const uguale = a.domini.find((x) => x.dominio === "unita")!.righe_voci.find((r) => r.esito === "uguale")!;

    const s = await svc.alignmentDrafts(direttore, runId, { voci: [
      { dominio: "unita", chiave: voce.chiave, decisione: "ADOTTO" },
      { dominio: "unita", chiave: voce.chiave, decisione: "UNISCO" },
      { dominio: "unita", chiave: uguale.chiave, decisione: "TOLGO" },
      { dominio: "unita", chiave: "0".repeat(32), decisione: "TENGO" },
    ] });
    expect(s.salvate).toBe(1);
    expect(s.scartate.map((x) => x.chiave)).toEqual([voce.chiave, uguale.chiave, "0".repeat(32)]);
    let b = await svc.alignment(direttore, runId);
    expect(b.decisioni).toMatchObject({ bozze: 1, approvate: 0 });

    const ok = await svc.alignmentApprove(direttore, runId);
    expect(ok.approvate).toBe(1);
    b = await svc.alignment(direttore, runId);
    expect(b.decisioni).toMatchObject({ bozze: 0, approvate: 1, superate: 0 });
    expect(b.domini.find((x) => x.dominio === "unita")!.righe_voci.find((r) => r.chiave === voce.chiave))
      .toMatchObject({ bozza: null, approvata: "ADOTTO" });

    await svc.alignmentDrafts(direttore, runId, { voci: [{ dominio: "unita", chiave: voce.chiave, decisione: "TOLGO" }] });
    b = await svc.alignment(direttore, runId);
    expect(b.decisioni.bozze).toBe(1);
    expect((await svc.alignmentDiscard(direttore, runId)).scartate).toBe(1);
    b = await svc.alignment(direttore, runId);
    expect(b.domini.find((x) => x.dominio === "unita")!.righe_voci.find((r) => r.chiave === voce.chiave))
      .toMatchObject({ bozza: null, approvata: "ADOTTO" });

    expect(await impronta(direttore.tenantId!)).toBe(prima);
  });

  it("chi non ha consolidation:decide non salva né approva", async () => {
    const lettore: ActorContext = { ...direttore, roles: ["USER" as RoleCode] };
    await expect(svc.alignmentDrafts(lettore, runId, { voci: [{ dominio: "unita", chiave: "0".repeat(32), decisione: "TENGO" }] }))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(svc.alignmentApprove(lettore, runId)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("una corsa che non è del tenant non si approva", async () => {
    await expect(svc.alignmentApprove(direttore, "00000000-0000-4000-8000-000000000000"))
      .rejects.toMatchObject({ code: "BLUEPRINT_RUN_NOT_FOUND" });
  });
});

describe("S1: i giri leggono l'indirizzo ESCO dalla colonna", () => {
  it("la competenza e la posizione del modello portano l'ESCO della colonna, non dei metadati vuoti", async () => {
    const esco = "http://data.europa.eu/esco/skill/prova-s1-allineamento";
    const occ = "http://data.europa.eu/esco/occupation/prova-s1-allineamento";
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_skills
         (blueprint_content_skill_version_id, blueprint_content_skill_code, blueprint_content_skill_name, blueprint_content_skill_esco_uri)
       VALUES ($1, 'S-ESCO', 'Competenza di prova S1', $2)`, [versioneProva, esco]);
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_job_roles
         (blueprint_content_job_role_version_id, blueprint_content_job_role_code, blueprint_content_job_role_name, blueprint_content_job_role_esco_uri)
       VALUES ($1, 'JR-S1', 'Ruolo di prova S1', $2)`, [versioneProva, occ]);
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_positions
         (blueprint_content_position_version_id, blueprint_content_position_code, blueprint_content_position_title,
          blueprint_content_position_unit_code, blueprint_content_position_job_role_code)
       VALUES ($1, 'P-S1', 'Posizione di prova S1', 'U-UNICA', 'JR-S1')`, [versioneProva]);
    const skills = await vociDelPrototipo(pool, versioneProva, "SKILLS");
    expect(skills.find((v) => v.key === "S-ESCO")).toMatchObject({ escoUri: esco });
    const pos = await vociDelPrototipo(pool, versioneProva, "POSITIONS_ROLES");
    expect(pos.find((v) => v.key === "P-S1")).toMatchObject({ escoUri: occ, type: "JR-S1" });
    expect(pos.filter((v) => v.key === "P-VERA")).toHaveLength(1);
  });
});

describe("SA5: i giri guardano i sei cataloghi con nome", () => {
  it("i gruppi nuovi stanno in coda, dopo i cinque di prima", () => {
    expect(CONSOLIDATION_GROUP_VALUES.slice(0, 5)).toEqual(["ORGANIZATION", "POSITIONS_ROLES", "SKILLS", "PROCESSES", "INDICATORS_GOALS"]);
    expect(CONSOLIDATION_GROUP_VALUES.slice(5)).toEqual(["CONTRACTS", "OBLIGATIONS", "TRAINING", "CAREERS", "INCENTIVES", "ENGAGEMENTS"]);
  });

  it("i vincoli del registro accettano i gruppi nuovi (000500)", async () => {
    const { rows } = await pool.query<{ conname: string; def: string }>(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname IN ('sys_tenant_consolidations_group_ck', 'sys_tenant_consolidation_rounds_group_ck',
                          'sys_tenant_consolidation_working_items_group_ck', 'sys_tenant_consolidation_proposals_group_ck',
                          'sys_platform_vocabulary_equivalences_group_ck', 'sys_tenant_consolidation_links_group_ck',
                          'sys_user_delegations_groups_ck')`);
    expect(rows).toHaveLength(7);
    for (const r of rows) {
      for (const g of CONSOLIDATION_GROUP_VALUES) expect(r.def, r.conname).toContain(g);
    }
    // La delega tiene la clausola che la 000465 pretende: alla passata dopo la 000465 non la riscrive.
    expect(rows.find((r) => r.conname === "sys_user_delegations_groups_ck")!.def).toContain("user_delegation_groups IS NOT NULL");
  });

  it("il lato del modello porta contratti e livelli, obblighi, formazione, carriere, incentivi e commesse", async () => {
    const V = versioneProva;
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_ccnl (blueprint_content_ccnl_version_id, blueprint_content_ccnl_code, blueprint_content_ccnl_name)
       VALUES ($1, 'CCNL-P', 'CCNL di prova')`, [V]);
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_ccnl_levels
         (blueprint_content_ccnl_level_version_id, blueprint_content_ccnl_level_ccnl_code, blueprint_content_ccnl_level_code,
          blueprint_content_ccnl_level_name, blueprint_content_ccnl_level_category)
       VALUES ($1, 'CCNL-P', 'L1', 'Primo livello di prova', 'IMPIEGATO')`, [V]);
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_obligations
         (blueprint_content_obligation_version_id, blueprint_content_obligation_code, blueprint_content_obligation_norm,
          blueprint_content_obligation_scope, blueprint_content_obligation_subject)
       VALUES ($1, 'OB-P', 'Norma di prova', 'SICUREZZA', 'Obbligo di prova')`, [V]);
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_training
         (blueprint_content_training_version_id, blueprint_content_training_code, blueprint_content_training_title, blueprint_content_training_kind)
       VALUES ($1, 'TR-P', 'Corso di prova', 'CORSO')`, [V]);
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_career_paths
         (blueprint_content_career_version_id, blueprint_content_career_code, blueprint_content_career_name, blueprint_content_career_kind)
       VALUES ($1, 'CA-P', 'Percorso di prova', 'VERTICAL')`, [V]);
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_incentives
         (blueprint_content_incentive_version_id, blueprint_content_incentive_code, blueprint_content_incentive_name, blueprint_content_incentive_kind)
       VALUES ($1, 'IN-P', 'Premio di prova', 'MBO')`, [V]);
    await pool.query(
      `INSERT INTO sys.sys_blueprint_content_engagements
         (blueprint_content_engagement_version_id, blueprint_content_engagement_code, blueprint_content_engagement_name, blueprint_content_engagement_kind)
       VALUES ($1, 'EN-P', 'Commessa di prova', 'ALTRO')`, [V]);

    const contratti = await vociDelPrototipo(pool, V, "CONTRACTS");
    expect(contratti.find((v) => v.key === "CCNL:CCNL-P")).toMatchObject({ name: "CCNL di prova", type: "CCNL" });
    expect(contratti.find((v) => v.key === "LIV:CCNL-P|L1")).toMatchObject({ name: "Primo livello di prova", parentName: "CCNL di prova", level: "IMPIEGATO" });
    expect((await vociDelPrototipo(pool, V, "OBLIGATIONS")).find((v) => v.key === "OB-P")).toMatchObject({ name: "Obbligo di prova", type: "SICUREZZA" });
    expect((await vociDelPrototipo(pool, V, "TRAINING")).find((v) => v.key === "TR-P")).toMatchObject({ name: "Corso di prova", level: "CORSO" });
    expect((await vociDelPrototipo(pool, V, "CAREERS")).find((v) => v.key === "CA-P")).toMatchObject({ name: "Percorso di prova" });
    expect((await vociDelPrototipo(pool, V, "INCENTIVES")).find((v) => v.key === "IN-P")).toMatchObject({ name: "Premio di prova", type: "MBO" });
    expect((await vociDelPrototipo(pool, V, "ENGAGEMENTS")).find((v) => v.key === "EN-P")).toMatchObject({ name: "Commessa di prova" });
  });

  it("il lato del tenant si legge per ogni gruppo nuovo, senza identificativi di persona; gli obblighi sono vuoti", async () => {
    expect(await vociDelTenant(pool, direttore.tenantId!, "OBLIGATIONS")).toEqual([]);
    for (const g of ["CONTRACTS", "TRAINING", "CAREERS", "INCENTIVES", "ENGAGEMENTS"] as const) {
      const voci = await vociDelTenant(pool, direttore.tenantId!, g);
      for (const v of voci) expect(v.name, `${g} ${v.key}`).toBeTruthy();
      expect(new Set(voci.map((v) => v.key)).size, g).toBe(voci.length);
    }
    const contratti = await vociDelTenant(pool, direttore.tenantId!, "CONTRACTS");
    for (const v of contratti) expect(v.key).toMatch(/^(CCNL:|LIV:)/);
  });
});
