/**
 * apps/api/test/evaluation-rbac-perimeter.integration.test.ts — #92 F4.
 *
 * CHI PUÒ ENTRARE NEL CICLO DI VALUTAZIONE.
 *
 * La 000256 aveva derivato la platea dei quattro permessi da chi possiede `talent:read`.
 * Quel perimetro comprende BLUEPRINT_MANAGER e PROCESS_OWNER, il cui mandato — dichiarato
 * in `lib/scope/domains.ts` — è sui CATALOGHI e sui PROCESSI del tenant, «senza leggere lo
 * stipendio di nessuno». Le valutazioni sono dati di PERSONE (classe EVALUATION): due ruoli
 * si erano trovati addosso un accesso che nessuno aveva deciso di dargli.
 *
 * La 000309 lo ha revocato e la 000256 è emendata alla fonte (ADR-0035). Questo file è ciò
 * che impedisce al difetto di tornare: non controlla che una migrazione sia girata, controlla
 * che il PERIMETRO sia quello giusto — comunque ci si arrivi.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

/** I quattro permessi del ciclo, come li ha creati la 000256. */
const PERMESSI = [
  "performance-review:read",
  "performance-review:write",
  "calibration:manage",
  "review-cycle:manage",
] as const;

/** I due mandati di CATALOGO: il loro titolo non arriva ai dati delle persone. */
const MANDATI_DI_CATALOGO = ["BLUEPRINT_MANAGER", "PROCESS_OWNER"] as const;

let t: TestApp;

beforeAll(async () => {
  t = await buildTestApp();
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#92 F4 — il perimetro del ciclo di valutazione", () => {
  it("gira su un universo dove PUÒ fallire: i quattro permessi esistono e sono concessi", async () => {
    const r = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_auth_permissions WHERE auth_permission_code = ANY($1)`,
      [PERMESSI],
    );
    expect(Number(r.rows[0]!.n)).toBe(PERMESSI.length);

    const g = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE p.auth_permission_code = ANY($1)`,
      [PERMESSI],
    );
    expect(Number(g.rows[0]!.n)).toBeGreaterThan(0);
  });

  it("nessun mandato di CATALOGO tocca il ciclo di valutazione", async () => {
    const r = await pool.query<{ ruolo: string; permesso: string }>(
      `SELECT r.auth_role_code AS ruolo, p.auth_permission_code AS permesso
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_roles r       ON r.auth_role_id       = rp.auth_role_id
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE r.auth_role_code = ANY($1) AND p.auth_permission_code = ANY($2)
        ORDER BY 1, 2`,
      [MANDATI_DI_CATALOGO, PERMESSI],
    );
    expect(r.rows.map((x) => `${x.ruolo} → ${x.permesso}`)).toEqual([]);
  });

  it("ma i mandati di catalogo conservano il LORO mandato: la revoca non ha sconfinato", async () => {
    // Se questa cade, il difetto è l'opposto: abbiamo tolto a due ruoli il loro titolo vero.
    for (const ruolo of MANDATI_DI_CATALOGO) {
      const r = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n
           FROM sys.sys_auth_role_permissions rp
           JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
          WHERE r.auth_role_code = $1`,
        [ruolo],
      );
      expect(Number(r.rows[0]!.n)).toBeGreaterThan(0);
    }
  });

  it("HRMS_MANAGER li ha tutti e quattro: è plenipotenziario sui dati business (I22)", async () => {
    const r = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_roles r       ON r.auth_role_id       = rp.auth_role_id
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE r.auth_role_code = 'HRMS_MANAGER' AND p.auth_permission_code = ANY($1)`,
      [PERMESSI],
    );
    expect(Number(r.rows[0]!.n)).toBe(PERMESSI.length);
  });

  it("LIVE: una persona con un mandato di catalogo non entra nelle sessioni di calibrazione", async () => {
    // La prova che conta non è sulla tabella dei permessi: è una persona vera che bussa.
    const p = await pool.query<{ email: string }>(
      `SELECT u.user_email AS email
         FROM sys.sys_users u
         JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                                        AND ur.user_auth_role_revoked_at IS NULL
         JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
        WHERE r.auth_role_code = ANY($1)
          AND u.user_status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM sys.sys_user_auth_roles ur2
              JOIN sys.sys_auth_roles r2 ON r2.auth_role_id = ur2.user_auth_role_role_id
             WHERE ur2.user_auth_role_user_id = u.user_id
               AND ur2.user_auth_role_revoked_at IS NULL
               AND r2.auth_role_code IN ('HRMS_MANAGER','TENANT_ADMIN','PLATFORM_ADMIN','MANAGER'))
        ORDER BY u.user_email
        LIMIT 1`,
      [MANDATI_DI_CATALOGO],
    );
    const email = p.rows[0]?.email;
    if (!email) {
      throw new Error(
        "Nessuna persona attiva con un mandato di solo catalogo: la verifica live non ha " +
          "nulla da guardare e non va contata fra quelle superate.",
      );
    }

    const login = await loginRaw(t.app, email);
    const cookie = login.cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join("; ");

    for (const url of ["/v1/calibration-sessions", "/v1/review-cycles"]) {
      const res = await t.app.inject({ method: "GET", url, headers: { cookie } });
      expect(res.statusCode).toBe(403);
    }
  });
});
