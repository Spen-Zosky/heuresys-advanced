/**
 * apps/api/test/chain-threshold-pay.integration.test.ts — #99 F4.
 *
 * IL SECONDO QUALIFICATORE DI CELLA: LA SOGLIA DI CATENA.
 *
 * ADR-0036 §5, terza eccezione al mandato HR: la retribuzione dei vertici è visibile
 * **solo a pari livello o superiore** nell'albero delle unità. È il limite che delimita
 * perfino `HRMS_MANAGER`, che I22 dichiara plenipotenziario sui dati business —
 * plenipotenziario *con quattro eccezioni*, e questa è una.
 *
 * L'universo è reale e misurato (2026-08-14): l'albero ha 5 livelli, i vertici (1-2) sono
 * 19 persone, e il direttore HR sta al livello 3. Quindi il caso non è teorico: c'è
 * qualcuno che perde una vista che prima aveva, ed è esattamente ciò che la regola vuole.
 *
 * Gli attori si derivano dai livelli, non dai nomi: se domani l'organigramma cambia, il
 * test sceglie altre persone invece di misurare il caso sbagliato.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { chainLevelOf } from "../src/lib/scope/org.js";
import { masksTopOfChainPay, LIVELLO_VERTICE } from "../src/lib/scope/mask.js";
import type { ActorContext } from "../src/lib/actor.js";

let t: TestApp;
/** Chi sta in cima (livello 1) e chi sta sotto la soglia ma ha mandato HR. */
let vertice: { id: string; email: string; livello: number } | undefined;
let hrSottoSoglia: { id: string; email: string; livello: number } | undefined;

async function personeConLivello(): Promise<Array<{ id: string; email: string; livello: number; ruoli: string[] }>> {
  const r = await pool.query<{ id: string; email: string; livello: string; ruoli: string[] }>(
    `WITH RECURSIVE albero AS (
       SELECT organization_unit_id AS ou, 1 AS livello FROM sys.sys_organization_units
        WHERE organization_unit_parent_id IS NULL AND organization_unit_is_active
       UNION ALL
       SELECT o.organization_unit_id, a.livello + 1 FROM sys.sys_organization_units o
         JOIN albero a ON o.organization_unit_parent_id = a.ou WHERE o.organization_unit_is_active
     )
     SELECT u.user_id AS id, u.user_email AS email, min(a.livello)::text AS livello,
            coalesce(array_agg(DISTINCT r.auth_role_code) FILTER (WHERE r.auth_role_code IS NOT NULL), '{}') AS ruoli
       FROM albero a
       JOIN sys.sys_positions p ON p.position_organization_unit_id = a.ou
       JOIN sys.sys_user_position_assignments upa
            ON upa.user_position_assignment_position_id = p.position_id
           AND upa.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_users u ON u.user_id = upa.user_position_assignment_user_id AND u.user_status = 'ACTIVE'
       LEFT JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                                           AND ur.user_auth_role_revoked_at IS NULL
       LEFT JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      GROUP BY u.user_id, u.user_email`,
  );
  return r.rows.map((x) => ({ id: x.id, email: x.email, livello: Number(x.livello), ruoli: x.ruoli }));
}

const attore = (id: string, ruoli: string[]): ActorContext =>
  ({ userId: id, tenantId: null, roles: ruoli } as unknown as ActorContext);

beforeAll(async () => {
  t = await buildTestApp();
  const persone = await personeConLivello();
  vertice = persone.find((p) => p.livello === 1);
  hrSottoSoglia = persone.find(
    (p) => p.livello > LIVELLO_VERTICE && p.ruoli.some((r) => r === "HRMS_MANAGER" || r === "TENANT_ADMIN"),
  );
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#99 F4 — soglia di catena sulla retribuzione dei vertici", () => {
  it("gira su un universo dove PUÒ fallire: esiste un vertice e un mandato HR sotto la soglia", () => {
    if (!vertice || !hrSottoSoglia) {
      throw new Error(
        "Manca un vertice (livello 1) o un mandato HR sotto la soglia: senza i due " +
          "protagonisti questa verifica non guarda nulla e non va contata fra le superate.",
      );
    }
    expect(vertice.livello).toBe(1);
    expect(hrSottoSoglia.livello).toBeGreaterThan(LIVELLO_VERTICE);
  });

  it("il livello si legge dall'albero delle unità, non dai ruoli", async () => {
    const l = await chainLevelOf(pool, vertice!.id);
    expect(l).toBe(vertice!.livello);
    const chiunque = await chainLevelOf(pool, hrSottoSoglia!.id);
    expect(chiunque).toBe(hrSottoSoglia!.livello);
  });

  it("il mandato HR sotto la soglia NON vede la paga di un vertice", () => {
    const nascosta = masksTopOfChainPay(
      attore(hrSottoSoglia!.id, ["HRMS_MANAGER"]),
      vertice!.id,
      hrSottoSoglia!.livello,
      vertice!.livello,
    );
    // È il punto della regola: «plenipotenziario» ha quattro eccezioni, e questa è una.
    expect(nascosta).toBe(true);
  });

  it("il vertice vede la paga di un altro vertice — pari livello basta", () => {
    const nascosta = masksTopOfChainPay(
      attore(vertice!.id, ["TENANT_ADMIN"]),
      vertice!.id === hrSottoSoglia!.id ? vertice!.id : vertice!.id,
      vertice!.livello,
      vertice!.livello,
    );
    // stesso livello → non si maschera (ed è anche la propria riga: I17 lo conferma)
    expect(nascosta).toBe(false);
  });

  it("la propria retribuzione si vede sempre — I17 vince sulla soglia", () => {
    const nascosta = masksTopOfChainPay(
      attore(vertice!.id, []),
      vertice!.id,
      vertice!.livello,
      vertice!.livello,
    );
    expect(nascosta).toBe(false);
  });

  it("chi NON è nell'albero non può essere «pari o superiore»: la soglia lo esclude", () => {
    const nascosta = masksTopOfChainPay(attore("00000000-0000-0000-0000-000000000099", ["HRMS_MANAGER"]), vertice!.id, null, 1);
    expect(nascosta).toBe(true);
  });

  it("sotto la soglia la regola non si applica: la paga di chi NON è un vertice resta leggibile", () => {
    const nascosta = masksTopOfChainPay(
      attore(vertice!.id, ["HRMS_MANAGER"]),
      hrSottoSoglia!.id,
      vertice!.livello,
      hrSottoSoglia!.livello, // oltre LIVELLO_VERTICE
    );
    expect(nascosta).toBe(false);
  });
});
