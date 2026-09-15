/**
 * S-4 (mandato K, F2) — prova di REGRESSIONE cross-tenant sui sinonimi delle competenze.
 *
 * Il revisore del mandato ha misurato che `sys_skill_aliases` NON e' un buco di isolamento: l'alias
 * eredita il tenant dalla competenza madre e `authorizeWriteOnSkill` risponde 404 (anti-enumerazione)
 * a chi non e' del tenant della competenza, 403 `GLOBAL_SKILL_ALIAS_ADMIN_ONLY` a chi non e' piattaforma
 * su una competenza globale. Questo file rende quella misura una prova che gira a ogni corsa.
 *
 * Il caso «USER del tenant A → 403» (D1=B, permesso `skill_alias:manage`) e' scritto ORA come `it.skip`
 * con motivo «attivo dopo R-3»: la prova esiste prima del ritiro e la si vedra' fallire prima (regola 5).
 *
 * Isolamento transazionale per file (D-52): tutto cio' che nasce qui viene rollbackato.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PREFIX = `IT_S4_${randomUUID().slice(0, 8).toUpperCase()}`;
interface S { cookies: Map<string, string>; csrfToken: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
const hdr = (s: S) => ({ cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" });

let suite: TestApp;
let rtlAdmin: S; // TENANT_ADMIN di RTL Bank = «tenant B» rispetto alla competenza di Heuresys System
let skillDiA: string; // competenza del tenant A (Heuresys System), seminata via SQL nella transazione del file
let skillDiB: string; // competenza del tenant B (RTL), creata dal suo admin via API
let skillGlobale: string; // competenza globale (skill_tenant_id NULL, is_global true), seminata via SQL
let aliasDiA: string; // alias sulla competenza di A, seminato via SQL

// Perche' SQL e non l'API di piattaforma: `enzo.spenuso@heuresys.com` ha un fattore TOTP senza etichetta
// `derived-access` (misurato 2026-09-15), quindi `loginRaw` non lo sa autenticare. La semina diretta e'
// rollbackata a fine file (D-52) e non dipende da nessuna persona di piattaforma.
beforeAll(async () => {
  suite = await buildTestApp();
  rtlAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  const hs = await pool.query<{ tenant_id: string }>("SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_name = 'Heuresys System'");
  const tenantA = hs.rows[0]!.tenant_id;
  const a = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_skills (skill_tenant_id, skill_code, skill_name, skill_is_global)
     VALUES ($1, $2, 'Competenza del tenant A (prova S-4)', false) RETURNING skill_id AS id`,
    [tenantA, `${PREFIX}_A`],
  );
  skillDiA = a.rows[0]!.id;
  const g = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_skills (skill_tenant_id, skill_code, skill_name, skill_is_global)
     VALUES (NULL, $1, 'Competenza globale (prova S-4)', true) RETURNING skill_id AS id`,
    [`${PREFIX}_G`],
  );
  skillGlobale = g.rows[0]!.id;
  const al = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_skill_aliases (skill_alias_skill_id, skill_alias_label, skill_alias_locale)
     VALUES ($1, $2, 'it') RETURNING skill_alias_id AS id`,
    [skillDiA, `${PREFIX} alias di A`],
  );
  aliasDiA = al.rows[0]!.id;
  const sb = await suite.app.inject({ method: "POST", url: "/v1/skills", headers: hdr(rtlAdmin), payload: { code: `${PREFIX}_B`, name: "Competenza del tenant B" } });
  expect(sb.statusCode, sb.body).toBe(201);
  skillDiB = (sb.json() as { skillId: string }).skillId;
});

afterAll(async () => {
  await suite.app.close();
});

describe("S-4 — un attore del tenant B non tocca i sinonimi delle competenze del tenant A", () => {
  it("la prova sa distinguere: il padrone della competenza crea l'alias → 201", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/skill-aliases", headers: hdr(rtlAdmin), payload: { skillId: skillDiB, label: `${PREFIX} alias di B`, locale: "it" } });
    expect(r.statusCode, r.body).toBe(201);
  });

  it("B crea un alias su una competenza di A → 404 (anti-enumerazione: non 403)", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/skill-aliases", headers: hdr(rtlAdmin), payload: { skillId: skillDiA, label: `${PREFIX} intruso`, locale: "it" } });
    expect(r.statusCode, r.body).toBe(404);
  });

  it("B modifica un alias di A → 404", async () => {
    const r = await suite.app.inject({ method: "PATCH", url: `/v1/skill-aliases/${aliasDiA}`, headers: hdr(rtlAdmin), payload: { label: `${PREFIX} riscritto da B` } });
    expect(r.statusCode, r.body).toBe(404);
  });

  it("B cancella un alias di A → 404, e l'alias esiste ancora", async () => {
    const r = await suite.app.inject({ method: "DELETE", url: `/v1/skill-aliases/${aliasDiA}`, headers: { cookie: ch(rtlAdmin.cookies), "x-csrf-token": rtlAdmin.csrfToken } });
    expect(r.statusCode, r.body).toBe(404);
    const ancora = await pool.query("SELECT 1 FROM sys.sys_skill_aliases WHERE skill_alias_id = $1", [aliasDiA]);
    expect(ancora.rows.length, "l'alias di A e' sparito").toBe(1);
  });

  it("B non vede nemmeno l'alias di A nell'elenco → 0 righe per quella competenza", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/skill-aliases?skillId=${skillDiA}`, headers: { cookie: ch(rtlAdmin.cookies) } });
    expect(r.statusCode, r.body).toBe(200);
    const body = r.json() as { items?: unknown[]; data?: unknown[] };
    expect((body.items ?? body.data ?? []).length).toBe(0);
  });

  it("un non-platform su una competenza GLOBALE → 403 GLOBAL_SKILL_ALIAS_ADMIN_ONLY", async () => {
    const r = await suite.app.inject({ method: "POST", url: "/v1/skill-aliases", headers: hdr(rtlAdmin), payload: { skillId: skillGlobale, label: `${PREFIX} su globale`, locale: "it" } });
    expect(r.statusCode, r.body).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("GLOBAL_SKILL_ALIAS_ADMIN_ONLY");
  });

  // D1=B: i sinonimi li governa chi governa le competenze. Oggi USER ha `skill:create` e questa rotta
  // risponde 201; dopo R-3 (permesso `skill_alias:manage`) deve rispondere 403. Si attiva in R-3 e la si
  // vede ROSSA prima della migrazione, VERDE dopo.
  it.skip("attivo dopo R-3 — USER del tenant A crea un alias → 403", async () => {
    const user = await login(suite, "paolo.caputo@rtl-bank.org");
    const r = await suite.app.inject({ method: "POST", url: "/v1/skill-aliases", headers: hdr(user), payload: { skillId: skillDiB, label: `${PREFIX} da USER`, locale: "it" } });
    expect(r.statusCode, r.body).toBe(403);
  });
});
