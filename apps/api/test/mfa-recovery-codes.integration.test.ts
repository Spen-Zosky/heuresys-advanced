import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { sharedMfaService } from "../src/modules/auth/mfa-service.js";
import * as mfaRepo from "../src/modules/auth/mfa-repository.js";
import { passwordFor } from "./helpers/personas.js";

// MVP-4 §2.5 MFA — recovery codes. A throwaway verified TOTP factor is enrolled on a
// dedicated persona (antonio.parisi) so login gates; recovery codes are generated via the
// authenticated endpoint and then used to complete the login second step (bypass), proving
// single-use. Live DB; factor + codes cleaned up in afterAll.

const EMAIL = "antonio.parisi@rtl-bank.org";
const PWD = passwordFor(EMAIL);

function genTotp(secretBase32: string): string {
  return new OTPAuth.TOTP({
    issuer: "Heuresys", algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  }).generate();
}

let app: TestApp;
let userId = "";
let factorId = "";
let secret = "";
let session: { cookies: Map<string, string>; csrf: string };
let codes: string[] = [];

const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
const login = (body: Record<string, unknown>) => app.app.inject({ method: "POST", url: "/v1/auth/login", payload: body });

beforeAll(async () => {
  app = await buildTestApp();
  const r = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1) LIMIT 1`, [EMAIL],
  );
  if (!r.rows[0]) throw new Error(`recovery-codes test persona not seeded: ${EMAIL}`);
  userId = r.rows[0].user_id;

  const enrolled = await sharedMfaService.enrollTotp({ userId, userEmail: EMAIL });
  factorId = enrolled.factorId;
  secret = enrolled.secret;
  await sharedMfaService.verifyTotpSetup({ userId, factorId, code: genTotp(secret) });

  // Full 2-step login (TOTP) → an authenticated session for the recovery-codes endpoint.
  const s1 = await login({ email: EMAIL, password: PWD });
  const ct = (s1.json() as { challengeToken: string }).challengeToken;
  const s2 = await login({ email: EMAIL, password: PWD, challengeToken: ct, mfaCode: genTotp(secret) });
  const cookies = new Map<string, string>();
  for (const c of s2.cookies) cookies.set(c.name, c.value);
  session = { cookies, csrf: (s2.json() as { csrfToken: string }).csrfToken };
});

afterAll(async () => {
  await pool.query(`DELETE FROM sys.sys_auth_mfa_recovery_codes WHERE recovery_code_user_id = $1`, [userId]).catch(() => {});
  if (factorId) await mfaRepo.deleteMfaFactor(pool, factorId, userId).catch(() => {});
});

describe("MFA recovery codes (MVP-4 §2.5)", () => {
  it("CSRF: POST /recovery-codes without x-csrf-token → 403", async () => {
    const r = await app.app.inject({
      method: "POST", url: "/v1/auth/mfa/recovery-codes", headers: { cookie: ch(session.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  it("generates 10 formatted one-time codes (returned once)", async () => {
    const r = await app.app.inject({
      method: "POST", url: "/v1/auth/mfa/recovery-codes",
      headers: { cookie: ch(session.cookies), "x-csrf-token": session.csrf },
    });
    expect(r.statusCode).toBe(200);
    codes = (r.json() as { codes: string[] }).codes;
    expect(codes).toHaveLength(10);
    expect(codes.every((c) => /^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBe(10); // all distinct
  });

  it("GET /recovery-codes reports 10 remaining", async () => {
    const r = await app.app.inject({ method: "GET", url: "/v1/auth/mfa/recovery-codes", headers: { cookie: ch(session.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { remaining: number }).remaining).toBe(10);
  });

  it("a recovery code completes the login second step (bypasses TOTP)", async () => {
    const s1 = await login({ email: EMAIL, password: PWD });
    expect((s1.json() as { status: string }).status).toBe("mfa_required");
    const ct = (s1.json() as { challengeToken: string }).challengeToken;
    const s2 = await login({ email: EMAIL, password: PWD, challengeToken: ct, mfaCode: codes[0] });
    expect(s2.statusCode).toBe(200);
    expect((s2.json() as { status: string }).status).toBe("success");
  });

  // Timeout esplicito, piu' generoso dei 20s globali: questo caso fa DUE login completi
  // in sequenza, e un login costa un hash Argon2id, che e' lento per costruzione. Con il
  // database remoto via tunnel e la macchina sotto il carico della suite intera, il budget
  // globale viene superato — misurato: il file passa in 17,65s da solo e va in timeout
  // dentro la suite completa. Il caso verifica il consumo singolo di un codice di recupero,
  // non la latenza: farlo fallire per il secondo login e' rumore, non un difetto trovato.
  it("the same recovery code cannot be reused (single-use) and remaining drops to 9", async () => {
    const s1 = await login({ email: EMAIL, password: PWD });
    const ct = (s1.json() as { challengeToken: string }).challengeToken;
    const s2 = await login({ email: EMAIL, password: PWD, challengeToken: ct, mfaCode: codes[0] });
    expect(s2.statusCode).toBe(401); // already burned
    const cnt = await app.app.inject({ method: "GET", url: "/v1/auth/mfa/recovery-codes", headers: { cookie: ch(session.cookies) } });
    expect((cnt.json() as { remaining: number }).remaining).toBe(9);
  }, 45_000);

  it("a wrong recovery code is rejected (401)", async () => {
    const s1 = await login({ email: EMAIL, password: PWD });
    const ct = (s1.json() as { challengeToken: string }).challengeToken;
    const s2 = await login({ email: EMAIL, password: PWD, challengeToken: ct, mfaCode: "dead-beef-dead-beef" });
    expect(s2.statusCode).toBe(401);
  });
});
