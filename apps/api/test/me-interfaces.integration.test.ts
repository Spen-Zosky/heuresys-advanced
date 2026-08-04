/**
 * apps/api/test/me-interfaces.integration.test.ts
 * GET /v1/me/interfaces — the DB-driven sidebar registry (U1), filtered to the caller and
 * grouped into the 5 SECTIONS (S1009 IA redesign: OVERVIEW/GOVERNANCE/WORKFORCE/INTELLIGENCE/
 * PERSONAL, replacing the 3 PET perspectives). Faithfully replicates the web layout's hybrid
 * gate: ESS items (requires_admin=false) always visible; admin items require an admin-class
 * role AND the per-item permission. Inactive ("absorbed") pages are never returned.
 *
 * NO HARDCODED CODE LISTS. The expected sets are DERIVED from the live registry
 * (sys.sys_ui_interfaces) + the role→permission grants, so adding a new page (e.g. a /me/*
 * ESS page) needs ZERO edits here — the test re-derives the truth from the same source the
 * service reads. What stays asserted as a literal is the *design contract* (the 5 sections
 * and their display order) and the security *invariant* (a non-admin never sees an admin
 * item) — neither is a data list that grows with features. This replaces the previous
 * hardcoded ESS array that broke CI whenever a /me page was added (S1011 F5 mig 000168).
 *
 * Personas are the seed-test-admin set ONLY (login-capable in CI): admin (PLATFORM_ADMIN),
 * paolo.caputo (MANAGER), e una persona SENZA DELEGHE derivata dal dato (#119 —
 * non piu' cablata per nome). R2-seeded users are NOT used (their
 * logins are provisioned by seed-r2-personas.ts, which CI does not run).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

// Design contract (S1009 IA redesign): the 5 sections, in display order. Backed by the
// 5-value CHECK on sys_ui_interfaces.ui_interface_perspective (D-46). This IS the assertion,
// not duplicated data — so it stays literal on purpose.
const SECTIONS = ["OVERVIEW", "GOVERNANCE", "WORKFORCE", "INTELLIGENCE", "PERSONAL"] as const;

function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Map<string, string>> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return cookies;
}

type Body = { perspectives: { code: string; label: string; interfaces: { code: string }[] }[] };
async function interfaces(t: TestApp, c: Map<string, string>): Promise<Body> {
  const r = await t.app.inject({ method: "GET", url: "/v1/me/interfaces", headers: { cookie: ch(c) } });
  expect(r.statusCode).toBe(200);
  return r.json() as Body;
}
function codes(b: Body, section: string): string[] {
  return (b.perspectives.find((p) => p.code === section)?.interfaces ?? []).map((i) => i.code);
}
function allCodes(b: Body): string[] {
  return b.perspectives.flatMap((p) => p.interfaces.map((i) => i.code));
}

// --- registry / grants, read from the SAME source the service reads (no hardcoding) -------

type Reg = { code: string; perspective: string; requiresAdmin: boolean; reqPair: string | null };

/** The active sidebar registry — mirrors repo.loadActiveInterfaces' source. `reqPair` is the
 *  `resource:action` string the service tests against the caller's permission codes. */
async function loadActiveRegistry(): Promise<Reg[]> {
  const r = await pool.query<Reg>(
    `SELECT ui_interface_code        AS code,
            ui_interface_perspective AS perspective,
            ui_interface_requires_admin AS "requiresAdmin",
            CASE WHEN ui_interface_required_resource IS NULL OR ui_interface_required_action IS NULL
                 THEN NULL
                 ELSE ui_interface_required_resource || ':' || ui_interface_required_action
            END AS "reqPair"
       FROM sys.sys_ui_interfaces
      WHERE ui_interface_is_active = true`,
  );
  return r.rows;
}

async function loadInactiveCodes(): Promise<string[]> {
  const r = await pool.query<{ code: string }>(
    `SELECT ui_interface_code AS code FROM sys.sys_ui_interfaces WHERE ui_interface_is_active = false`,
  );
  return r.rows.map((x) => x.code);
}

