/**
 * apps/api/test/positions-peso-economico.integration.test.ts
 *
 * S-7 del piano interfacce (docs/piani/PIANO_interfacce_20261103.md; analisi V4 D-03,
 * decisione 5 confermata da Enzo il 2026-11-03). Il peso economico di una posizione e'
 * una retribuzione indiretta: `compensation/profiles/position/:id` lo mascherava gia', e
 * `/v1/positions` lo consegnava in chiaro a chiunque avesse `position:read`.
 *
 * Chi non legge `COMPENSATION` in chiaro (M1: tutti tranne il mandato HR) riceve la riga
 * senza `economicWeight` e senza `ownerUserId`, dichiarati in `masked`; nel profilo della
 * posizione anche `compensationProfile`. Il proprietario vede di esserlo (I17).
 *
 * PERCHE' PUO' FALLIRE. Sul codice di prima il tecnico e il capo ricevono il peso: la prova
 * e' rossa. E il contrario e' provato: l'HR lo riceve ancora, o la prova passerebbe anche
 * con un servizio che toglie il campo a tutti.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PLATFORM_EMAIL = "platform-test-admin@collaudo.invalid";
const HR_MANDATE_EMAIL = "federica.marchetti@rtl-bank.org";
const MANAGER_EMAIL = "paolo.caputo@rtl-bank.org";

type Riga = {
  positionId: string;
  ownerUserId?: string | null;
  economicWeight?: number | null;
  masked?: string[];
};

let t: TestApp;
const cookie: Record<string, string> = {};
let posConPeso = "";
let posDelCapo = "";
let capoUserId = "";

async function get<T>(chi: string, url: string): Promise<{ status: number; body: T }> {
  const r = await t.app.inject({ method: "GET", url, headers: { cookie: cookie[chi] ?? "" } });
  return { status: r.statusCode, body: r.json() as T };
}

describe("S-7 — il peso economico della posizione solo a chi vede le retribuzioni", () => {
  beforeAll(async () => {
    t = await buildTestApp();
    for (const email of [PLATFORM_EMAIL, HR_MANDATE_EMAIL, MANAGER_EMAIL]) {
      const r = await loginRaw(t.app, email);
      cookie[email] = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    }
    const conPeso = await pool.query<{ id: string }>(
      `SELECT p.position_id AS id FROM sys.sys_positions p
         JOIN sys.sys_tenancies tn ON tn.tenant_id = p.position_tenant_id AND tn.tenant_code = 'RTL_BANK'
        WHERE p.position_economic_weight IS NOT NULL AND p.position_owner_user_id IS NOT NULL
        ORDER BY p.position_code LIMIT 1`,
    );
    posConPeso = conPeso.rows[0]?.id ?? "";
    const delCapo = await pool.query<{ id: string; owner: string }>(
      `SELECT p.position_id AS id, p.position_owner_user_id AS owner FROM sys.sys_positions p
        WHERE p.position_owner_user_id =
              (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = $1)
        ORDER BY p.position_code LIMIT 1`,
      [MANAGER_EMAIL],
    );
    posDelCapo = delCapo.rows[0]?.id ?? "";
    capoUserId = delCapo.rows[0]?.owner ?? "";
  });
  afterAll(async () => {
    await t.app.close();
    await closePool();
  });

  it("il tecnico di piattaforma riceve la posizione senza peso né proprietario, dichiarati", async () => {
    expect(posConPeso, "nessuna posizione RTL con peso e proprietario: la prova non misurerebbe nulla").not.toBe("");
    const r = await get<Riga>(PLATFORM_EMAIL, `/v1/positions/${posConPeso}`);
    expect(r.status).toBe(200);
    expect(r.body.economicWeight).toBeUndefined();
    expect(r.body.ownerUserId).toBeUndefined();
    expect(r.body.masked).toEqual(["economicWeight", "ownerUserId"]);

    const elenco = await get<{ items: Riga[] }>(PLATFORM_EMAIL, "/v1/positions?limit=50");
    expect(elenco.status).toBe(200);
    expect(elenco.body.items.length).toBeGreaterThan(0);
    expect(elenco.body.items.every((p) => p.economicWeight === undefined)).toBe(true);

    const pip = await get<Riga & { compensationProfile?: unknown }>(
      PLATFORM_EMAIL,
      `/v1/positions/${posConPeso}/intelligence-profile`,
    );
    expect(pip.status).toBe(200);
    expect("compensationProfile" in pip.body).toBe(false);
    expect(pip.body.masked).toEqual(["compensationProfile", "economicWeight", "ownerUserId"]);
  });

  it("il capo di una catena non riceve il peso; della propria posizione vede di esserne proprietario", async () => {
    expect(posDelCapo, "il capo di collaudo non possiede una posizione").not.toBe("");
    const r = await get<Riga>(MANAGER_EMAIL, `/v1/positions/${posDelCapo}`);
    expect(r.status).toBe(200);
    expect(r.body.economicWeight).toBeUndefined();
    expect(r.body.ownerUserId).toBe(capoUserId); // I17
    expect(r.body.masked).toEqual(["economicWeight"]);

    const altra = await get<Riga>(MANAGER_EMAIL, `/v1/positions/${posConPeso}`);
    if (altra.status === 200 && altra.body.ownerUserId !== capoUserId) {
      expect(altra.body.ownerUserId).toBeUndefined();
      expect(altra.body.masked).toEqual(["economicWeight", "ownerUserId"]);
    }
  });

  it("chi ha il mandato HR riceve ancora peso e proprietario", async () => {
    const r = await get<Riga>(HR_MANDATE_EMAIL, `/v1/positions/${posConPeso}`);
    expect(r.status).toBe(200);
    expect(typeof r.body.economicWeight).toBe("number");
    expect(typeof r.body.ownerUserId).toBe("string");
    expect(r.body.masked).toBeUndefined();

    const pip = await get<Riga & { compensationProfile?: unknown }>(
      HR_MANDATE_EMAIL,
      `/v1/positions/${posConPeso}/intelligence-profile`,
    );
    expect(pip.status).toBe(200);
    expect("compensationProfile" in pip.body).toBe(true);
    expect(pip.body.masked).toBeUndefined();
  });
});
