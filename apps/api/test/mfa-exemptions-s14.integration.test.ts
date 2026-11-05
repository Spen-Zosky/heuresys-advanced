/**
 * ADR-0050 D3, parte visibile (S-14): la pagina della politica MFA elenca le esenzioni con
 * autore, scadenza e stato, e permette di spegnerle. Attori: governo@ (TENANT_ADMIN di RTL,
 * mfa_policy:read e :manage) e un'esenzione creata qui, nella transazione del file, per una
 * persona di prova con un autore vero (D3: una persona, non l'esentato).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";
import type { ListMfaExemptionsResponse, MfaExemption } from "@heuresys/shared";

const GOVERNO = "governo@collaudo.invalid";
const AUTORE = "alberto.colombo@rtl-bank.org";

interface Auth { cookie: string; csrfToken: string }

describe("S-14 — esenzioni dal secondo fattore con autore e scadenza", () => {
  let suite: TestApp;
  let governo: Auth;
  let esenzioneId: string;
  let tenantRtl: string;

  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, GOVERNO, deriveCollaudoPassword(readCollaudoKey(), GOVERNO));
    if (r.statusCode !== 200) throw new Error(`login ${GOVERNO} -> ${r.statusCode}`);
    governo = {
      cookie: r.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
      csrfToken: (r.json() as { csrfToken: string }).csrfToken,
    };
    const autore = (await pool.query<{ id: string; t: string }>(
      `SELECT user_id AS id, user_tenant_id AS t FROM sys.sys_users WHERE lower(user_email) = lower($1)`, [AUTORE],
    )).rows[0]!;
    tenantRtl = autore.t;
    const persona = (await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_users (user_tenant_id, user_email, user_display_name, user_first_name, user_last_name, user_status)
       VALUES ($1, 'esenzione.s14@prova.invalid', 'Prova Esenzione', 'Prova', 'Esenzione', 'ACTIVE') RETURNING user_id AS id`,
      [tenantRtl],
    )).rows[0]!.id;
    esenzioneId = (await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_auth_mfa_exemptions
         (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_expires_at, created_by)
       VALUES ($1, 'prova S-14: utenza senza secondo fattore', now() + interval '10 days', $2)
       RETURNING auth_mfa_exemption_id AS id`,
      [persona, autore.id],
    )).rows[0]!.id;
  });
  afterAll(async () => {
    await suite.app.close();
  });

  const elenco = async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/mfa-policy/exemptions", headers: { cookie: governo.cookie } });
    expect(r.statusCode, r.body).toBe(200);
    return r.json() as ListMfaExemptionsResponse;
  };

  it("elenca le esenzioni del proprio tenant con autore, scadenza e stato", async () => {
    const { items, total } = await elenco();
    expect(total).toBe(items.length);
    for (const e of items) expect(e.tenantId).toBe(tenantRtl);
    const mia = items.find((e) => e.exemptionId === esenzioneId);
    expect(mia).toMatchObject({ state: "ACTIVE", userEmail: "esenzione.s14@prova.invalid", authorDisplayName: expect.any(String) });
    expect(new Date(mia!.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it("spegnere chiude l'esenzione, con chi l'ha spenta, ed è idempotente", async () => {
    const spegni = () => suite.app.inject({
      method: "POST", url: `/v1/mfa-policy/exemptions/${esenzioneId}/disable`,
      headers: { cookie: governo.cookie, "x-csrf-token": governo.csrfToken, "content-type": "application/json" },
      payload: {},
    });
    const r = await spegni();
    expect(r.statusCode, r.body).toBe(200);
    expect((r.json() as MfaExemption).state).toBe("DISABLED");
    const riga = await pool.query<{ enabled: boolean; by: string | null }>(
      `SELECT auth_mfa_exemption_enabled AS enabled, updated_by AS by FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_id = $1`,
      [esenzioneId],
    );
    expect(riga.rows[0]!.enabled).toBe(false);
    expect(riga.rows[0]!.by).not.toBeNull();
    const ancora = await spegni();
    expect(ancora.statusCode, ancora.body).toBe(200);
    expect((ancora.json() as MfaExemption).state).toBe("DISABLED");
  });

  it("senza CSRF non si spegne niente, e un id che non c'è è 404", async () => {
    const senza = await suite.app.inject({
      method: "POST", url: `/v1/mfa-policy/exemptions/${esenzioneId}/disable`, headers: { cookie: governo.cookie }, payload: {},
    });
    expect(senza.statusCode).toBe(403);
    const assente = await suite.app.inject({
      method: "POST", url: "/v1/mfa-policy/exemptions/00000000-0000-4000-8000-000000000000/disable",
      headers: { cookie: governo.cookie, "x-csrf-token": governo.csrfToken, "content-type": "application/json" }, payload: {},
    });
    expect(assente.statusCode).toBe(404);
  });
});
