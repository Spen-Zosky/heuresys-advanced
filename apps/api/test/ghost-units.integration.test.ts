/**
 * apps/api/test/ghost-units.integration.test.ts
 *
 * L'organizzazione ghost (ADR-0063 D2, voce G1): il vertice, le divisioni e le direzioni del
 * tenant, derivati dal vivo dall'albero delle unità, con la storia di ogni cambiamento.
 * Le prove si fanno contro la VISTA, non contro numeri scritti qui: il database della CI è un
 * clone congelato, e un conteggio fisso sarebbe verde lì e rosso in produzione (o il contrario).
 * Gli alberi cambiati qui dentro tornano indietro con la transazione del file.
 *
 * Il Backstage è per ora dei soli ruoli PLATFORM_ADMIN e HRMS_MANAGER (Enzo, 2026-11-28, 000526):
 * le prove leggono come HRMS_MANAGER (valentina.conti@) e verificano che un TENANT_ADMIN
 * (governo@) riceva un diniego su ogni rotta.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

interface S { cookies: Map<string, string>; csrfToken: string; tenantId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string };
  const u = await pool.query<{ t: string }>(`SELECT user_tenant_id AS t FROM sys.sys_users WHERE user_email = $1`, [email]);
  const tenantId = u.rows[0]?.t;
  if (!tenantId) throw new Error(`persona di prova senza tenant: ${email}`);
  return { cookies, csrfToken: body.csrfToken, tenantId };
}

interface G { ghostUnitId: string; sourceUnitId: string | null; level: number; kind: string; code: string; name: string; openedReason: string; closedReason: string | null; validTo: string | null }

let suite: TestApp;
let s: S;

/** HRMS_MANAGER, il ruolo di Valentina Conti: il Backstage è suo (000526). */
const MANDATO_HR = "valentina.conti@rtl-bank.org";
/** TENANT_ADMIN senza HRMS_MANAGER: per ora il Backstage non è suo. */
const SENZA_BACKSTAGE = "governo@collaudo.invalid";

async function ruoli(email: string): Promise<string[]> {
  const r = await pool.query<{ c: string }>(
    `SELECT r.auth_role_code AS c
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles uar ON uar.user_auth_role_user_id = u.user_id AND uar.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
      WHERE u.user_email = $1`, [email]);
  return r.rows.map((x) => x.c);
}

async function riforma() {
  const r = await suite.app.inject({
    method: "POST", url: "/v1/ghost-units/riforma",
    headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" },
    payload: {},
  });
  expect(r.statusCode).toBe(200);
  return r.json() as { aperte: number; chiuse: number; attive: number };
}
async function attive() {
  const r = await suite.app.inject({ method: "GET", url: "/v1/ghost-units", headers: { cookie: ch(s.cookies) } });
  expect(r.statusCode).toBe(200);
  return r.json() as { items: G[]; total: number; allineata: boolean };
}

interface D { allineata: boolean; total: number; items: Array<{ change: string; sourceUnitId: string | null; changedFields: string[]; ghost: { name: string } | null; live: { name: string } | null }> }
async function deriva() {
  const r = await suite.app.inject({ method: "GET", url: "/v1/ghost-units/deriva", headers: { cookie: ch(s.cookies) } });
  expect(r.statusCode).toBe(200);
  return r.json() as D;
}

