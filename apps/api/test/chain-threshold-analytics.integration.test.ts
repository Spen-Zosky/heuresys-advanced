/**
 * apps/api/test/chain-threshold-analytics.integration.test.ts — #99 F4, gli AGGREGATI.
 *
 * La soglia di catena non si aggira solo leggendo la busta paga di un vertice: si aggira
 * anche guardando un grafico che non nomina nessuno.
 *
 * MISURATO IL 2026-08-14, prima di correggere: nell'albero delle unità il livello 1 ha
 * **un solo** profilo retributivo, banda 220.000 €, ed è il massimo assoluto dell'azienda
 * (livello 2: 14 profili, max 150.000). Quindi in `/v1/analytics/compensation` il punto più
 * alto dello scatter non era una statistica — era il CEO — e `overallMaxMidEur` ne ripeteva
 * la cifra. Un mandato HR di livello 3 li leggeva entrambi.
 *
 * Le due asserzioni che contano sono una coppia, e nessuna delle due basta da sola:
 *   1. i profili delle unità di vertice spariscono dallo scatter;
 *   2. il massimo complessivo scende sotto la banda del vertice — perché togliere il punto
 *      lasciando il massimo significa nascondere l'addendo e pubblicare la somma.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { LIVELLO_VERTICE } from "../src/lib/scope/mask.js";
import { analyticsService } from "../src/modules/analytics/service.js";
import type { ActorContext } from "../src/lib/actor.js";

let t: TestApp;

/** La banda più alta che sta in un'unità di vertice, e quella più alta fuori. */
interface Universo {
  bandaVertice: number;
  profiliVertice: number;
  bandaSottoSoglia: number;
}
let u: Universo | undefined;
let hrSottoSoglia: { id: string; tenantId: string; livello: number } | undefined;

const ALBERO = `WITH RECURSIVE albero AS (
     SELECT organization_unit_id AS ou, 1 AS livello FROM sys.sys_organization_units
      WHERE organization_unit_parent_id IS NULL AND organization_unit_is_active
     UNION ALL
     SELECT o.organization_unit_id, a.livello + 1 FROM sys.sys_organization_units o
       JOIN albero a ON o.organization_unit_parent_id = a.ou WHERE o.organization_unit_is_active
   )`;

beforeAll(async () => {
  t = await buildTestApp();

  const r = await pool.query<{ banda_vertice: string | null; profili_vertice: string; banda_sotto: string | null }>(
    `${ALBERO}
     SELECT max(b.compensation_band_mid_eur) FILTER (WHERE a.livello <= $1)::text AS banda_vertice,
            count(*) FILTER (WHERE a.livello <= $1)::text AS profili_vertice,
            max(b.compensation_band_mid_eur) FILTER (WHERE a.livello > $1)::text AS banda_sotto
       FROM sys.sys_position_compensation_profiles pcp
       JOIN sys.sys_positions p ON p.position_id = pcp.position_id
       JOIN sys.sys_compensation_bands b ON b.compensation_band_id = pcp.compensation_band_id
       JOIN albero a ON a.ou = p.position_organization_unit_id`,
    [LIVELLO_VERTICE],
  );
  const row = r.rows[0];
  if (row?.banda_vertice != null && row.banda_sotto != null) {
    u = {
      bandaVertice: Number(row.banda_vertice),
      profiliVertice: Number(row.profili_vertice),
      bandaSottoSoglia: Number(row.banda_sotto),
    };
  }

  const h = await pool.query<{ id: string; tenant_id: string; livello: string }>(
    `${ALBERO}
     SELECT u.user_id AS id, u.user_tenant_id AS tenant_id, min(a.livello)::text AS livello
       FROM albero a
       JOIN sys.sys_positions p ON p.position_organization_unit_id = a.ou
       JOIN sys.sys_user_position_assignments upa
            ON upa.user_position_assignment_position_id = p.position_id
           AND upa.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_users u ON u.user_id = upa.user_position_assignment_user_id AND u.user_status = 'ACTIVE'
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE r.auth_role_code IN ('HRMS_MANAGER', 'TENANT_ADMIN')
      GROUP BY u.user_id, u.user_tenant_id
     HAVING min(a.livello) > $1
      LIMIT 1`,
    [LIVELLO_VERTICE],
  );
  const hr = h.rows[0];
  if (hr) hrSottoSoglia = { id: hr.id, tenantId: hr.tenant_id, livello: Number(hr.livello) };
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#99 F4 — la soglia di catena sugli aggregati retributivi", () => {
  it("gira su un universo dove PUÒ fallire: un vertice retribuito più caro di tutti, e un mandato HR sotto soglia", () => {
    if (!u || !hrSottoSoglia) {
      throw new Error(
        "Manca un profilo retributivo di vertice, oppure un mandato HR sotto la soglia: " +
          "senza i due questa verifica non guarda niente e non va contata fra le superate.",
      );
    }
    expect(u.profiliVertice).toBeGreaterThan(0);
    // Se il vertice NON fosse il più pagato, togliere i vertici non muoverebbe il massimo
    // e l'asserzione (2) sarebbe vera per caso invece che per la correzione.
    expect(u.bandaVertice).toBeGreaterThan(u.bandaSottoSoglia);
  });

  it("un mandato HR sotto soglia non riceve i profili di vertice, e il massimo non li tradisce", async () => {
    const attore = {
      userId: hrSottoSoglia!.id,
      tenantId: hrSottoSoglia!.tenantId,
      roles: ["HRMS_MANAGER"],
    } as unknown as ActorContext;

    const r = (await analyticsService.compensation(attore)) as unknown as {
      scatter?: { midEur: number }[];
      overallMaxMidEur?: number | null;
    };

    // (1) nessun punto alla banda del vertice
    for (const p of r.scatter ?? []) {
      expect(p.midEur, "un profilo di vertice è rimasto nello scatter").toBeLessThan(u!.bandaVertice);
    }
    // (2) e il massimo complessivo è sceso con lui
    if (r.overallMaxMidEur != null) {
      expect(
        r.overallMaxMidEur,
        "lo scatter non mostra più il vertice ma il massimo lo ripete: l'addendo è nascosto e la somma no",
      ).toBeLessThan(u!.bandaVertice);
    }
  });
});
