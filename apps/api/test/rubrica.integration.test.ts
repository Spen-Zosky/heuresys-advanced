/**
 * apps/api/test/rubrica.integration.test.ts — GET /v1/me/rubrica (classe C2 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Che cosa si prova:
 *  - 401 senza sessione;
 *  - una persona del cliente riceve persone, posizioni e unità del SOLO suo cliente: i numeri
 *    attesi si derivano dal database, non si scrivono qui;
 *  - le persone sono scritte «Cognome, Nome»;
 *  - il perimetro sta nel servizio (I5): con un attore di un altro cliente la stessa funzione
 *    non restituisce nessuna persona del primo.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { leggiRubrica } from "../src/modules/rubrica/repository.js";
import type { RubricaResponse } from "@heuresys/shared";

const EMAIL = "paolo.caputo@rtl-bank.org";

describe("GET /v1/me/rubrica", () => {
  let t: TestApp;
  let cookie = "";
  let tenant = "";
  beforeAll(async () => {
    t = await buildTestApp();
    const login = await loginRaw(t.app, EMAIL, TEST_PERSONA_PASSWORD);
    cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const { rows } = await pool.query<{ tenant: string }>(
      `SELECT user_tenant_id AS tenant FROM sys.sys_users WHERE lower(user_email) = $1`, [EMAIL]);
    tenant = rows[0]!.tenant;
  });
  afterAll(async () => { await t.app.close(); });

  it("401 senza sessione", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/me/rubrica" });
    expect(r.statusCode).toBe(401);
  });

  it("persone, posizioni e unità del proprio cliente, con i nomi «Cognome, Nome»", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/me/rubrica", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as RubricaResponse;

    const { rows } = await pool.query<{ persone: number; posizioni: number; unita: number; cognome: string; nome: string }>(
      `SELECT (SELECT count(*)::int FROM sys.sys_users WHERE user_tenant_id = $1) AS persone,
              (SELECT count(*)::int FROM sys.sys_positions WHERE position_tenant_id = $1) AS posizioni,
              (SELECT count(*)::int FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1) AS unita,
              u.user_last_name AS cognome, u.user_first_name AS nome
         FROM sys.sys_users u WHERE lower(u.user_email) = $2`,
      [tenant, EMAIL],
    );
    const atteso = rows[0]!;
    expect(b.persone.length).toBe(atteso.persone);
    expect(b.posizioni.length).toBe(atteso.posizioni);
    expect(b.unita.length).toBe(atteso.unita);
    expect(b.persone.map((p) => p.etichetta)).toContain(`${atteso.cognome.trim()}, ${atteso.nome.trim()}`);

  });

  it("il perimetro sta nel servizio: un altro cliente non vede le persone di questo", async () => {
    const altro = randomUUID();
    const risposta = await leggiRubrica({ userId: randomUUID(), tenantId: altro, roles: ["USER"] } as never);
    expect(risposta.persone.length).toBe(0);
    expect(risposta.posizioni.length).toBe(0);
    expect(risposta.unita.length).toBe(0);
  });
});