/** The permission codes a user EFFECTIVELY holds (union of their non-revoked roles) — the exact
 *  set the service builds from actor.roles (paolo, e.g., is MANAGER+TEAM_LEADER+TEAM_MEMBER+USER,
 *  so a single-role lookup would be wrong). The service compares these to a row's `reqPair`. */
async function permsForEmail(email: string): Promise<Set<string>> {
  const r = await pool.query<{ code: string }>(
    `SELECT DISTINCT p.auth_permission_code AS code
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur
         ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE u.user_email = $1`,
    [email],
  );
  return new Set(r.rows.map((x) => x.code));
}

let suite: TestApp;
let adminC: Map<string, string>;
let managerC: Map<string, string>;
let userC: Map<string, string>;
let userEmail: string;
let registry: Reg[];

/**
 * #119 — la persona "senza deleghe" si DERIVA, non si sceglie per nome.
 *
 * Qui era cablato `tommaso.fiore`, che la ricostruzione dell'organigramma ha
 * nominato Direttore della Filiale di Varese: da allora regge un'unita', quindi
 * il gate amministrativo lo ammette e il test leggeva quella promozione come una
 * fuga. Non lo era. Il difetto era la premessa: un test che nomina una persona
 * asserisce implicitamente che quella persona non cambiera' mai ruolo.
 *
 * Ora si cerca chiunque non abbia ALCUN dominio attivo — nessuna unita' retta,
 * nessuna squadra guidata, nessun processo posseduto, nessun mandato — che e'
 * esattamente la condizione che il gate verifica.
 */
async function emailSenzaDeleghe(): Promise<string> {
  const r = await pool.query<{ user_email: string }>(
    `SELECT u.user_email
       FROM sys.sys_users u
      WHERE u.user_status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_units o
                         WHERE o.organization_unit_manager_user_id = u.user_id
                           AND o.organization_unit_is_active)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_teams t WHERE t.team_lead_user_id = u.user_id)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_process_participants p
                         WHERE p.process_participant_user_id = u.user_id
                           AND p.process_participant_role = 'OWNER'
                           AND p.process_participant_is_active)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur
                          JOIN sys.sys_auth_roles rr ON rr.auth_role_id = ur.user_auth_role_role_id
                         WHERE ur.user_auth_role_user_id = u.user_id
                           AND ur.user_auth_role_revoked_at IS NULL
                           AND rr.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER'))
        AND EXISTS (SELECT 1 FROM sys.sys_auth_identities i
                     WHERE i.auth_identity_user_id = u.user_id AND i.auth_identity_is_active)
      ORDER BY u.user_email
      LIMIT 1`,
  );
  const email = r.rows[0]?.user_email;
  if (!email) throw new Error("nessuna persona senza deleghe nel dato: il test non puo' misurare la meta' negativa della regola");
  return email;
}

