/**
 * apps/api/test/adr0050-mandato-atto.integration.test.ts
 *
 * ADR-0050 D4 e D7 (migrazione 000475, modulo mandate-acts).
 *   · D4: un mandato forte non si concede né si revoca con un gesto solo (409
 *     MANDATE_REQUIRES_ACT); si propone un atto, lo decide un secondo titolare (mai chi lo
 *     propone, mai chi lo riceve), e solo l'approvazione produce l'effetto, che porta il
 *     riferimento all'atto. Ogni nascita e decisione va nel registro di audit.
 *   · D4, riconferma: una concessione di prima, senza atto, si riconferma con un atto CONFIRM
 *     ed esce da sys.v_mandato_da_riconfermare.
 *   · D7: le coppie incompatibili si rifiutano alla proposta e, senza scampo, nel database.
 *     L'elenco in SQL (sys.f_mandati_incompatibili) coincide con INCOMPATIBILI.
 *
 * Attori: governo@ (TENANT_ADMIN) e security-admin@ (SECURITY_ADMIN) di RTL Bank, i due
 * titolari che si propongono e si approvano a vicenda. La suite gira in una transazione di
 * file annullata alla fine: nessun atto e nessuna concessione restano.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { INCOMPATIBILI, MANDATE_ROLES } from "../src/lib/scope/mandati.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";
import { MANDATE_ROLE_CODES, ROLE_CODES } from "@heuresys/shared";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";

// Scrive concessioni di ruolo: le sessioni non si prendono dalla copia condivisa.
senzaCacheDiSessione();

const GOVERNO = "governo@collaudo.invalid";
const SECURITY = "security-admin@collaudo.invalid";
const DPO = "dpo@collaudo.invalid";
const TARGET = "alberto.colombo@rtl-bank.org";
const FUORI_TENANT = "platform-test-admin@collaudo.invalid";

interface Auth { cookies: Map<string, string>; csrfToken: string }

async function login(t: TestApp, email: string): Promise<Auth> {
  const r = await loginRaw(t.app, email, deriveCollaudoPassword(readCollaudoKey(), email));
  if (r.statusCode !== 200) throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
function headers(a: Auth) {
  return {
    cookie: [...a.cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; "),
    "x-csrf-token": a.csrfToken,
    "content-type": "application/json",
  };
}
async function idUtente(email: string): Promise<string> {
  const r = await pool.query<{ id: string }>(`SELECT user_id AS id FROM sys.sys_users WHERE lower(user_email) = lower($1)`, [email]);
  if (!r.rows[0]) throw new Error(`utente assente: ${email}`);
  return r.rows[0].id;
}
function fraGiorni(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

interface Act { actId: string; status: string; grantId: string | null; kind: string; roleCode: string }
interface ErrBody { error: { code: string } }

describe("ADR-0050 D4 e D7 — il mandato come atto, la separazione dei compiti", () => {
  let suite: TestApp;
  let governo: Auth;
  let security: Auth;
  let targetId: string;
  let governoId: string;

  const proponi = (chi: Auth, payload: Record<string, unknown>) =>
    suite.app.inject({ method: "POST", url: "/v1/mandate-acts", headers: headers(chi), payload });
  const decidi = (chi: Auth, actId: string, verbo: "approve" | "reject" | "withdraw", payload: Record<string, unknown> = {}) =>
    suite.app.inject({ method: "POST", url: `/v1/mandate-acts/${actId}/${verbo}`, headers: headers(chi), payload });

  beforeAll(async () => {
    suite = await buildTestApp();
    governo = await login(suite, GOVERNO);
    security = await login(suite, SECURITY);
    targetId = await idUtente(TARGET);
    governoId = await idUtente(GOVERNO);
  });
  afterAll(async () => {
    await suite.app.close();
  });

  it("D7: l'elenco delle coppie incompatibili in SQL coincide con INCOMPATIBILI", async () => {
    const codici = [...ROLE_CODES];
    const { rows } = await pool.query<{ a: string; b: string }>(
      `SELECT a, b FROM unnest($1::text[]) a, unnest($1::text[]) b
        WHERE a < b AND sys.f_mandati_incompatibili(a, b)`,
      [codici],
    );
    const sql = rows.map((r) => `${r.a}|${r.b}`).sort();
    const ts = INCOMPATIBILI.map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)).sort();
    expect(sql).toEqual(ts);
    // ogni ruolo di una coppia è un mandato: D7 vive nella stessa funzione di D4
    for (const [a, b] of INCOMPATIBILI) {
      expect(MANDATE_ROLES.has(a) && MANDATE_ROLES.has(b), `${a}/${b}`).toBe(true);
    }
  });

  it("D1: l'elenco dei mandati per le pagine coincide con MANDATE_ROLES e con sys.f_ruoli_mandato()", async () => {
    expect([...MANDATE_ROLE_CODES].sort()).toEqual([...MANDATE_ROLES].sort());
    const { rows } = await pool.query<{ r: string }>(`SELECT r FROM sys.f_ruoli_mandato() r`);
    expect(rows.map((x) => x.r).sort()).toEqual([...MANDATE_ROLE_CODES].sort());
  });

  it("D4: un mandato non si concede né si revoca con un gesto solo", async () => {
    const r = await suite.app.inject({
      method: "POST", url: `/v1/users/${targetId}/roles`, headers: headers(governo),
      payload: { roleCode: "HRMS_MANAGER" },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as ErrBody).error.code).toBe("MANDATE_REQUIRES_ACT");

    const dpoGrant = await pool.query<{ id: string }>(
      `SELECT g.user_auth_role_id AS id FROM sys.sys_user_auth_roles g
         JOIN sys.sys_users u ON u.user_id = g.user_auth_role_user_id
        WHERE lower(u.user_email) = $1 AND g.user_auth_role_revoked_at IS NULL`, [DPO]);
    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/users/${await idUtente(DPO)}/roles/${dpoGrant.rows[0]!.id}`, headers: headers(governo),
    });
    expect(del.statusCode).toBe(409);
    expect((del.json() as ErrBody).error.code).toBe("MANDATE_REQUIRES_ACT");
  });

  it("D4: la proposta ha motivo e revisione, non è per sé, resta nel tenant", async () => {
    const senzaRevisione = await proponi(governo, {
      kind: "GRANT", userId: targetId, roleCode: "HRMS_MANAGER", reason: "copertura della direzione HR",
    });
    expect(senzaRevisione.statusCode).toBe(400);

    const revisionePassata = await proponi(governo, {
      kind: "GRANT", userId: targetId, roleCode: "HRMS_MANAGER", reason: "copertura della direzione HR",
      reviewBy: fraGiorni(-1),
    });
    expect(revisionePassata.statusCode).toBe(400);

    const oltreUnAnno = await proponi(governo, {
      kind: "GRANT", userId: targetId, roleCode: "HRMS_MANAGER", reason: "copertura della direzione HR",
      reviewBy: fraGiorni(400),
    });
    expect(oltreUnAnno.statusCode).toBe(400);

    const perSe = await proponi(governo, {
      kind: "GRANT", userId: governoId, roleCode: "HRMS_MANAGER", reason: "copertura della direzione HR",
      reviewBy: fraGiorni(90),
    });
    expect(perSe.statusCode).toBe(403);
    expect((perSe.json() as ErrBody).error.code).toBe("MANDATE_SELF_PROPOSAL");

    const fuori = await proponi(governo, {
      kind: "GRANT", userId: await idUtente(FUORI_TENANT), roleCode: "HRMS_MANAGER",
      reason: "copertura della direzione HR", reviewBy: fraGiorni(90),
    });
    expect(fuori.statusCode).toBe(404);

    const nonMandato = await proponi(governo, {
      kind: "GRANT", userId: targetId, roleCode: "TEAM_LEADER", reason: "guida della squadra di filiale",
      reviewBy: fraGiorni(90),
    });
    expect(nonMandato.statusCode).toBe(409);
    expect((nonMandato.json() as ErrBody).error.code).toBe("NOT_A_MANDATE");
  });

  it("D4: proposta, approvazione di un secondo titolare, effetto con il riferimento all'atto, poi revoca", async () => {
    const p = await proponi(governo, {
      kind: "GRANT", userId: targetId, roleCode: "HRMS_MANAGER",
      reason: "copertura della direzione HR durante la riorganizzazione", reviewBy: fraGiorni(90),
    });
    expect(p.statusCode, p.body).toBe(201);
    const atto = p.json() as Act;
    expect(atto.status).toBe("PENDING");
    expect(atto.grantId).toBeNull();

    // nessun effetto prima dell'approvazione
    const prima = await pool.query(
      `SELECT 1 FROM sys.sys_user_auth_roles g JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
        WHERE g.user_auth_role_user_id = $1 AND r.auth_role_code = 'HRMS_MANAGER' AND g.user_auth_role_revoked_at IS NULL`,
      [targetId]);
    expect(prima.rowCount).toBe(0);

    const doppia = await proponi(governo, {
      kind: "GRANT", userId: targetId, roleCode: "HRMS_MANAGER",
      reason: "copertura della direzione HR durante la riorganizzazione", reviewBy: fraGiorni(90),
    });
    expect(doppia.statusCode).toBe(409);
    expect((doppia.json() as ErrBody).error.code).toBe("MANDATE_ACT_PENDING");

    const daSe = await decidi(governo, atto.actId, "approve");
    expect(daSe.statusCode).toBe(403);
    expect((daSe.json() as ErrBody).error.code).toBe("MANDATE_SAME_PERSON");

    const ok = await decidi(security, atto.actId, "approve", { note: "verificata con la direzione" });
    expect(ok.statusCode, ok.body).toBe(200);
    const approvato = ok.json() as Act;
    expect(approvato.status).toBe("APPROVED");
    expect(approvato.grantId).not.toBeNull();

    const ruoli = await suite.app.inject({ method: "GET", url: `/v1/users/${targetId}/roles`, headers: headers(governo) });
    const hrms = (ruoli.json() as { items: Array<{ roleCode: string; actId: string | null; reviewBy: string | null }> })
      .items.find((g) => g.roleCode === "HRMS_MANAGER");
    expect(hrms?.actId).toBe(atto.actId);
    expect(hrms?.reviewBy).toBe(fraGiorni(90));

    const audit = await pool.query<{ op: string; status: string }>(
      `SELECT mandate_act_audit_op AS op, mandate_act_audit_status AS status FROM sys.sys_mandate_act_audit
        WHERE mandate_act_audit_act_id = $1 ORDER BY created_at, mandate_act_audit_op`, [atto.actId]);
    expect(audit.rows.map((r) => `${r.op}:${r.status}`)).toEqual(["INSERT:PENDING", "UPDATE:APPROVED"]);

    // decisa, non si decide di nuovo
    const ancora = await decidi(governo, atto.actId, "reject", { note: "ripensamento" });
    expect(ancora.statusCode).toBe(409);

    // D7 alla proposta: un DPO non porta un mandato HR in chiaro
    const dpo = await proponi(governo, {
      kind: "GRANT", userId: targetId, roleCode: "DPO", reason: "nomina a responsabile della protezione dei dati",
      reviewBy: fraGiorni(90),
    });
    expect(dpo.statusCode).toBe(409);
    expect((dpo.json() as ErrBody).error.code).toBe("MANDATE_INCOMPATIBLE");

    // la revoca: proposta da uno, approvata dall'altro
    const r = await proponi(security, {
      kind: "REVOKE", userId: targetId, grantId: approvato.grantId, reason: "fine della riorganizzazione",
    });
    expect(r.statusCode, r.body).toBe(201);
    const revoca = await decidi(governo, (r.json() as Act).actId, "approve");
    expect(revoca.statusCode, revoca.body).toBe(200);
    const dopo = await pool.query<{ revoked: boolean; act: string | null }>(
      `SELECT user_auth_role_revoked_at IS NOT NULL AS revoked, user_auth_role_revoke_act_id AS act
         FROM sys.sys_user_auth_roles WHERE user_auth_role_id = $1`, [approvato.grantId]);
    expect(dopo.rows[0]).toEqual({ revoked: true, act: (r.json() as Act).actId });
  });

  it("D4: rifiuto con nota di un altro titolare, ritiro solo del proponente", async () => {
    const p = await proponi(governo, {
      kind: "GRANT", userId: targetId, roleCode: "PEOPLE_MANAGER", reason: "gestione operativa delle persone",
      reviewBy: fraGiorni(60),
    });
    expect(p.statusCode, p.body).toBe(201);
    const id = (p.json() as Act).actId;
    expect((await decidi(security, id, "reject", {})).statusCode).toBe(400); // la nota è obbligatoria
    const rif = await decidi(security, id, "reject", { note: "non serve, copre già la direzione" });
    expect(rif.statusCode).toBe(200);
    expect((rif.json() as Act).status).toBe("REJECTED");

    const q = await proponi(governo, {
      kind: "GRANT", userId: targetId, roleCode: "PEOPLE_MANAGER", reason: "gestione operativa delle persone",
      reviewBy: fraGiorni(60),
    });
    const id2 = (q.json() as Act).actId;
    const altrui = await decidi(security, id2, "withdraw");
    expect(altrui.statusCode).toBe(403);
    expect((altrui.json() as ErrBody).error.code).toBe("MANDATE_NOT_PROPOSER");
    const mio = await decidi(governo, id2, "withdraw");
    expect(mio.statusCode).toBe(200);
    expect((mio.json() as Act).status).toBe("WITHDRAWN");
  });

  it("D4: una concessione di prima si riconferma con un atto ed esce dall'elenco da riconfermare", async () => {
    const dpoId = await idUtente(DPO);
    const g = await pool.query<{ id: string }>(
      `SELECT concessione AS id FROM sys.v_mandato_da_riconfermare WHERE utente = $1 AND ruolo = 'DPO'`, [dpoId]);
    expect(g.rowCount).toBe(1);
    const grantId = g.rows[0]!.id;

    const p = await proponi(security, {
      kind: "CONFIRM", userId: dpoId, grantId, reason: "riconferma della nomina del DPO", reviewBy: fraGiorni(180),
    });
    expect(p.statusCode, p.body).toBe(201);
    const ok = await decidi(governo, (p.json() as Act).actId, "approve");
    expect(ok.statusCode, ok.body).toBe(200);

    const dopo = await pool.query(`SELECT 1 FROM sys.v_mandato_da_riconfermare WHERE concessione = $1`, [grantId]);
    expect(dopo.rowCount).toBe(0);
    const riga = await pool.query<{ act: string; review: string }>(
      `SELECT user_auth_role_act_id AS act, to_char(user_auth_role_review_by, 'YYYY-MM-DD') AS review
         FROM sys.sys_user_auth_roles WHERE user_auth_role_id = $1`, [grantId]);
    expect(riga.rows[0]).toEqual({ act: (p.json() as Act).actId, review: fraGiorni(180) });
  });

  it("D4 e D7 nel database: le regole valgono anche per chi scrive senza l'API", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const rifiuto = async (sql: string, params: unknown[]): Promise<string> => {
        await client.query("SAVEPOINT s");
        try {
          await client.query(sql, params);
          await client.query("RELEASE SAVEPOINT s");
          return "accettata";
        } catch (e) {
          await client.query("ROLLBACK TO SAVEPOINT s");
          return (e as Error).message;
        }
      };
      const ruolo = async (c: string) =>
        (await client.query<{ id: string }>(`SELECT auth_role_id AS id FROM sys.sys_auth_roles WHERE auth_role_code = $1`, [c])).rows[0]!.id;
      const tenant = (await client.query<{ t: string }>(`SELECT user_tenant_id AS t FROM sys.sys_users WHERE user_id = $1`, [targetId])).rows[0]!.t;

      // D7: SECURITY_ADMIN e TENANT_ADMIN sulla stessa persona
      expect(await rifiuto(
        `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
         VALUES ($1, $2, $3)`, [governoId, await ruolo("SECURITY_ADMIN"), tenant])).toMatch(/ADR-0050 D7/);

      // D4: un atto nasce PENDING, e lo approva solo chi porta un mandato
      const persona = (await client.query<{ id: string }>(
        `SELECT u.user_id AS id FROM sys.sys_users u
          WHERE u.user_tenant_id = $1 AND u.user_status = 'ACTIVE' AND u.user_type = 'STANDARD' AND u.user_id <> $2
            AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles g JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
                             WHERE g.user_auth_role_user_id = u.user_id AND g.user_auth_role_revoked_at IS NULL
                               AND r.auth_role_code IN (SELECT sys.f_ruoli_mandato()))
          LIMIT 1`, [tenant, targetId])).rows[0]!.id;
      expect(await rifiuto(
        `INSERT INTO sys.sys_mandate_acts (mandate_act_kind, mandate_act_user_id, mandate_act_role_id, mandate_act_tenant_id,
           mandate_act_reason, mandate_act_review_by, mandate_act_status, mandate_act_proposed_by)
         VALUES ('GRANT', $1, $2, $3, 'prova nel database', CURRENT_DATE + 30, 'APPROVED', $4)`,
        [targetId, await ruolo("HRMS_MANAGER"), tenant, governoId])).toMatch(/born PENDING/);
      const atto = (await client.query<{ id: string }>(
        `INSERT INTO sys.sys_mandate_acts (mandate_act_kind, mandate_act_user_id, mandate_act_role_id, mandate_act_tenant_id,
           mandate_act_reason, mandate_act_review_by, mandate_act_proposed_by)
         VALUES ('GRANT', $1, $2, $3, 'prova nel database', CURRENT_DATE + 30, $4) RETURNING mandate_act_id AS id`,
        [targetId, await ruolo("HRMS_MANAGER"), tenant, governoId])).rows[0]!.id;
      expect(await rifiuto(
        `UPDATE sys.sys_mandate_acts SET mandate_act_status = 'APPROVED', mandate_act_decided_by = $2, mandate_act_decided_at = now()
          WHERE mandate_act_id = $1`, [atto, persona])).toMatch(/approver must hold a mandate/);
      expect(await rifiuto(
        `UPDATE sys.sys_mandate_acts SET mandate_act_status = 'APPROVED', mandate_act_decided_by = $2, mandate_act_decided_at = now()
          WHERE mandate_act_id = $1`, [atto, governoId])).toMatch(/sys_mandate_acts_persone_ck/);
      expect(await rifiuto(
        `UPDATE sys.sys_mandate_acts SET mandate_act_reason = 'altro motivo, cambiato dopo' WHERE mandate_act_id = $1`,
        [atto])).toMatch(/does not change/);

      // D4: un effetto che cita un atto non approvato non nasce
      expect(await rifiuto(
        `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id, user_auth_role_act_id)
         VALUES ($1, $2, $3, $4)`, [targetId, await ruolo("HRMS_MANAGER"), tenant, atto])).toMatch(/not an approved act/);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("le sentinelle di D4 e D7 sono a zero", async () => {
    const inc = await pool.query(`SELECT * FROM sys.v_mandati_incompatibili`);
    expect(inc.rows).toEqual([]);
    const scad = await pool.query(`SELECT * FROM sys.v_mandato_revisione_scaduta`);
    expect(scad.rows).toEqual([]);
  });
});
