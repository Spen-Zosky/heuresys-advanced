/**
 * apps/api/test/skills-i18n.integration.test.ts
 * i18n overlay (ADR-0029): /v1/skills serves IT in-row by default and the EN
 * translation when x-locale=en, with fallback to IT for unknown/absent locales.
 *
 * Self-contained: the fixture skill + its EN translations are CREATED here (not
 * assumed pre-existing), so the suite passes on a fresh CI clone where the
 * translation tables aren't seeded. The rows are cleaned up in afterAll and, on
 * a tx-isolated run, rolled back with the file transaction anyway.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let suite: TestApp;
let cookies: Map<string, string>;
let skillId: string;

const TAG = randomUUID().slice(0, 8).toUpperCase();
const IT_NAME = `competenza i18n ${TAG}`;
const IT_DESC = `descrizione italiana di prova ${TAG}`;
const EN_NAME = `i18n skill ${TAG}`;
const EN_DESC = `english test description ${TAG}`;

describe("/v1/skills i18n overlay (ADR-0029)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "enzo.spenuso@heuresys.com", TEST_PERSONA_PASSWORD);
    cookies = new Map<string, string>();
    for (const c of r.cookies) cookies.set(c.name, c.value);

    // Fixture: a GLOBAL skill (IT canonical in-row) + its EN translations.
    const admin = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_email = 'enzo.spenuso@heuresys.com'`,
    );
    const createdBy = admin.rows[0]!.user_id;
    const ins = await pool.query<{ skill_id: string }>(
      `INSERT INTO sys.sys_skills
         (skill_tenant_id, skill_code, skill_name, skill_description, skill_is_global, skill_metadata, created_by)
       VALUES (NULL, $1, $2, $3, true, '{}'::jsonb, $4)
       RETURNING skill_id`,
      [`I18N::${TAG}`, IT_NAME, IT_DESC, createdBy],
    );
    skillId = ins.rows[0]!.skill_id;
    await pool.query(
      `INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
       VALUES ('sys_skills', $1, 'name', 'en', $2, 'MANUAL'),
              ('sys_skills', $1, 'description', 'en', $3, 'MANUAL')
       ON CONFLICT (entity_table, entity_id, field, locale) DO UPDATE SET text = EXCLUDED.text`,
      [skillId, EN_NAME, EN_DESC],
    );
  });

  afterAll(async () => {
    if (skillId) {
      await pool.query(`DELETE FROM sys.sys_reference_translations WHERE entity_table='sys_skills' AND entity_id=$1`, [skillId]);
      await pool.query(`DELETE FROM sys.sys_skills WHERE skill_id=$1`, [skillId]);
    }
    await suite.app.close();
    await closePool();
  });

  it("default (no locale) returns the canonical IT in-row name+description", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/skills/${skillId}`, headers: { cookie: ch(cookies) } });
    expect(r.statusCode).toBe(200);
    const s = r.json() as { name: string; description: string | null };
    expect(s.name).toBe(IT_NAME);
    expect(s.description).toBe(IT_DESC);
  });

  it("x-locale=en returns the EN translation for name AND description", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/skills/${skillId}`,
      headers: { cookie: ch(cookies), "x-locale": "en" },
    });
    expect(r.statusCode).toBe(200);
    const s = r.json() as { name: string; description: string | null };
    expect(s.name).toBe(EN_NAME);
    expect(s.description).toBe(EN_DESC);
    expect(s.name).not.toBe(IT_NAME);
  });

  it("NEXT_LOCALE cookie also drives the overlay", async () => {
    const withLocaleCookie = new Map(cookies).set("NEXT_LOCALE", "en");
    const r = await suite.app.inject({ method: "GET", url: `/v1/skills/${skillId}`, headers: { cookie: ch(withLocaleCookie) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { name: string }).name).toBe(EN_NAME);
  });

  it("unknown locale falls back to IT", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/skills/${skillId}`,
      headers: { cookie: ch(cookies), "x-locale": "fr" },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { name: string }).name).toBe(IT_NAME);
  });
});