describe("/v1/me/interfaces", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    adminC = await login(suite, "admin@heuresys.com");
    managerC = await login(suite, "paolo.caputo@rtl-bank.org");
    userEmail = await emailSenzaDeleghe();
    userC = await login(suite, userEmail);
    registry = await loadActiveRegistry();
  });
  afterAll(async () => { await suite.app.close(); });

  it("always returns the 5 sections in display order (honest empty-state)", async () => {
    const b = await interfaces(suite, userC);
    expect(b.perspectives.map((p) => p.code)).toEqual([...SECTIONS]);
  });

  it("PLATFORM_ADMIN sees every entry whose permission it holds — and NOT the ones it doesn't", async () => {
    const b = await interfaces(suite, adminC);
    // The old title said "holds every permission", and that premise is FALSE: the
    // whistleblowing console requires `whistleblowing:read`, which by design belongs to the
    // designated custodian alone (D.Lgs 24/2023) and NOT to PLATFORM_ADMIN. The assertion
    // passed only because the gate never evaluated that permission. Now the expectation is
    // derived from the permissions the role actually holds — which also makes this test the
    // guard for "the platform admin cannot read the whistleblowing reports either".
    const adminPerms = await permsForEmail("admin@heuresys.com");
    const atteso = registry.filter((r) => r.reqPair === null || adminPerms.has(r.reqPair));
    expect(allCodes(b).sort()).toEqual(atteso.map((r) => r.code).sort());
    // e il caso che rende la verifica non cieca: c'e' almeno una voce che l'admin NON vede
    expect(registry.some((r) => r.reqPair !== null && !adminPerms.has(r.reqPair))).toBe(true);
    expect(allCodes(b)).not.toContain("whistleblowing-console");
    // Design contract: dashboard is the first item of the first section (Enzo req 1).
    expect(codes(b, "OVERVIEW")[0]).toBe("dashboard");
    // Inactive ("absorbed") pages stay out of the sidebar — derived from is_active=false.
    const inactive = await loadInactiveCodes();
    const visible = new Set(allCodes(b));
    for (const c of inactive) expect(visible.has(c)).toBe(false);
  });

  it("pure USER sees ONLY the ESS items — no admin-nav leak", async () => {
    const b = await interfaces(suite, userC);
    // SECURITY INVARIANT (independent of the gate impl): a non-admin must NEVER see an
    // admin-gated interface, in any section.
    const adminGated = new Set(registry.filter((r) => r.requiresAdmin).map((r) => r.code));
    for (const c of allCodes(b)) expect(adminGated.has(c)).toBe(false);
    // COMPLETENESS (derived): a pure USER sees EXACTLY the non-admin interfaces WHOSE DECLARED
    // PERMISSION THEY HOLD (or which declare none), each in its declared section. A new /me page
    // lands here automatically — no test edit needed.
    //
    // The previous expectation was `every non-admin row`, full stop, and that CODIFIED A DEFECT:
    // `whistleblowing-console` carries `whistleblowing:read` — held by ONE role — with
    // requires_admin=false, so the old rule declared it correct for all 163 users to see it in
    // their menu. The test was green precisely because the service was wrong in the same way.
    // A declared permission pair is now always evaluated; the expectation says so too.
    const userPerms = await permsForEmail(userEmail);
    const ess = registry.filter((r) => !r.requiresAdmin && (r.reqPair === null || userPerms.has(r.reqPair)));
    for (const section of SECTIONS) {
      const expected = ess.filter((r) => r.perspective === section).map((r) => r.code).sort();
      expect(codes(b, section).sort()).toEqual(expected);
    }
  });

  // La regressione ha un test suo, che nomina il caso invece di dedurlo: se un domani
  // qualcuno rimettesse il ritorno anticipato nel gate, questo diventa rosso subito e
  // col nome della voce, senza far scavare in un confronto di insiemi.
  it("la console delle segnalazioni NON compare a chi non ha whistleblowing:read", async () => {
    const riga = registry.find((r) => r.code === "whistleblowing-console");
    expect(riga, "la voce non e' nel registro attivo: verifica cieca").toBeTruthy();
    expect(riga!.reqPair).toBe("whistleblowing:read");
    const userPerms = await permsForEmail(userEmail);
    expect(userPerms.has("whistleblowing:read")).toBe(false); // universo dichiarato
    const b = await interfaces(suite, userC);
    expect(allCodes(b)).not.toContain("whistleblowing-console");
  });

  it("MANAGER (admin-class) is per-permission filtered WITHIN the admin sections", async () => {
    const b = await interfaces(suite, managerC);
    const managerPerms = await permsForEmail("paolo.caputo@rtl-bank.org");
    const visible = new Set(allCodes(b));
    // Derived gate (declarative twin of service.getInterfaces): for every admin interface,
    // an admin-class caller sees it iff it has no required perm OR the role holds that perm.
    // This catches both over-exposure (sees something it lacks the perm for) and under-exposure.
    for (const i of registry) {
      if (!i.requiresAdmin) continue; // ESS covered by the USER test
      const shouldSee = i.reqPair === null || managerPerms.has(i.reqPair);
      expect(visible.has(i.code), `${i.code} (reqPair=${i.reqPair ?? "none"})`).toBe(shouldSee);
    }
  });

  it("unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/interfaces" });
    expect(r.statusCode).toBe(401);
  });
});
