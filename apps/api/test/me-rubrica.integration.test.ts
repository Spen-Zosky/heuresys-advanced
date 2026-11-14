/**
 * apps/api/test/me-rubrica.integration.test.ts — GET /v1/me/rubrica (classe C2 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Che cosa si prova:
 *  - una persona di un tenant riceve solo persone, posizioni e unità del suo tenant;
 *  - le persone sono scritte «Cognome, Nome» quando hanno cognome e nome, e ordinate per cognome;
 *  - chi non è autenticato riceve 401.
 * I numeri attesi si derivano dal database, non si scrivono qui.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

type Rubrica = {
  persone: { id: string; etichetta: string }[];
  posizioni: { id: string; titolo: string }[];
  unita: { id: string; nome: string }[];
};

describe("GET /v1/me/rubrica", () => {
  let t: TestApp;
  beforeAll(async () => { t = await buildTestApp(); });
  afterAll(async () => { await t.app.close(); });

  it("401 senza sessione", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/me/rubrica" });
    expect(r.statusCode).toBe(401);
  });

  it("una persona del tenant vede solo il suo tenant, «Cognome, Nome», in ordine di cognome", async () => {
    const email = "paolo.caputo@rtl-bank.org";
    const login = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
    const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const r = await t.app.inject({ method: "GET", url: "/v1/me/rubrica", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as Rubrica;

    const { rows } = await pool.query<{ persone: string; posizioni: string; unita: string; cognome: string; nome: string }>(
      `SELECT (SELECT count(*) FROM sys.sys_users x WHERE x.user_tenant_id = u.user_tenant_id)::text AS persone,
              (SELECT count(*) FROM sys.sys_positions p WHERE p.position_tenant_id = u.user_tenant_id)::text AS posizioni,
              (SELECT count(*) FROM sys.sys_organization_units o WHERE o.organization_unit_tenant_id = u.user_tenant_id)::text AS unita,
              u.user_last_name AS cognome, u.user_first_name AS nome
         FROM sys.sys_users u WHERE lower(u.user_email) = $1`,
      [email],
    );
    const atteso = rows[0]!;
    expect(b.persone.length).toBe(Number(atteso.persone));
    expect(b.posizioni.length).toBe(Number(atteso.posizioni));
    expect(b.unita.length).toBe(Number(atteso.unita));
    expect(b.persone.map((p) => p.etichetta)).toContain(`${atteso.cognome}, ${atteso.nome}`);
    const cognomi = b.persone.map((p) => p.etichetta.split(",")[0]!.toLowerCase()).filter((c) => !c.includes("@"));
    const ordinati = [...cognomi].sort((a, b2) => a.localeCompare(b2, "en", { sensitivity: "base" }));
    expect(cognomi.slice(0, 20)).toEqual(ordinati.slice(0, 20));
  });
});
