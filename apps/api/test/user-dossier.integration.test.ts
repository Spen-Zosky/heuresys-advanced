/**
 * apps/api/test/user-dossier.integration.test.ts
 * GET /v1/users/:userId/dossier (#81) — la scheda di una persona raccontata.
 *
 * Cosa si prova qui, e perché in questo ordine:
 *  1. che il dossier NON sia vuoto per chi ha una storia — altrimenti la pagina
 *     tornerebbe a mostrare solo l'anagrafica, che è il difetto da chiudere.
 *     L'atteso si DERIVA dal database (quante buste ci sono davvero), mai da un
 *     numero ricopiato: se la storia cresce, il test resta vero.
 *  2. che il cancello ORGANIZZATIVO morda: un pari non vede il dossier di un
 *     pari (I18/I19). Senza questo caso staremmo verificando "riesco a leggere",
 *     non "chi non ha titolo viene respinto".
 *
 * Gli attori si scelgono per CARATTERISTICA (helpers/actors.ts), non per nome.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { hierarchyChain, functionalPeers, tenantAdmin } from "./helpers/actors.js";

let t: TestApp;

interface Session {
  cookie: string;
  userId: string;
}

async function login(email: string): Promise<Session> {
  const r = await loginRaw(t.app, email);
  const cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const body = r.json() as { user: { userId: string } };
  return { cookie, userId: body.user.userId };
}

const dossier = (s: Session, userId: string) =>
  t.app.inject({ method: "GET", url: `/v1/users/${userId}/dossier`, headers: { cookie: s.cookie } });

beforeAll(async () => {
  t = await buildTestApp();
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("GET /v1/users/:userId/dossier", () => {
  it("racconta la persona a se stessa: non solo l'anagrafica", async () => {
    const { bottom } = await hierarchyChain();
    const s = await login(bottom.email);

    const res = await dossier(s, bottom.userId);
    expect(res.statusCode).toBe(200);
    const b = res.json() as Record<string, unknown>;

    // le undici sezioni ci sono tutte: una mancante significa una pagina muta
    for (const sezione of [
      "profile", "positions", "contracts", "paySlips", "performance",
      "attendance", "skills", "learning", "certifications", "goals", "careerTargets",
    ]) {
      expect(b, `sezione mancante: ${sezione}`).toHaveProperty(sezione);
    }
  });

  it("le buste del dossier sono quelle che il database ha davvero (atteso derivato, non ricopiato)", async () => {
    const { bottom } = await hierarchyChain();
    const s = await login(bottom.email);

    const atteso = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_user_pay_slips WHERE user_pay_slip_user_id = $1`,
      [bottom.userId],
    );
    const n = Number(atteso.rows[0]!.n);

    const res = await dossier(s, bottom.userId);
    expect(res.statusCode).toBe(200);
    const b = res.json() as { paySlips: unknown[] };
    expect(b.paySlips.length).toBe(n);
    // la premessa del test: questa persona HA una storia. Se un giorno non fosse
    // più vero, è il dato ad essere cambiato e va saputo subito.
    expect(n, "il soggetto non ha buste: scegliere un altro attore o indagare il dato").toBeGreaterThan(0);
  });

  it("chi sta sopra nella linea gerarchica lo vede", async () => {
    const { top, bottom } = await hierarchyChain();
    const s = await login(top.email);

    const res = await dossier(s, bottom.userId);
    expect(res.statusCode).toBe(200);
    expect((res.json() as { profile: { userId: string } }).profile.userId).toBe(bottom.userId);
  });

  it("un PARI non lo vede — e riceve 404, non 403 (un 403 confermerebbe che esiste)", async () => {
    const { a, b } = await functionalPeers();
    const s = await login(a.email);

    const res = await dossier(s, b.userId);
    expect(res.statusCode).toBe(404);
  });

  it("un ruolo con mandato HR lo vede su tutto il proprio tenant", async () => {
    const admin = await tenantAdmin();
    const { bottom } = await hierarchyChain();
    const s = await login(admin.email);

    const res = await dossier(s, bottom.userId);
    expect(res.statusCode).toBe(200);
  });

  it("un utente inesistente è 404", async () => {
    const admin = await tenantAdmin();
    const s = await login(admin.email);

    const res = await dossier(s, randomUUID());
    expect(res.statusCode).toBe(404);
  });

  it("senza sessione è 401", async () => {
    const { bottom } = await hierarchyChain();
    const res = await t.app.inject({ method: "GET", url: `/v1/users/${bottom.userId}/dossier` });
    expect(res.statusCode).toBe(401);
  });
});