describe("/v1/ghost-units integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    s = await login(suite, MANDATO_HR);
    await riforma();
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("LIST: le unità ghost sono quelle dell'albero vivo, entro il secondo livello, con un solo vertice", async () => {
    const body = await attive();
    const vista = await pool.query<{ source_unit_id: string; ghost_level: number; ghost_kind: string }>(
      `SELECT source_unit_id, ghost_level, ghost_kind FROM sys.v_ghost_units_derivate WHERE tenant_id = $1`,
      [s.tenantId],
    );
    expect(body.allineata).toBe(true);
    expect(body.total).toBe(vista.rowCount);
    expect(body.total).toBeGreaterThan(0);
    expect(new Set(body.items.map((g) => g.sourceUnitId))).toEqual(new Set(vista.rows.map((v) => v.source_unit_id)));
    expect(body.items.every((g) => g.level >= 0 && g.level <= 2 && g.validTo === null)).toBe(true);
    expect(body.items.filter((g) => g.kind === "VERTICE")).toHaveLength(1);
  });

  it("LIST: un'unità ghost è attiva nel database, e ogni unità attiva entro il secondo livello è ghost", async () => {
    const r = await pool.query<{ n: string }>(
      `WITH RECURSIVE t AS (
         SELECT organization_unit_id, 0 AS l FROM sys.sys_organization_units u
          WHERE organization_unit_tenant_id = $1 AND organization_unit_is_active
            AND (organization_unit_effective_to IS NULL OR organization_unit_effective_to >= current_date)
            AND u.organization_unit_parent_id IS NULL
         UNION ALL
         SELECT c.organization_unit_id, t.l + 1 FROM sys.sys_organization_units c JOIN t ON c.organization_unit_parent_id = t.organization_unit_id
          WHERE c.organization_unit_is_active AND (c.organization_unit_effective_to IS NULL OR c.organization_unit_effective_to >= current_date) AND t.l < 2)
       SELECT count(*)::text AS n FROM t`,
      [s.tenantId],
    );
    const body = await attive();
    expect(body.total).toBe(Number(r.rows[0]?.n));
  });

  it("RIFORMA: senza cambiamenti dell'albero non scrive niente", async () => {
    const r = await riforma();
    expect(r).toMatchObject({ aperte: 0, chiuse: 0 });
    expect(r.attive).toBe((await attive()).total);
  });

  it("DERIVA: con la forma ghost allineata non c'è nessuna voce", async () => {
    const d = await deriva();
    expect(d).toMatchObject({ allineata: true, total: 0, items: [] });
  });

  it("RIFORMA: un'unità rinominata chiude il periodo vecchio e ne apre uno nuovo, e la storia resta", async () => {
    const before = await attive();
    const target = before.items.find((g) => g.level > 0);
    if (!target?.sourceUnitId) throw new Error("nessuna unità ghost sotto il vertice");
    await pool.query(
      `UPDATE sys.sys_organization_units SET organization_unit_name = organization_unit_name || ' (prova G1)'
        WHERE organization_unit_id = $1`,
      [target.sourceUnitId],
    );
    expect((await attive()).allineata).toBe(false);
    const d = await deriva();
    expect(d.allineata).toBe(false);
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ change: "MODIFICATA", sourceUnitId: target.sourceUnitId, changedFields: ["name"] });
    expect(d.items[0]?.ghost?.name).toBe(target.name);
    expect(d.items[0]?.live?.name).toBe(`${target.name} (prova G1)`);
    const r = await riforma();
    expect(r).toMatchObject({ aperte: 1, chiuse: 1, attive: before.total });
    expect((await deriva()).total).toBe(0);
    const after = await attive();
    expect(after.allineata).toBe(true);
    const nuova = after.items.find((g) => g.sourceUnitId === target.sourceUnitId);
    expect(nuova?.name).toBe(`${target.name} (prova G1)`);
    expect(nuova?.openedReason).toBe("MODIFICATA");
    const st = await suite.app.inject({ method: "GET", url: "/v1/ghost-units/storia", headers: { cookie: ch(s.cookies) } });
    expect(st.statusCode).toBe(200);
    const vecchia = (st.json() as { items: G[] }).items.find((g) => g.ghostUnitId === target.ghostUnitId);
    expect(vecchia?.closedReason).toBe("MODIFICATA");
    expect(vecchia?.validTo).not.toBeNull();
  });

  it("RIFORMA: un'unità disattivata esce dall'organizzazione ghost e il suo ramo non genera vertici nuovi", async () => {
    const before = await attive();
    const target = before.items.find((g) => g.level === 2) ?? before.items.find((g) => g.level === 1);
    if (!target?.sourceUnitId) throw new Error("nessuna unità ghost sotto il vertice");
    await pool.query(
      `UPDATE sys.sys_organization_units SET organization_unit_is_active = false WHERE organization_unit_id = $1`,
      [target.sourceUnitId],
    );
    const d = await deriva();
    expect(d.items.find((x) => x.sourceUnitId === target.sourceUnitId)?.change).toBe("USCITA");
    const r = await riforma();
    expect(r.chiuse).toBeGreaterThanOrEqual(1);
    const after = await attive();
    expect(after.items.some((g) => g.sourceUnitId === target.sourceUnitId)).toBe(false);
    expect(after.allineata).toBe(true);
    expect(after.items.filter((g) => g.kind === "VERTICE")).toHaveLength(1);
  });

  it("GUARDIA: un periodo chiuso non si riapre e la storia non si riscrive", async () => {
    const chiusa = await pool.query<{ id: string }>(
      `SELECT ghost_unit_id AS id FROM sys.sys_ghost_units WHERE ghost_unit_tenant_id = $1 AND ghost_unit_valid_to IS NOT NULL LIMIT 1`,
      [s.tenantId],
    );
    const id = chiusa.rows[0]?.id;
    if (!id) throw new Error("le prove precedenti dovevano chiudere almeno un periodo");
    await expect(pool.query(`UPDATE sys.sys_ghost_units SET ghost_unit_valid_to = NULL, ghost_unit_closed_reason = NULL WHERE ghost_unit_id = $1`, [id]))
      .rejects.toThrow(/non si riapre/);
    const aperta = await pool.query<{ id: string }>(
      `SELECT ghost_unit_id AS id FROM sys.sys_ghost_units WHERE ghost_unit_tenant_id = $1 AND ghost_unit_valid_to IS NULL LIMIT 1`,
      [s.tenantId],
    );
    await expect(pool.query(`UPDATE sys.sys_ghost_units SET ghost_unit_name = 'altro' WHERE ghost_unit_id = $1`, [aperta.rows[0]?.id]))
      .rejects.toThrow(/non si riscrive/);
  });

  it("PERIMETRO: un tenant diverso dal proprio non si legge, e la riforma pretende il CSRF", async () => {
    const altro = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_id <> $1 LIMIT 1`, [s.tenantId],
    );
    if (altro.rows[0]) {
      const r = await suite.app.inject({
        method: "GET", url: `/v1/ghost-units?tenantId=${altro.rows[0].id}`, headers: { cookie: ch(s.cookies) },
      });
      expect(r.statusCode).toBe(403);
      expect((r.json() as { error: { code: string } }).error.code).toBe("PERMISSION_DENIED");
    }
    const senza = await suite.app.inject({
      method: "POST", url: "/v1/ghost-units/riforma",
      headers: { cookie: ch(s.cookies), "content-type": "application/json" }, payload: {},
    });
    expect(senza.statusCode).toBe(403);
  });

  it("PERMESSI: il Backstage è dei soli ruoli PLATFORM_ADMIN e HRMS_MANAGER, un TENANT_ADMIN riceve un diniego", async () => {
    expect(await ruoli(MANDATO_HR)).toContain("HRMS_MANAGER");
    const suoi = await ruoli(SENZA_BACKSTAGE);
    expect(suoi).toContain("TENANT_ADMIN");
    expect(suoi.some((c) => c === "HRMS_MANAGER" || c === "PLATFORM_ADMIN")).toBe(false);

    const titolari = await pool.query<{ codice: string; ruolo: string }>(
      `SELECT p.auth_permission_code AS codice, r.auth_role_code AS ruolo
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
         JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
        WHERE p.auth_permission_resource = 'ghost_unit'`);
    expect(new Set(titolari.rows.map((x) => x.ruolo))).toEqual(new Set(["HRMS_MANAGER", "PLATFORM_ADMIN"]));

    const altro = await login(suite, SENZA_BACKSTAGE);
    for (const url of ["/v1/ghost-units", "/v1/ghost-units/storia", "/v1/ghost-units/deriva"]) {
      const r = await suite.app.inject({ method: "GET", url, headers: { cookie: ch(altro.cookies) } });
      expect(r.statusCode, url).toBe(403);
      expect((r.json() as { error: { code: string } }).error.code, url).toBe("FORBIDDEN");
    }
    const r = await suite.app.inject({
      method: "POST", url: "/v1/ghost-units/riforma",
      headers: { cookie: ch(altro.cookies), "x-csrf-token": altro.csrfToken, "content-type": "application/json" },
      payload: {},
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("AUTENTICAZIONE: senza sessione non si legge", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/ghost-units" });
    expect(r.statusCode).toBe(401);
  });
});
