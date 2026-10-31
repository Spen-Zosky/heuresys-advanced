/**
 * apps/api/test/difetti-interfacce-20261031.integration.test.ts
 *
 * I difetti delle pagine trovati dall'analisi delle interfacce del 2026-10-31, uno per caso,
 * con le persone di collaudo del mandato K (riusate, non create qui).
 *
 *  - D-06/D-15: RECRUITER e HIRING_MANAGER hanno il pavimento ESS (9 permessi `:self`). Senza,
 *    GET /v1/me/preferences rispondeva 403 e nessuna pagina si apriva; «Il mio team» era nel
 *    menu con un 403 dietro. Causa: la pulizia della 000428 li toglieva a ogni giro.
 *  - D-07: la voce Recruiting chiede `requisition:read`, il permesso delle sue rotte.
 *  - D-17: DPO vede la voce Utenti, SECURITY_ADMIN le voci Ruoli e Policy MFA, perché il
 *    permesso che le voci dichiarano glielo dà il loro mandato.
 *  - INC-10: la voce Ruoli chiede `role_matrix:read`, il permesso della sua pagina (000467).
 *
 * D-10 (skill-categories), l'organico (analytics) e D-22 (build-plan in GET) hanno le loro
 * prove nei file dei rispettivi moduli.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool, pool } from "../src/db/client.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";

const PERSONE = {
  RECRUITER: "recruiter@collaudo.invalid",
  HIRING_MANAGER: "hiring-manager@collaudo.invalid",
  DPO: "dpo@collaudo.invalid",
  SECURITY_ADMIN: "security-admin@collaudo.invalid",
} as const;
type Ruolo = keyof typeof PERSONE;

const PAVIMENTO = [
  "consent:manage:self",
  "gdpr:export:self",
  "leave:request:self",
  "me:content:read",
  "me:preferences:read",
  "me:preferences:update",
  "me:sessions:manage",
  "surveys:respond:self",
  "team:read:self",
];

const cookieHeader = (c: Map<string, string>) =>
  [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

type Corpo = { perspectives: { code: string; interfaces: { code: string; route: string }[] }[] };

describe("analisi interfacce 2026-10-31 — i difetti delle pagine", () => {
  let suite: TestApp;
  const sessioni = new Map<Ruolo, Map<string, string>>();

  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    for (const [ruolo, email] of Object.entries(PERSONE) as [Ruolo, string][]) {
      const r = await loginRaw(suite.app, email, deriveCollaudoPassword(key, email));
      if (r.statusCode !== 200) throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
      const cookies = new Map<string, string>();
      for (const c of r.cookies) cookies.set(c.name, c.value);
      sessioni.set(ruolo, cookies);
    }
  }, 120_000);

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  const get = async (ruolo: Ruolo, url: string) =>
    suite.app.inject({ method: "GET", url, headers: { cookie: cookieHeader(sessioni.get(ruolo)!) } });

  const rotteDelMenu = async (ruolo: Ruolo): Promise<string[]> => {
    const r = await get(ruolo, "/v1/me/interfaces");
    expect(r.statusCode, r.body).toBe(200);
    return (r.json() as Corpo).perspectives.flatMap((p) => p.interfaces.map((i) => i.route));
  };

  it("D-06: RECRUITER e HIRING_MANAGER hanno i 9 permessi del pavimento ESS nel database", async () => {
    const { rows } = await pool.query<{ ruolo: string; n: string }>(
      `SELECT r.auth_role_code AS ruolo, count(*)::text AS n
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE r.auth_role_code IN ('RECRUITER', 'HIRING_MANAGER') AND rp.revoked_at IS NULL
          AND p.auth_permission_code = ANY($1::text[])
        GROUP BY 1 ORDER BY 1`,
      [PAVIMENTO],
    );
    expect(rows).toEqual([
      { ruolo: "HIRING_MANAGER", n: "9" },
      { ruolo: "RECRUITER", n: "9" },
    ]);
  });

  it("D-06: GET /v1/me/preferences risponde 200 a RECRUITER e HIRING_MANAGER (la cornice di ogni pagina)", async () => {
    for (const ruolo of ["RECRUITER", "HIRING_MANAGER"] as const) {
      const r = await get(ruolo, "/v1/me/preferences");
      expect(r.statusCode, `${ruolo}: ${r.body}`).toBe(200);
    }
  });

  it("D-15: «Il mio team» non porta più a un 403 per RECRUITER e HIRING_MANAGER", async () => {
    for (const ruolo of ["RECRUITER", "HIRING_MANAGER"] as const) {
      const r = await get(ruolo, "/v1/me/team");
      expect(r.statusCode, `${ruolo}: ${r.body}`).not.toBe(403);
    }
  });

  it("D-07: la voce Recruiting compare a RECRUITER e HIRING_MANAGER", async () => {
    for (const ruolo of ["RECRUITER", "HIRING_MANAGER"] as const) {
      expect(await rotteDelMenu(ruolo), ruolo).toContain("/recruiting");
    }
  });

  it("D-17: il DPO vede la voce Utenti, e la pagina gli risponde", async () => {
    expect(await rotteDelMenu("DPO")).toContain("/users");
    const r = await get("DPO", "/v1/users?limit=1");
    expect(r.statusCode, r.body).toBe(200);
  });

  it("D-17/INC-10: SECURITY_ADMIN vede Ruoli e Policy MFA, e la pagina dei ruoli gli risponde", async () => {
    const menu = await rotteDelMenu("SECURITY_ADMIN");
    expect(menu).toContain("/admin/roles");
    expect(menu).toContain("/admin/mfa-policy");
    const r = await get("SECURITY_ADMIN", "/v1/auth/role-permissions");
    expect(r.statusCode).toBe(200);
  });

  it("il mandato apre solo le proprie voci: il DPO non vede Ruoli, SECURITY_ADMIN non vede Utenti", async () => {
    expect(await rotteDelMenu("DPO")).not.toContain("/admin/roles");
    expect(await rotteDelMenu("SECURITY_ADMIN")).not.toContain("/users");
  });

  it("INC-10: la voce Ruoli dichiara role_matrix:read", async () => {
    const { rows } = await pool.query<{ coppia: string }>(
      `SELECT ui_interface_required_resource || ':' || ui_interface_required_action AS coppia
         FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'roles'`,
    );
    expect(rows).toEqual([{ coppia: "role_matrix:read" }]);
  });
});
