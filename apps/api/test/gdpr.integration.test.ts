/**
 * apps/api/test/gdpr.integration.test.ts
 * D-14 F3/F4 — GDPR tooling: data-map anti-drift invariant (derived LIVE from
 * pg_constraint — no hardcoded table list), DSR export (self + admin + RBAC
 * negative), erasure with legal-hold on a provisioned subject (guards, dry-run,
 * real run, login revoked, root anonymized), consent ledger, retention sweep.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PLATFORM_ADMIN = "admin@heuresys.com";
const TENANT_ADMIN = "federica.marchetti@rtl-bank.org";
const MANAGER = "paolo.caputo@rtl-bank.org";
const EMPLOYEE = "tommaso.fiore@rtl-bank.org";
const SUITE = `GDPR_${randomUUID().slice(0, 8).toUpperCase()}`;
const SUBJECT_PW = "Gdpr#Subject1!";

interface Auth {
  cookies: Map<string, string>;
  csrfToken: string;
}
function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string, password = TEST_PERSONA_PASSWORD): Promise<Auth> {
  const r = await loginRaw(t.app, email, password);
  if (r.statusCode !== 200) {
    throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  }
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
function headers(a: Auth) {
  return {
    cookie: cookieHeader(a.cookies),
    "x-csrf-token": a.csrfToken,
    "content-type": "application/json",
  };
}

describe("D-14 F3/F4 GDPR tooling", () => {
  let suite: TestApp;
  let platform: Auth;

  beforeAll(async () => {
    suite = await buildTestApp();
    platform = await login(suite, PLATFORM_ADMIN);
  });
  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("data-map anti-drift: every SUBJECT fk to sys_users on sys_user_* tables is classified", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/gdpr/data-map",
      headers: headers(platform),
    });
    expect(r.statusCode).toBe(200);
    const { items } = r.json() as { items: { tableName: string; subjectFkColumn: string }[] };
    expect(items.length).toBeGreaterThan(40);
    const mapped = new Set(items.map((i) => `${i.tableName}.${i.subjectFkColumn}`));

    // LIVE fk graph — the SoT is pg_constraint, never a hardcoded list.
    const fks = await pool.query<{ tbl: string; col: string }>(
      `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
         FROM pg_constraint c
         JOIN LATERAL unnest(c.conkey) k ON true
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        WHERE c.contype = 'f' AND c.confrelid = 'sys.sys_users'::regclass
          AND c.conrelid::regclass::text LIKE 'sys.sys_user\\_%'`,
    );
    // ACTOR references are not subject data (registry doctrine, mig 000186).
    const ACTOR_RE = /(^|_)(created_by|updated_by)$|_by$|assessor|reviewer|verified/;
    const subjectFks = fks.rows.filter((f) => !ACTOR_RE.test(f.col));
    expect(subjectFks.length).toBeGreaterThan(20);
    const missing = subjectFks
      .map((f) => `${f.tbl.replace(/^sys\./, "")}.${f.col}`)
      .filter((k) => !mapped.has(k));
    expect(missing, "subject FKs senza classificazione GDPR (aggiorna sys_gdpr_data_map)").toEqual([]);
  });

  it("data-map consistency: every registry entry points at an existing column", async () => {
    const rows = await pool.query<{ s: string; t: string; c: string; ok: boolean }>(
      `SELECT m.gdpr_map_table_schema AS s, m.gdpr_map_table_name AS t, m.gdpr_map_subject_fk AS c,
              EXISTS (SELECT 1 FROM information_schema.columns ic
                       WHERE ic.table_schema = m.gdpr_map_table_schema
                         AND ic.table_name  = m.gdpr_map_table_name
                         AND ic.column_name = m.gdpr_map_subject_fk) AS ok
         FROM sys.sys_gdpr_data_map m`,
    );
    const broken = rows.rows.filter((r) => !r.ok).map((r) => `${r.s}.${r.t}.${r.c}`);
    expect(broken, "registry GDPR orfano (tabella/colonna inesistente)").toEqual([]);
  });

  it("self-service export (I17 floor): the employee exports their OWN data, logged for accountability", { timeout: 60_000 }, async () => {
    const me = await login(suite, EMPLOYEE);
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/me/gdpr/export",
      headers: headers(me),
      payload: {},
    });
    expect(r.statusCode).toBe(200);
    const bundle = r.json() as {
      subject: { userId: string; email: string };
      tables: Record<string, { rowCount: number; rows: unknown[] }>;
    };
    expect(bundle.subject.email).toBe(EMPLOYEE);
    expect(bundle.tables["sys.sys_users.user_id"]?.rowCount).toBe(1);
    // accountability row (counts only)
    const logged = await pool.query(
      `SELECT gdpr_request_id FROM sys.sys_gdpr_requests
        WHERE gdpr_request_subject_user_id = $1 AND gdpr_request_type = 'EXPORT' AND gdpr_request_status = 'COMPLETED'`,
      [bundle.subject.userId],
    );
    expect(logged.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("Z-259 — the export bundle carries NO identifier of any other person (Art. 15(4))", { timeout: 60_000 }, async () => {
    const me = await login(suite, EMPLOYEE);
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/me/gdpr/export",
      headers: headers(me),
      payload: {},
    });
    expect(r.statusCode).toBe(200);
    const bundle = r.json() as {
      subject: { userId: string };
      tables: Record<string, { rows: Record<string, unknown>[]; omittedColumns?: string[] }>;
    };
    const meId = bundle.subject.userId;

    // Every OTHER person's id, from the live table — not a hand-written list:
    // the assertion must notice a leak of anyone, not of a chosen few.
    const others = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_id <> $1`,
      [meId],
    );
    const otherIds = new Set(others.rows.map((x) => x.user_id));
    expect(otherIds.size).toBeGreaterThan(0); // guard: an empty set would pass vacuously

    // Scan the payload for any value that IS another person's id. This checks
    // the data actually handed over, not the shape of the response — dropping
    // either guard in exportSubjectData turns it red: without the ACTOR skip
    // the 360/continuous-feedback rows come back with their counterpart's id,
    // without the projection the reviewer's id rides along in the subject's own
    // rows.
    const leaks: string[] = [];
    for (const [tableKey, t] of Object.entries(bundle.tables)) {
      for (const row of t.rows) {
        for (const [col, val] of Object.entries(row)) {
          if (typeof val === "string" && otherIds.has(val)) leaks.push(`${tableKey} -> ${col}`);
        }
      }
    }
    expect(
      [...new Set(leaks)].sort(),
      "l'export consegna al richiedente identificativi di ALTRE persone",
    ).toEqual([]);

    // The id scan above is NOT sufficient on its own, and the falsifiability
    // probe proved it: with the ACTOR skip disabled the bundle still passed it,
    // because the projection had stripped the ids — while the rows themselves,
    // carrying the TEXT of appraisals written about other people, were being
    // handed over. Identifier-free is not third-party-free. So assert the
    // stronger property: an ACTOR entry must not appear in the bundle at all.
    const actorEntries = await pool.query<{ k: string }>(
      `SELECT gdpr_map_table_schema || '.' || gdpr_map_table_name || '.' || gdpr_map_subject_fk AS k
         FROM sys.sys_gdpr_data_map WHERE gdpr_map_reference_kind = 'ACTOR'`,
    );
    expect(actorEntries.rows.length).toBeGreaterThan(0); // guard against a vacuous pass
    const present = actorEntries.rows.map((x) => x.k).filter((k) => k in bundle.tables);
    expect(
      present.sort(),
      "il bundle contiene voci ACTOR: sono record di cui il richiedente e' autore, non soggetto",
    ).toEqual([]);

    // and the withholding is declared, not silent
    const declared = Object.values(bundle.tables).some((t) => (t.omittedColumns?.length ?? 0) > 0);
    expect(declared, "nessuna colonna dichiarata come omessa: la proiezione non sta girando").toBe(true);
  });

  it("admin export: TENANT_ADMIN exports an in-tenant subject; MANAGER (no gdpr perm) gets 403", { timeout: 60_000 }, async () => {
    const subj = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [EMPLOYEE],
    );
    const subjectId = subj.rows[0]!.user_id;

    const ta = await login(suite, TENANT_ADMIN);
    const ok = await suite.app.inject({
      method: "POST",
      url: `/v1/gdpr/users/${subjectId}/export`,
      headers: headers(ta),
      payload: {},
    });
    expect(ok.statusCode).toBe(200);

    const mgr = await login(suite, MANAGER);
    const ko = await suite.app.inject({
      method: "POST",
      url: `/v1/gdpr/users/${subjectId}/export`,
      headers: headers(mgr),
      payload: {},
    });
    expect(ko.statusCode).toBe(403);
  });

  it("erasure guard: an ACTIVE subject cannot be erased (contract basis prevails)", async () => {
    const subj = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [EMPLOYEE],
    );
    const r = await suite.app.inject({
      method: "POST",
      url: `/v1/gdpr/users/${subj.rows[0]!.user_id}/erasure`,
      headers: headers(platform),
      payload: { dryRun: true },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SUBJECT_STILL_ACTIVE");
  });

  // Registry walk = 54+ sequential queries per pass; over the dev SSH tunnel the
  // provision+dry-run+real-erasure chain exceeds the 20s default (fast on CI's
  // local DB). Budgeted, not a hot path — DSR erasure is an admin operation.
  it("full erasure E2E on a provisioned subject: dry-run first, then legal-hold-aware erasure + login revoked", { timeout: 120_000 }, async () => {
    // 1. provision a subject through the REAL engine (D-14 F1/F2)
    const code = `${SUITE}_ERASE`;
    const subjectEmail = `subject.${code.toLowerCase()}@example.org`;
    const prov = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants/provision",
      headers: headers(platform),
      payload: {
        tenantCode: code,
        tenantName: "Erasure Subject Org",
        adminEmail: subjectEmail,
        adminDisplayName: "Erasure Subject",
        adminPassword: SUBJECT_PW,
      },
    });
    expect(prov.statusCode).toBe(201);
    const subjectId = (prov.json() as { admin: { userId: string } }).admin.userId;

    // 2. the subject uses the platform: logs in + records a consent (ledger row).
    // Raw single-step inject (a fresh subject has no MFA factor) so a failure
    // surfaces the response BODY, not just the status.
    const rawLogin = await suite.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: subjectEmail, password: SUBJECT_PW },
    });
    expect(rawLogin.statusCode, `subject login body: ${rawLogin.body}`).toBe(200);
    const subjCookies = new Map<string, string>();
    for (const c of rawLogin.cookies) subjCookies.set(c.name, c.value);
    const asSubject: Auth = {
      cookies: subjCookies,
      csrfToken: (rawLogin.json() as { csrfToken: string }).csrfToken,
    };
    const consent = await suite.app.inject({
      method: "POST",
      url: "/v1/me/consents",
      headers: headers(asSubject),
      payload: { purpose: "ANALYTICS_PROFILING", action: "GRANT" },
    });
    expect(consent.statusCode).toBe(200);

    // 3. deactivate (erasure precondition), then DRY-RUN: counts, no mutation
    await pool.query(`UPDATE sys.sys_users SET user_status = 'DEACTIVATED' WHERE user_id = $1`, [subjectId]);
    const dry = await suite.app.inject({
      method: "POST",
      url: `/v1/gdpr/users/${subjectId}/erasure`,
      headers: headers(platform),
      payload: { dryRun: true },
    });
    expect(dry.statusCode).toBe(200);
    const dryReport = dry.json() as {
      dryRun: boolean;
      anonymizedRoot: boolean;
      tables: Record<string, { strategy: string; affectedRows: number; legalBasis: string | null }>;
    };
    expect(dryReport.dryRun).toBe(true);
    expect(dryReport.anonymizedRoot).toBe(false);
    // identity row still intact after dry-run
    const stillThere = await pool.query(`SELECT user_email FROM sys.sys_users WHERE user_id = $1`, [subjectId]);
    expect(stillThere.rows[0]?.user_email).toBe(subjectEmail);
    // consent ledger is legal-hold (RETAIN + basis) and counted
    const consentEntry = dryReport.tables["sys.sys_user_consents.consent_user_id"];
    expect(consentEntry?.strategy).toBe("RETAIN");
    expect(consentEntry?.affectedRows).toBe(1);
    expect(consentEntry?.legalBasis).toBeTruthy();

    // 4. REAL erasure
    const real = await suite.app.inject({
      method: "POST",
      url: `/v1/gdpr/users/${subjectId}/erasure`,
      headers: headers(platform),
      payload: { dryRun: false },
    });
    expect(real.statusCode).toBe(200);
    expect((real.json() as { anonymizedRoot: boolean }).anonymizedRoot).toBe(true);

    // 5. proofs: root anonymized · auth identity gone · login impossible · consent retained
    const root = await pool.query<{ user_email: string; user_display_name: string; user_status: string }>(
      `SELECT user_email, user_display_name, user_status FROM sys.sys_users WHERE user_id = $1`,
      [subjectId],
    );
    expect(root.rows[0]!.user_email).toMatch(/^erased\+.*@erased\.invalid$/);
    expect(root.rows[0]!.user_display_name).toBe("ERASED");
    expect(root.rows[0]!.user_status).toBe("DEACTIVATED");

    const identity = await pool.query(
      `SELECT auth_identity_id FROM sys.sys_auth_identities WHERE auth_identity_user_id = $1`,
      [subjectId],
    );
    expect(identity.rows.length).toBe(0);

    // raw inject: loginRaw throws on non-200, and 401 here is exactly the point
    const deadLogin = await suite.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: subjectEmail, password: SUBJECT_PW },
    });
    expect(deadLogin.statusCode).toBe(401);

    const consents = await pool.query(
      `SELECT consent_id FROM sys.sys_user_consents WHERE consent_user_id = $1`,
      [subjectId],
    );
    expect(consents.rows.length).toBe(1); // RETAIN — accountability survives erasure

    const logged = await pool.query(
      `SELECT gdpr_request_status FROM sys.sys_gdpr_requests
        WHERE gdpr_request_subject_user_id = $1 AND gdpr_request_type = 'ERASURE'`,
      [subjectId],
    );
    // Both requests exist; order is not asserted — under tx-isolation now() is
    // frozen per file (D-52), so the two rows share created_at and ORDER BY it
    // is non-deterministic. Assert set-membership instead.
    expect(logged.rows.map((r) => r.gdpr_request_status).sort()).toEqual(["COMPLETED", "DRY_RUN"]);
  });

  it("consent ledger: GRANT -> state true, REVOKE -> state false, append-only events", async () => {
    const me = await login(suite, EMPLOYEE);
    const myId = (
      await pool.query<{ user_id: string }>(
        `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
        [EMPLOYEE],
      )
    ).rows[0]!.user_id;

    const grant = await suite.app.inject({
      method: "POST",
      url: "/v1/me/consents",
      headers: headers(me),
      payload: { purpose: "MARKETING_COMMUNICATIONS", action: "GRANT" },
    });
    expect(grant.statusCode).toBe(200);

    let state = await suite.app.inject({ method: "GET", url: "/v1/me/consents", headers: headers(me) });
    expect(state.statusCode).toBe(200);
    let items = (state.json() as { items: { purpose: string; granted: boolean }[] }).items;
    expect(items.find((i) => i.purpose === "MARKETING_COMMUNICATIONS")?.granted).toBe(true);

    const revoke = await suite.app.inject({
      method: "POST",
      url: "/v1/me/consents",
      headers: headers(me),
      payload: { purpose: "MARKETING_COMMUNICATIONS", action: "REVOKE" },
    });
    expect(revoke.statusCode).toBe(200);

    state = await suite.app.inject({ method: "GET", url: "/v1/me/consents", headers: headers(me) });
    items = (state.json() as { items: { purpose: string; granted: boolean }[] }).items;
    expect(items.find((i) => i.purpose === "MARKETING_COMMUNICATIONS")?.granted).toBe(false);

    const events = await pool.query(
      `SELECT consent_action FROM sys.sys_user_consents
        WHERE consent_user_id = $1 AND consent_purpose = 'MARKETING_COMMUNICATIONS'
        ORDER BY consent_seq`,
      [myId],
    );
    expect(events.rows.map((r) => r.consent_action)).toEqual(["GRANT", "REVOKE"]);
  });

  it("retention sweep: platform-only, dry-run reports every registry window (incl. login-events 400d — D-59)", async () => {
    const ta = await login(suite, TENANT_ADMIN);
    const forbidden = await suite.app.inject({
      method: "POST",
      url: "/v1/gdpr/retention/run",
      headers: headers(ta),
      payload: { dryRun: true },
    });
    expect(forbidden.statusCode).toBe(403);

    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/gdpr/retention/run",
      headers: headers(platform),
      payload: { dryRun: true },
    });
    expect(r.statusCode).toBe(200);
    const report = r.json() as {
      dryRun: boolean;
      tables: Record<string, { retentionDays: number; ageColumn: string; affectedRows: number }>;
    };
    expect(report.dryRun).toBe(true);
    expect(report.tables["sys.sys_auth_login_events"]?.retentionDays).toBe(400);
    for (const t of Object.values(report.tables)) {
      expect(t.affectedRows).toBeGreaterThanOrEqual(0);
    }
  });
});
