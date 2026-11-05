/**
 * apps/api/test/adr0050-mandati.integration.test.ts
 *
 * ADR-0050 D1 e D2 (migrazione 000473): chi porta un mandato forte ha il secondo fattore
 * obbligatorio, senza esenzioni.
 *   · D1: l'insieme dei mandati in SQL (sys.f_ruoli_mandato) coincide con MANDATE_ROLES.
 *   · D2, database: un'esenzione per chi porta un mandato non nasce; un mandato per chi ha
 *     un'esenzione attiva non si concede.
 *   · D2, login: chi porta un mandato e non ha un fattore riceve la sessione di sola iscrizione,
 *     anche dove la politica del tenant non lo chiederebbe.
 *   · D3 (migrazione 000474): un'esenzione accesa ha un autore, una persona diversa
 *     dall'esentato, e una scadenza entro 30 giorni; scaduta, vale come assente e la
 *     sentinella sys.v_esenzione_mfa_scaduta_o_senza_autore la segnala.
 *
 * Soggetti: due utenze usa-e-getta create qui (una di servizio, iscritta all'elenco
 * dell'esenzione; una persona con password), cancellate alla fine.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { MANDATE_ROLES } from "../src/lib/scope/mandati.js";
import { isUserMfaExempt } from "../src/modules/auth/repository.js";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";

// Esercita il flusso di autenticazione: i login sono veri, mai presi dalla copia di sessione.
senzaCacheDiSessione();

const SVC_EMAIL = "adr0050-svc-test@heuresys.local";
const PERSONA_EMAIL = "adr0050-persona-test@heuresys.local";
const PASSWORD = "Adr0050-prova-usa-e-getta!";
const ARGON2 = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4, hashLength: 32 } as const;

async function idRuolo(codice: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `SELECT auth_role_id AS id FROM sys.sys_auth_roles WHERE auth_role_code = $1`, [codice]);
  if (!r.rows[0]) throw new Error(`ruolo assente: ${codice}`);
  return r.rows[0].id;
}

async function creaUtenza(tenantId: string, email: string, tipo: "SERVICE" | "STANDARD"): Promise<string> {
  await pool.query(`DELETE FROM sys.sys_users WHERE lower(user_email) = lower($1)`, [email]);
  const u = await pool.query<{ user_id: string }>(
    `INSERT INTO sys.sys_users (user_tenant_id, user_email, user_display_name, user_status, user_type)
     VALUES ($1, $2, 'Prova ADR-0050', 'ACTIVE', $3) RETURNING user_id`,
    [tenantId, email, tipo],
  );
  const userId = u.rows[0]!.user_id;
  const idt = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_auth_identities (auth_identity_user_id, auth_identity_provider, auth_identity_email_verified, auth_identity_is_active)
     VALUES ($1, 'LOCAL', true, true) RETURNING auth_identity_id AS id`,
    [userId],
  );
  await pool.query(
    `INSERT INTO sys.sys_auth_credentials (auth_credential_identity_id, auth_credential_algorithm, auth_credential_hash, auth_credential_is_current, auth_credential_must_rotate)
     VALUES ($1, 'ARGON2ID', $2, true, false)`,
    [idt.rows[0]!.id, await argon2.hash(PASSWORD, ARGON2)],
  );
  return userId;
}

describe("ADR-0050 D1, D2 e D3 — mandati senza esenzioni, esenzioni con autore e scadenza", () => {
  let app: TestApp;
  let tenantId: string;
  let svcId: string;
  let personaId: string;

  beforeAll(async () => {
    app = await buildTestApp({ mfaEnforcement: true });
    const t = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`);
    if (!t.rows[0]) throw new Error("tenant RTL_BANK assente");
    tenantId = t.rows[0].id;
    svcId = await creaUtenza(tenantId, SVC_EMAIL, "SERVICE");
    personaId = await creaUtenza(tenantId, PERSONA_EMAIL, "STANDARD");
    await pool.query(
      `INSERT INTO sys.sys_auth_mfa_exemption_eligible_users (auth_mfa_eligible_user_id, auth_mfa_eligible_reason)
       VALUES ($1, 'prova ADR-0050 D2') ON CONFLICT (auth_mfa_eligible_user_id) DO NOTHING`,
      [svcId],
    );
  });

  afterAll(async () => {
    const ids = [svcId, personaId].filter(Boolean);
    await pool.query(`DELETE FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_user_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM sys.sys_auth_mfa_exemption_audit WHERE auth_mfa_exemption_audit_user_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM sys.sys_users WHERE user_id = ANY($1::uuid[])`, [ids]);
    await app.app.close();
  });

  it("D1: l'insieme SQL dei mandati coincide con MANDATE_ROLES", async () => {
    const r = await pool.query<{ c: string }>(`SELECT sys.f_ruoli_mandato() AS c`);
    expect(r.rows.map((x) => x.c).sort()).toEqual([...MANDATE_ROLES].sort());
  });

  it("D2: a chi porta un mandato non si concede un'esenzione", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
         VALUES ($1, $2, $3)`,
        [svcId, await idRuolo("HRMS_MANAGER"), tenantId],
      );
      await expect(
        client.query(
          `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled,
                                                    auth_mfa_exemption_expires_at, created_by)
           VALUES ($1, 'deve essere rifiutata', true, now() + interval '1 day', $2)`,
          [svcId, personaId],
        ),
      ).rejects.toThrow(/ADR-0050 D2/);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("D2: a chi ha un'esenzione attiva non si concede un mandato; un ruolo senza mandato sì", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled,
                                                  auth_mfa_exemption_expires_at, created_by)
         VALUES ($1, 'esenzione di prova', true, now() + interval '1 day', $2)`,
        [svcId, personaId],
      );
      await client.query("SAVEPOINT prima");
      await expect(
        client.query(
          `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
           VALUES ($1, $2, $3)`,
          [svcId, await idRuolo("TENANT_ADMIN"), tenantId],
        ),
      ).rejects.toThrow(/ADR-0050 D2/);
      await client.query("ROLLBACK TO SAVEPOINT prima");
      await expect(
        client.query(
          `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
           VALUES ($1, $2, $3)`,
          [svcId, await idRuolo("MANAGER"), tenantId],
        ),
      ).resolves.toBeTruthy();
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("D2, login: con un mandato e senza fattore si riceve solo la sessione d'iscrizione", async () => {
    const login = () =>
      app.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: PERSONA_EMAIL, password: PASSWORD } });

    // Il confronto: la stessa persona senza mandato. Se la politica del tenant chiede già
    // l'iscrizione a tutti, il confronto non distinguerebbe niente, e lo si dichiara.
    const politica = await pool.query<{ enabled: boolean; role_codes: string[] | null }>(
      `SELECT auth_mfa_policy_enabled AS enabled, auth_mfa_policy_role_codes AS role_codes
         FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id = $1`,
      [tenantId],
    );
    const p = politica.rows[0];
    const politicaCopreUser = p?.enabled === true && (p.role_codes === null || p.role_codes.includes("USER"));
    const senza = await login();
    expect(senza.statusCode).toBe(200);
    expect((senza.json() as { status: string }).status).toBe(
      politicaCopreUser ? "mfa_enrollment_required" : "success",
    );

    const concessione = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
       VALUES ($1, $2, $3) RETURNING user_auth_role_id AS id`,
      [personaId, await idRuolo("HRMS_MANAGER"), tenantId],
    );
    try {
      const con = await login();
      expect(con.statusCode).toBe(200);
      expect((con.json() as { status: string }).status).toBe("mfa_enrollment_required");
    } finally {
      await pool.query(`DELETE FROM sys.sys_user_auth_roles WHERE user_auth_role_id = $1`, [concessione.rows[0]!.id]);
    }
  });
  it("D3: un'esenzione accesa pretende un autore che sia una persona e una scadenza entro 30 giorni", async () => {
    const client = await pool.connect();
    const prova = async (scadenza: string, autore: string | null) => {
      await client.query("SAVEPOINT p");
      try {
        await client.query(
          `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled,
                                                    auth_mfa_exemption_expires_at, created_by)
           VALUES ($1, 'prova D3', true, ${scadenza}, $2)`,
          [svcId, autore],
        );
        await client.query("ROLLBACK TO SAVEPOINT p");
        return "accettata";
      } catch (e) {
        await client.query("ROLLBACK TO SAVEPOINT p");
        return String((e as Error).message);
      }
    };
    try {
      await client.query("BEGIN");
      expect(await prova("now() + interval '1 day'", null)).toMatch(/ADR-0050 D3/);
      expect(await prova("now() + interval '1 day'", svcId)).toMatch(/ADR-0050 D3/);
      expect(await prova("now() + interval '31 days'", personaId)).toMatch(/ADR-0050 D3/);
      expect(await prova("now() - interval '1 minute'", personaId)).toMatch(/ADR-0050 D3/);
      expect(await prova("now() + interval '30 days'", personaId)).toBe("accettata");
      // Una spenta non chiede niente: chiudere una porta non chiede la firma di nessuno.
      await expect(
        client.query(
          `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled,
                                                    auth_mfa_exemption_expires_at)
           VALUES ($1, 'prova D3 spenta', false, now() - interval '1 day')`,
          [svcId],
        ),
      ).resolves.toBeTruthy();
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("D3: un'esenzione scaduta vale come assente e la sentinella la segnala", async () => {
    // Fuori da una transazione: la scadenza deve passare davvero, e now() dentro una
    // transazione resta fermo al suo inizio.
    await pool.query(
      `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled,
                                                auth_mfa_exemption_expires_at, created_by)
       VALUES ($1, 'prova D3 scadenza', true, clock_timestamp() + interval '2 seconds', $2)`,
      [svcId, personaId],
    );
    try {
      expect(await isUserMfaExempt(pool, svcId)).toBe(true);
      const sentinella = () =>
        pool.query<{ dettaglio: string }>(
          `SELECT dettaglio FROM sys.v_esenzione_mfa_scaduta_o_senza_autore WHERE utente = $1`, [svcId]);
      expect((await sentinella()).rows).toHaveLength(0);
      await pool.query(`SELECT pg_sleep(2.5)`);
      expect(await isUserMfaExempt(pool, svcId)).toBe(false);
      expect((await sentinella()).rows.map((r) => r.dettaglio)).toEqual(["scaduta"]);
    } finally {
      await pool.query(
        `UPDATE sys.sys_auth_mfa_exemptions SET auth_mfa_exemption_enabled = false WHERE auth_mfa_exemption_user_id = $1`,
        [svcId]);
    }
  });
});
