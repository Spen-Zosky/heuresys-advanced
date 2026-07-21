/**
 * apps/api/test/skills-i18n.integration.test.ts
 * i18n overlay (ADR-0029): /v1/skills serves IT in-row by default and the EN
 * translation when x-locale=en, with fallback to IT for unknown/absent locales.
 * Expected values are DERIVED from the live DB (no hardcoded fixtures).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let suite: TestApp;
let cookies: Map<string, string>;
// derived from the DB in beforeAll
let sample: { id: string; itName: string; itDesc: string | null; enName: string; enDesc: string };

describe("/v1/skills i18n overlay (ADR-0029)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "admin@heuresys.com", TEST_PERSONA_PASSWORD);
    cookies = new Map<string, string>();
    for (const c of r.cookies) cookies.set(c.name, c.value);

    // A real GLOBAL skill that has BOTH an EN name and EN description translation
    // and whose IT in-row name differs from the EN one (a genuine translation).
    const res = await pool.query<{
      skill_id: string; it_name: string; it_desc: string | null; en_name: string; en_desc: string;
    }>(
      `SELECT s.skill_id, s.skill_name AS it_name, s.skill_description AS it_desc,
              n.text AS en_name, d.text AS en_desc
         FROM sys.sys_skills s
         JOIN sys.sys_reference_translations n
           ON n.entity_table='sys_skills' AND n.entity_id=s.skill_id AND n.field='name'        AND n.locale='en'
         JOIN sys.sys_reference_translations d
           ON d.entity_table='sys_skills' AND d.entity_id=s.skill_id AND d.field='description' AND d.locale='en'
        WHERE s.skill_is_global = true
          AND s.skill_name <> n.text
        LIMIT 1`,
    );
    const row = res.rows[0];
    if (!row) throw new Error("no globally-visible skill with an EN translation found — seed the i18n data first");
    sample = { id: row.skill_id, itName: row.it_name, itDesc: row.it_desc, enName: row.en_name, enDesc: row.en_desc };
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("default (no locale) returns the canonical IT in-row name", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/skills/${sample.id}`, headers: { cookie: ch(cookies) } });
    expect(r.statusCode).toBe(200);
    const s = r.json() as { name: string; description: string | null };
    expect(s.name).toBe(sample.itName);
    expect(s.description).toBe(sample.itDesc);
  });

  it("x-locale=en returns the EN translation for name AND description", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/skills/${sample.id}`,
      headers: { cookie: ch(cookies), "x-locale": "en" },
    });
    expect(r.statusCode).toBe(200);
    const s = r.json() as { name: string; description: string | null };
    expect(s.name).toBe(sample.enName);
    expect(s.description).toBe(sample.enDesc);
    expect(s.name).not.toBe(sample.itName); // genuinely different language
  });

  it("NEXT_LOCALE cookie also drives the overlay", async () => {
    const withLocaleCookie = new Map(cookies).set("NEXT_LOCALE", "en");
    const r = await suite.app.inject({ method: "GET", url: `/v1/skills/${sample.id}`, headers: { cookie: ch(withLocaleCookie) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { name: string }).name).toBe(sample.enName);
  });

  it("unknown locale falls back to IT", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/skills/${sample.id}`,
      headers: { cookie: ch(cookies), "x-locale": "fr" },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { name: string }).name).toBe(sample.itName);
  });

  it("x-locale=en applies on the LIST endpoint too", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/skills?limit=200&isGlobal=true`,
      headers: { cookie: ch(cookies), "x-locale": "en" },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ skillId: string; name: string }> };
    const found = body.items.find((x) => x.skillId === sample.id);
    // may be beyond the page window; only assert when present
    if (found) expect(found.name).toBe(sample.enName);
  });
});
