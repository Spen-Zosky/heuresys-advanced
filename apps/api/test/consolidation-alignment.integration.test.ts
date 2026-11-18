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
import { vociDelPrototipo } from "../src/modules/tenant-consolidation/sorgenti.js";

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
