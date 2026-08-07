/**
 * apps/api/test/auth-mfa-exemption.integration.test.ts
 *
 * #9 WI-A + M-8 + M-8b — per-user MFA exemption (sys.sys_auth_mfa_exemptions,
 * mig 000116/000117/000118).
 *
 * M-8b (re-review hardening): an exemption may target ONLY a SERVICE account
 * (user_type='SERVICE', the headless Agent SDK user) — a HUMAN PLATFORM_ADMIN is
 * NOT exemptable (mig 000118 trigger). Every exemption mutation is audited
 * (sys.sys_auth_mfa_exemption_audit). The login gate §3b still bypasses MFA for an
 * ACTIVE exemption (this is how the service user logs in headless). Invariant I7.
 *
 * Subjects: una PERSONA di RTL (non-SERVICE -> rifiutata dal primo lucchetto) + a throwaway
 * SERVICE user created here (eligible + loginable for the bypass proof). Strict cleanup.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";
import { passwordFor } from "./helpers/personas.js";

// L'ATTORE TECNICO e L'ATTORE UMANO sono due cose diverse, e dal 000287 il test deve
// distinguerle. `admin@heuresys.com` e' un'utenza di SERVIZIO (user_type='SERVICE'):
// serve per accedere e costruire la sessione, ma NON puo' piu' fare da esempio di
// «persona», perche' passerebbe il primo lucchetto e verrebbe respinto dal secondo —
// il test resterebbe verde provando qualcos'altro.
// Per il caso «una persona non e' esentabile» serve un utente non-SERVICE, e si prende
// dalla popolazione RTL: le tre persone di Heuresys (Enzo, Chiara, Andrea) NON sono
// impersonabili per principio (Z-262, `isRealPerson`) — la loro password la scelgono
// loro. Qui non si accede come lei, si legge soltanto il suo identificativo.
const ADMIN = "admin@heuresys.com";            // utenza tecnica: accede e apre la sessione
const HUMAN = "federica.marchetti@rtl-bank.org"; // persona (non-SERVICE) -> NOT exemptable
const PASSWORD = passwordFor(ADMIN);
const SVC_EMAIL = "wi-a-svc-test@heuresys.local"; // throwaway SERVICE -> exemptable

const ARGON2 = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4, hashLength: 32 } as const;

describe("/v1/auth/login MFA exemption — M-8 + M-8b (mfaEnforcement=true)", () => {
  let app: TestApp;
  let adminUserId: string;
  let humanUserId: string;
  let svcUserId: string;

  async function login(payload: Record<string, unknown>) {
    return app.app.inject({ method: "POST", url: "/v1/auth/login", payload });
  }
  async function exemptionDelete(userId: string) {
    await pool.query(`DELETE FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_user_id = $1`, [userId]);
  }

  beforeAll(async () => {
    app = await buildTestApp({ mfaEnforcement: true });
    const a = await pool.query<{ user_id: string; user_tenant_id: string }>(
      `SELECT user_id, user_tenant_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [ADMIN],
    );
    if (!a.rows[0]) throw new Error(`persona not seeded: ${ADMIN}`);
    adminUserId = a.rows[0].user_id;
    const h = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`, [HUMAN]);
    if (!h.rows[0]) throw new Error(`persona not seeded: ${HUMAN}`);
    humanUserId = h.rows[0].user_id;
    const tenantId = a.rows[0].user_tenant_id;

    // throwaway SERVICE user (loginable) in admin's tenant
    await pool.query(`DELETE FROM sys.sys_users WHERE lower(user_email) = lower($1)`, [SVC_EMAIL]);
    const su = await pool.query<{ user_id: string }>(
      `INSERT INTO sys.sys_users (user_tenant_id, user_email, user_display_name, user_status, user_type)
       VALUES ($1, $2, 'WI-A Service Test', 'ACTIVE', 'SERVICE') RETURNING user_id`,
      [tenantId, SVC_EMAIL],
    );
    svcUserId = su.rows[0]!.user_id;
    const idt = await pool.query<{ auth_identity_id: string }>(
      `INSERT INTO sys.sys_auth_identities (auth_identity_user_id, auth_identity_provider, auth_identity_email_verified, auth_identity_is_active)
       VALUES ($1, 'LOCAL', true, true) RETURNING auth_identity_id`,
      [svcUserId],
    );
    await pool.query(
      `INSERT INTO sys.sys_auth_credentials (auth_credential_identity_id, auth_credential_algorithm, auth_credential_hash, auth_credential_is_current, auth_credential_must_rotate)
       VALUES ($1, 'ARGON2ID', $2, true, false)`,
      [idt.rows[0]!.auth_identity_id, await argon2.hash(PASSWORD, ARGON2)],
    );
    await exemptionDelete(adminUserId);
    await exemptionDelete(svcUserId);
  });

  afterAll(async () => {
    await exemptionDelete(adminUserId);
    await exemptionDelete(svcUserId);
    await pool.query(`DELETE FROM sys.sys_auth_mfa_exemption_audit WHERE auth_mfa_exemption_audit_user_id = ANY($1::uuid[])`, [[adminUserId, humanUserId, svcUserId]]);
    await pool.query(`DELETE FROM sys.sys_users WHERE user_id = $1`, [svcUserId]); // cascades identity+credential
    await app.app.close();
  });

  it("M-8b: a HUMAN account is NOT exemptable (trigger rejects on user_type)", async () => {
    await expect(
      pool.query(
        `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason) VALUES ($1, $2)`,
        [humanUserId, "must be rejected by 000118"],
      ),
    ).rejects.toThrow();
  });

  // #139 — dal 000284 l'eleggibilita' e' una CONGIUNZIONE: essere un account di
  // servizio non basta piu', serve anche l'iscrizione nominativa. Nasce dalla
  // risposta di Enzo del 2026-08-07 («i due account amministrativi devono poter
  // accedere senza secondo fattore? NO»): finche' `user_type` rispondeva a due
  // domande diverse — «e' una persona?» e «puo' saltare l'MFA?» — marcare SERVICE
  // un account tecnico gli apriva l'eleggibilita' per effetto collaterale.
  // Le due prove che seguono vanno lette INSIEME: la prima da sola direbbe solo che
  // il secondo lucchetto e' chiuso, la seconda che si apre. Servono entrambe.
  it("#139: a SERVICE account NOT on the allowlist is NOT exemptable", async () => {
    await expect(
      pool.query(
        `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled) VALUES ($1, $2, true)`,
        [svcUserId, "must be rejected by 000284 — not listed"],
      ),
    ).rejects.toThrow();
  });

  it("M-8b + #139: a SERVICE account ON the allowlist IS exemptable", async () => {
    await pool.query(
      `INSERT INTO sys.sys_auth_mfa_exemption_eligible_users (auth_mfa_eligible_user_id, auth_mfa_eligible_reason)
       VALUES ($1, $2) ON CONFLICT (auth_mfa_eligible_user_id) DO NOTHING`,
      [svcUserId, "wi-a service account — headless Agent SDK"],
    );
    await expect(
      pool.query(
        `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled) VALUES ($1, $2, true)`,
        [svcUserId, "wi-a service exemption"],
      ),
    ).resolves.toBeTruthy();
  });

  it("M-8b: the exemption mutation is audited", async () => {
    const r = await pool.query<{ n: string; action: string }>(
      `SELECT count(*)::text AS n, max(auth_mfa_exemption_audit_action) AS action
         FROM sys.sys_auth_mfa_exemption_audit WHERE auth_mfa_exemption_audit_user_id = $1`,
      [svcUserId],
    );
    expect(Number(r.rows[0]!.n)).toBeGreaterThanOrEqual(1);
    expect(r.rows[0]!.action).toBe("INSERT");
  });

  it("login bypass: an ACTIVE exemption on the SERVICE account yields a FULL session", async () => {
    // ensure exemption present (from previous test) and no factor
    await pool.query(
      `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled)
       VALUES ($1, 'wi-a service exemption', true) ON CONFLICT (auth_mfa_exemption_user_id) DO UPDATE SET auth_mfa_exemption_enabled = true`,
      [svcUserId],
    );
    const resp = await login({ email: SVC_EMAIL, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    expect((resp.json() as { status: string }).status).toBe("success");
    expect(resp.cookies.map((c) => c.name)).toContain(COOKIES.REFRESH);
  });
});
