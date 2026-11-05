/**
 * Piano interfacce, lotto L10 — A-14: l'origine del dato (I23, ADR-0041) visibile.
 *
 *  - `GET /v1/meta/data-origins` risponde solo a chi è autenticato e descrive, per modulo, le
 *    tabelle con lo stato dichiarato in `sys.sys_classificazione_direzione_dato` e l'origine
 *    riga per riga dove la tabella la porta;
 *  - ogni lettura JSON su /v1/* porta `x-heuresys-data-origin` con il riassunto del modulo;
 *  - il riassunto e il modulo di un percorso seguono regole fisse.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DATA_ORIGIN_HEADER, DATA_ORIGIN_SUMMARIES, type DataOriginsResponse } from "@heuresys/shared";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";
import { pool } from "../src/db/client.js";
import { moduloDelPercorso, riassunto } from "../src/lib/origine/origine.js";
import { MODULI_DELLE_TABELLE } from "../src/lib/origine/moduli.generated.js";
import { unCapoConSottoposti, unSottopostoOrganizzativo } from "./helpers/org-actors.js";

senzaCacheDiSessione();

let t: TestApp;
let cookie = "";

beforeAll(async () => {
  t = await buildTestApp();
  const capo = await unCapoConSottoposti(pool);
  const persona = await unSottopostoOrganizzativo(pool, capo.userId);
  const r = await loginRaw(t.app, persona.email);
  expect(r.statusCode, r.body).toBe(200);
  cookie = (r.cookies as { name: string; value: string }[]).map((c) => `${c.name}=${c.value}`).join("; ");
}, 60_000);

afterAll(async () => {
  await t.app.close();
});

describe("A-14 — le regole del riassunto e del modulo", () => {
  it("uno stato solo resta, stati diversi sono misto, l'infrastruttura non conta", () => {
    expect(riassunto([])).toBeNull();
    expect(riassunto([null])).toBeNull();
    expect(riassunto(["nativo", "nativo", null])).toBe("nativo");
    expect(riassunto(["nativo", "infrastruttura"])).toBe("nativo");
    expect(riassunto(["infrastruttura"])).toBe("infrastruttura");
    expect(riassunto(["nativo", "importato"])).toBe("misto");
  });

  it("il modulo è quello del prefisso più lungo, intero e non a metà parola", () => {
    expect(moduloDelPercorso("/v1/time-off/requests?x=1")).toBe("time-off");
    expect(moduloDelPercorso("/v1/time-off")).toBe("time-off");
    expect(moduloDelPercorso("/v1/time-offerta")).toBeNull();
    expect(moduloDelPercorso("/altro")).toBeNull();
  });
});

describe("A-14 — GET /v1/meta/data-origins", () => {
  it("senza sessione è 401", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/meta/data-origins" });
    expect(r.statusCode).toBe(401);
  });

  it("descrive ogni modulo con le tabelle classificate dal database", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/meta/data-origins", headers: { cookie } });
    expect(r.statusCode, r.body).toBe(200);
    const corpo = r.json() as DataOriginsResponse;
    expect(corpo.modules.map((m) => m.module)).toEqual(Object.keys(MODULI_DELLE_TABELLE).sort());

    // Ogni tabella, nella risposta, ha lo stato che il database dichiara.
    const db = await pool.query<{ tabella: string; stato: string }>(
      "SELECT tabella, stato FROM sys.sys_classificazione_direzione_dato",
    );
    const stati = new Map(db.rows.map((x) => [x.tabella, x.stato]));
    for (const m of corpo.modules) {
      for (const tab of m.tables) expect(tab.state, `${m.module}.${tab.table}`).toBe(stati.get(tab.table) ?? null);
      expect(m.origin, m.module).toBe(riassunto(m.tables.map((x) => x.state)));
    }

    // Le tabelle con `origine_dato` (X-2) sono dichiarate riga per riga.
    const col = await pool.query<{ tabella: string }>(
      "SELECT table_name AS tabella FROM information_schema.columns WHERE table_schema = 'sys' AND column_name = 'origine_dato'",
    );
    expect(col.rows.length).toBeGreaterThan(0);
    const perRiga = new Set(col.rows.map((x) => x.tabella));
    const timeOff = corpo.modules.find((m) => m.module === "time-off")!;
    for (const tab of timeOff.tables) expect(tab.perRow, tab.table).toBe(perRiga.has(tab.table));
    expect(timeOff.tables.some((x) => x.perRow)).toBe(true);
  });

  it("con path risponde il solo modulo di quel percorso", async () => {
    const r = await t.app.inject({
      method: "GET",
      url: "/v1/meta/data-origins?path=%2Fv1%2Ftime-off%2Frequests",
      headers: { cookie },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((r.json() as DataOriginsResponse).modules.map((m) => m.module)).toEqual(["time-off"]);
  });
});

describe("A-14 — ogni lettura dice da dove viene", () => {
  it("una lettura JSON su /v1/* porta l'origine del suo modulo", async () => {
    const meta = await t.app.inject({ method: "GET", url: "/v1/meta/data-origins?path=%2Fv1%2Fme%2Fprofile", headers: { cookie } });
    const atteso = (meta.json() as DataOriginsResponse).modules[0]?.origin;
    expect(atteso).toBeTruthy();
    const r = await t.app.inject({ method: "GET", url: "/v1/me/profile", headers: { cookie } });
    expect(r.statusCode, r.body).toBe(200);
    expect(DATA_ORIGIN_SUMMARIES).toContain(r.headers[DATA_ORIGIN_HEADER]);
    expect(r.headers[DATA_ORIGIN_HEADER]).toBe(atteso);
  });
});
