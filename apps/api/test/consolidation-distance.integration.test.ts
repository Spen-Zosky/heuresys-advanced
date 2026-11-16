/**
 * apps/api/test/consolidation-distance.integration.test.ts — la distanza fra tenant e modello di una corsa
 * (ADR-0059 D7, voce A2 del piano di allineamento).
 *
 * Il modello è una versione nuova con tre voci scritte qui: un'unità con il nome di un'unità vera del
 * tenant, una posizione con il titolo di una posizione vera di quell'unità, e un'unità che il tenant non
 * ha. Si prova che la misura riconosce le tre, che conta tutti i 24 domini nell'ordine dichiarato, che
 * non scrive niente (impronta delle unità e delle posizioni del tenant uguale prima e dopo) e che una
 * corsa di un altro tenant o inesistente non si legge. L'isolamento transazionale annulla tutto.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { tenantConsolidationService as svc } from "../src/modules/tenant-consolidation/service.js";
import { registraCorsa } from "../src/modules/tenant-consolidation/corse.js";
import { DOMINI_DISTANZA } from "../src/modules/tenant-consolidation/distanza.js";

let direttore: ActorContext;
let runId = "";
let unitaVera = "";
let posizioneVera = "";
const UNICA = "Unità che il tenant non ha, prova della distanza";

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
     VALUES ('PROVA_DISTANZA', 'Famiglia di prova della distanza') RETURNING blueprint_family_id AS id`);
  const v = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_variants (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name)
     VALUES ($1, 'p20261116000000dst', 'Modello di prova della distanza') RETURNING blueprint_variant_id AS id`, [fam.rows[0]!.id]);
  const vv = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_blueprint_variant_versions
       (blueprint_variant_version_variant_id, blueprint_variant_version_number, blueprint_variant_version_status)
     VALUES ($1, 1, 'DRAFT') RETURNING blueprint_variant_version_id AS id`, [v.rows[0]!.id]);
  const versione = vv.rows[0]!.id;
  await pool.query(
    `INSERT INTO sys.sys_blueprint_content_units
       (blueprint_content_unit_version_id, blueprint_content_unit_code, blueprint_content_unit_name, blueprint_content_unit_type)
     VALUES ($1, 'U-VERA', $2, 'DIVISION'), ($1, 'U-UNICA', $3, 'DIVISION')`, [versione, unitaVera, UNICA]);
  await pool.query(
    `INSERT INTO sys.sys_blueprint_content_positions
       (blueprint_content_position_version_id, blueprint_content_position_code, blueprint_content_position_title, blueprint_content_position_unit_code)
     VALUES ($1, 'P-VERA', $2, 'U-VERA')`, [versione, posizioneVera]);
  runId = await registraCorsa(pool, direttore.tenantId!, {
    code: "p20261116000000dst", packageVersion: 1, packageHash: "c".repeat(64), description: "Prova della distanza",
    executedFrom: null, executedTo: null,
  }, versione, direttore.userId);
});

afterAll(async () => {
  await closePool();
});

describe("distanza fra tenant e modello di una corsa", () => {
  it("conta i 24 domini nell'ordine dichiarato, con i totali coerenti", async () => {
    const m = await svc.distance(direttore, runId, { dettaglio: false });
    expect(m.domini.map((x) => x.dominio)).toEqual([...DOMINI_DISTANZA]);
    for (const x of m.domini) {
      expect(x.righe).toBe(x.uguali + x.parziali + x.diversi + x.solo_modello + x.solo_tenant);
      expect(x.dettaglio).toBeUndefined();
    }
    expect(m.totale.righe).toBe(m.domini.reduce((n, x) => n + x.righe, 0));
  });

  it("riconosce l'unità e la posizione uguali e quella che il tenant non ha", async () => {
    const m = await svc.distance(direttore, runId, { dettaglio: true });
    const unita = m.domini.find((x) => x.dominio === "unita")!;
    expect(unita.dettaglio).toContainEqual(expect.objectContaining({ esito: "uguale", modello: unitaVera, tenant: unitaVera }));
    expect(unita.dettaglio).toContainEqual(expect.objectContaining({ esito: "solo_modello", modello: UNICA, tenant: null }));
    expect(unita.solo_modello).toBe(1);
    const n = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1 AND organization_unit_is_active`,
      [direttore.tenantId]);
    expect(unita.uguali + unita.parziali + unita.solo_tenant).toBe(n.rows[0]!.n);
    const ruoli = m.domini.find((x) => x.dominio === "ruoli")!;
    expect(ruoli.dettaglio).toContainEqual(expect.objectContaining({ esito: "uguale", modello: posizioneVera, tenant: posizioneVera }));
    expect(ruoli.solo_modello).toBe(0);
  });

  it("filtra un dominio solo e non scrive niente", async () => {
    const prima = await impronta(direttore.tenantId!);
    const m = await svc.distance(direttore, runId, { dettaglio: false, dominio: "organigramma" });
    expect(m.domini.map((x) => x.dominio)).toEqual(["organigramma"]);
    expect(await impronta(direttore.tenantId!)).toBe(prima);
  });

  it("una corsa che non è del tenant non si legge", async () => {
    await expect(svc.distance(direttore, "00000000-0000-4000-8000-000000000000", { dettaglio: false }))
      .rejects.toMatchObject({ code: "BLUEPRINT_RUN_NOT_FOUND" });
  });
});
