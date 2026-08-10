/**
 * apps/api/test/calibration-sessions.integration.test.ts — #92 passo 3/7.
 * Le 35 sessioni di calibrazione reali di RTL Bank (ingerite dal legacy,
 * mig 000257) sul filo: l'HR le legge con le discussioni e i voti; il platform
 * vede le sessioni ma non le note aggregate ne' i voti (ADR-0032); chi non ha
 * il permesso non entra. Attesi derivati dal DB, mai scritti a mano.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const HR_EMAIL = "federica.marchetti@rtl-bank.org";
const PLATFORM_EMAIL = "enzo.spenuso@heuresys.com";

const DISCUSSION_JUDGMENT = [
  "adjustmentReason", "calibratedPotential", "calibratedRating",
  "notes", "originalPotential", "originalRating",
];

let t: TestApp;
const cookies: Record<string, string> = {};
let dbSessions = 0;
/** Una sessione con discussioni e una con partecipanti, scelte dal DB. */
let sessionWithDiscussions = "";
let discussionsExpected = 0;
let sessionWithParticipants = "";
let participantsExpected = 0;

async function cookieOf(email: string): Promise<string> {
  const r = await loginRaw(t.app, email);
  return r.cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; ");
}

beforeAll(async () => {
  t = await buildTestApp();
  cookies.hr = await cookieOf(HR_EMAIL);
  cookies.platform = await cookieOf(PLATFORM_EMAIL);

  dbSessions = Number((await pool.query(`SELECT count(*)::int AS n FROM sys.sys_calibration_sessions`)).rows[0]!.n);
  const d = (await pool.query<{ sid: string; n: string }>(
    `SELECT calibration_discussion_session_id AS sid, count(*)::int AS n
       FROM sys.sys_calibration_discussions GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`)).rows[0];
  sessionWithDiscussions = d?.sid ?? "";
  discussionsExpected = Number(d?.n ?? 0);
  const p = (await pool.query<{ sid: string; n: string }>(
    `SELECT calibration_participant_session_id AS sid, count(*)::int AS n
       FROM sys.sys_calibration_participants GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`)).rows[0];
  sessionWithParticipants = p?.sid ?? "";
  participantsExpected = Number(p?.n ?? 0);
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#92 passo 3/7 — /v1/calibration-sessions", () => {
  it("gira su un universo dove PUÒ fallire", () => {
    expect(dbSessions).toBeGreaterThan(0);
    expect(sessionWithDiscussions).toBeTruthy();
    expect(discussionsExpected).toBeGreaterThan(0);
    expect(participantsExpected).toBeGreaterThan(0);
  });

  it("l'HR legge le sessioni reali, col dettaglio dei partecipanti", async () => {
    const list = await t.app.inject({ method: "GET", url: "/v1/calibration-sessions/?limit=50", headers: { cookie: cookies.hr! } });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Record<string, unknown>[]; total: number };
    expect(body.total).toBe(dbSessions);
    expect(body.items.some((s) => Object.hasOwn(s, "summaryNotes"))).toBe(true);
    for (const s of body.items) expect(s["masked"]).toBeUndefined();

    const det = await t.app.inject({
      method: "GET", url: `/v1/calibration-sessions/${sessionWithParticipants}`, headers: { cookie: cookies.hr! } });
    expect(det.statusCode).toBe(200);
    const dj = det.json() as { session: Record<string, unknown>; participants: unknown[] };
    expect(dj.participants.length).toBe(participantsExpected);
  });

  it("l'HR legge le discussioni coi voti", async () => {
    const res = await t.app.inject({
      method: "GET", url: `/v1/calibration-sessions/${sessionWithDiscussions}/discussions`, headers: { cookie: cookies.hr! } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Record<string, unknown>[]; total: number };
    expect(body.total).toBe(discussionsExpected);
    const withRating = body.items.filter((d) => d["originalRating"] != null);
    expect(withRating.length, "nessun voto visibile all'HR: prova cieca").toBeGreaterThan(0);
    for (const d of body.items) expect(d["masked"]).toBeUndefined();
  });

  it("platform: sessioni visibili senza note aggregate, discussioni senza voti", async () => {
    const list = await t.app.inject({ method: "GET", url: "/v1/calibration-sessions/?limit=50", headers: { cookie: cookies.platform! } });
    expect(list.statusCode).toBe(200);
    const lj = list.json() as { items: Record<string, unknown>[]; total: number };
    expect(lj.total).toBe(dbSessions); // la riga resta (ADR-0032)
    for (const s of lj.items) {
      expect(s["masked"]).toEqual(["summaryNotes"]);
      expect(Object.hasOwn(s, "summaryNotes")).toBe(false);
      expect(s["name"], "il nome della sessione resta").toBeTruthy();
    }

    const res = await t.app.inject({
      method: "GET", url: `/v1/calibration-sessions/${sessionWithDiscussions}/discussions`, headers: { cookie: cookies.platform! } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Record<string, unknown>[]; total: number };
    expect(body.total).toBe(discussionsExpected); // tutte le righe, nessun voto
    for (const d of body.items) {
      expect(d["masked"]).toEqual([...DISCUSSION_JUDGMENT].sort());
      for (const f of DISCUSSION_JUDGMENT) expect(Object.hasOwn(d, f), `${f} dev'essere ASSENTE`).toBe(false);
      expect(d["subjectUserId"], "il soggetto resta").toBeTruthy();
    }
    expect(res.body.includes('"originalRating":')).toBe(false);
  });

  it("senza performance-review:read la superficie e' FORBIDDEN", async () => {
    const { rows } = await pool.query<{ email: string }>(
      `SELECT u.user_email AS email FROM sys.sys_users u
        WHERE EXISTS (SELECT 1 FROM sys.sys_auth_identities i
                       JOIN sys.sys_auth_credentials c ON c.auth_credential_identity_id = i.auth_identity_id
                      WHERE i.auth_identity_user_id = u.user_id AND i.auth_identity_is_active)
          AND EXISTS (SELECT 1 FROM sys.sys_auth_mfa_factors f WHERE f.auth_mfa_factor_user_id = u.user_id)
          AND NOT EXISTS (
            SELECT 1 FROM sys.sys_user_auth_roles ur
              JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
              JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
             WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
               AND p.auth_permission_code = 'performance-review:read')
        ORDER BY u.user_email LIMIT 1`);
    if (!rows[0]) throw new Error("nessun utente senza il permesso: verifica cieca");
    const plain = await cookieOf(rows[0].email);
    const res = await t.app.inject({ method: "GET", url: "/v1/calibration-sessions/?limit=5", headers: { cookie: plain } });
    expect(res.statusCode).toBe(403);
  });
});
