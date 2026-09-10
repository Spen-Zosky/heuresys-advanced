/**
 * apps/api/test/job-roles.integration.test.ts
 *
 * Integration tests for /v1/job-roles/* (sys.sys_job_roles).
 * Routes (apps/api/src/modules/job-roles/routes.ts):
 *   GET   /            job_role:read   (open to all per matrix)
 *   GET   /:id         job_role:read
 *   POST  /            job_role:create (CSRF) -> 201
 *   PATCH /:id         job_role:update (CSRF) -> 200
 *
 * Authorization is enforced purely by requirePermission (RBAC middleware) — the
 * service throws NO custom *_ADMIN_ONLY code. A denied persona therefore gets a
 * 403 with the RBAC ForbiddenError DEFAULT code "FORBIDDEN" (rbac.ts line 87 passes
 * no explicit code). job_role:create/update are granted to PLATFORM_ADMIN,
 * TENANT_ADMIN, HRMS_MANAGER; a USER persona lacks them.
 *
 * Tests hit the live OCI VM DB through the SSH tunnel; rows created here are
 * cleaned up in afterAll. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { codiciDelProfilo, perimetroDiCatalogo } from "../src/lib/scope/profilo.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_JR_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let platformS: S;
let userS: S;
const createdJobRoleIds: string[] = [];

interface ErrEnvelope {
  error: { code: string; message: string; requestId?: string };
}

describe("/v1/job-roles/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "enzo.spenuso@heuresys.com");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdJobRoleIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_job_roles WHERE job_role_id = $1`, [id]);
      } catch {
        /* ignore cleanup errors */
      }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/job-roles" });
    expect(r.statusCode).toBe(401);
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/job-roles?limit=5",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown; total: unknown };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("CREATE / GET:id / readback as PLATFORM_ADMIN happy path → 201 then 200", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/job-roles",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      // jobFamilyId omitted (ADR-0015: optional+nullable).
      payload: { code, name: "Integration Happy Role", seniorityLevel: "MID" },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as { jobRoleId: string; code: string; name: string };
    expect(c.code).toBe(code);
    expect(typeof c.jobRoleId).toBe("string");
    createdJobRoleIds.push(c.jobRoleId);

    const got = await suite.app.inject({
      method: "GET",
      url: `/v1/job-roles/${c.jobRoleId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    const g = got.json() as { jobRoleId: string; code: string };
    expect(g.jobRoleId).toBe(c.jobRoleId);
    expect(g.code).toBe(code);
  });

  it("GET:id with random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/job-roles/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrEnvelope).error.code).toBe("NOT_FOUND");
  });

  it("USER (lacks job_role:create) cannot create → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-roles",
      headers: {
        cookie: ch(userS.cookies),
        "x-csrf-token": userS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_BLOCK`, name: "Blocked Role" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrEnvelope).error.code).toBe("FORBIDDEN");
  });

  it("duplicate job role code → 409 JOB_ROLE_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST",
      url: "/v1/job-roles",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, name: "First Dup Role" },
    });
    expect(first.statusCode).toBe(201);
    createdJobRoleIds.push((first.json() as { jobRoleId: string }).jobRoleId);

    const dup = await suite.app.inject({
      method: "POST",
      url: "/v1/job-roles",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, name: "Second Dup Role" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as ErrEnvelope).error.code).toBe("JOB_ROLE_CODE_CONFLICT");
  });

  // ══════════════════════════════════════════════════════════════════════════════════════
  // B21 + B22 (ADR-0039) — LA PROVA A ESITI OPPOSTI SUL PROFILO DEL CLIENTE.
  //
  // La domanda e' una sola — «dammi i ruoli professionali» — e le risposte devono essere
  // DUE: chi amministra la piattaforma riceve il catalogo intero, un utente della banca
  // riceve solo il proprio profilo. Se le due risposte coincidessero, il filtro non
  // esisterebbe: e' cosi' che questa prova sa fallire.
  //
  // ⚠ NIENTE E' SCRITTO A MANO. I ruoli fuori dal profilo si ri-derivano dal database vivo
  // (le tabelle di contenuto del modello attivo della banca), mai da un elenco nel test:
  // un elenco cablato sarebbe vero il giorno in cui lo si scrive e falso al giro dopo.
  // ══════════════════════════════════════════════════════════════════════════════════════
  it("B21 — un utente della banca NON riceve i ruoli fuori dal suo profilo, chi amministra la piattaforma SI'", async () => {
    // ① Il fatto, misurato sul vivo: quali ruoli il catalogo ha e il profilo della banca no.
    const fuoriProfilo = await pool.query<{ code: string }>(
      `SELECT jr.job_role_code AS code
         FROM sys.sys_job_roles jr
        WHERE jr.job_role_tenant_id IS NULL
          AND NOT EXISTS (
            SELECT 1
              FROM sys.sys_blueprint_content_job_roles ct
              JOIN sys.sys_blueprint_variant_versions vv
                ON vv.blueprint_variant_version_id = ct.blueprint_content_job_role_version_id
               AND vv.blueprint_variant_version_status = 'PUBLISHED'
              JOIN sys.sys_blueprint_activations a
                ON a.blueprint_activation_variant_id = vv.blueprint_variant_version_variant_id
               AND a.blueprint_activation_status = 'ACTIVE'
              JOIN sys.sys_tenancies t
                ON t.tenant_id = a.blueprint_activation_tenant_id
               AND t.tenant_code = 'RTL_BANK'
             WHERE ct.blueprint_content_job_role_code = jr.job_role_code)`,
    );
    // Se il profilo coprisse tutto il catalogo la prova non potrebbe distinguere nulla, e un
    // verde nascerebbe dal vuoto: qui si ferma, dicendo perche'.
    expect(
      fuoriProfilo.rowCount,
      "il profilo della banca copre TUTTO il catalogo: la prova non puo' discriminare",
    ).toBeGreaterThan(0);
    const codiciFuori = new Set(fuoriProfilo.rows.map((r) => r.code));

    // ② L'utente della banca: nessuno di quei codici deve comparire.
    const banca = await suite.app.inject({
      method: "GET",
      url: "/v1/job-roles?limit=200",
      headers: { cookie: ch(userS.cookies) },
    });
    expect(banca.statusCode).toBe(200);
    const visti = (banca.json() as { items: { code: string }[] }).items.map((i) => i.code);
    const trapelati = visti.filter((c) => codiciFuori.has(c));
    expect(trapelati, `ruoli fuori profilo restituiti alla banca: ${trapelati.join(", ")}`)
      .toEqual([]);

    // ③ Chi amministra la piattaforma li vede: e' l'esito OPPOSTO sulla stessa domanda, ed e'
    //    anche la prova che il catalogo NON si e' svuotato (condizione posta da Enzo).
    const piattaforma = await suite.app.inject({
      method: "GET",
      url: "/v1/job-roles?limit=200",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(piattaforma.statusCode).toBe(200);
    const vistiDaPiattaforma = new Set(
      (piattaforma.json() as { items: { code: string }[] }).items.map((i) => i.code),
    );
    const primoFuori = [...codiciFuori][0]!;
    expect(vistiDaPiattaforma.has(primoFuori), `il catalogo intero non contiene ${primoFuori}`)
      .toBe(true);
    expect(vistiDaPiattaforma.size).toBeGreaterThan(visti.length);
  });

  it("B21 — un ruolo fuori profilo non e' leggibile per identificativo dalla banca (404, non 403)", async () => {
    // Il filtro sull'elenco si aggirerebbe chiedendo la riga per uuid: qui si verifica che
    // non si aggiri. E la risposta e' 404 perche' un 403 direbbe che quel ruolo esiste.
    const fuori = await pool.query<{ id: string }>(
      `SELECT jr.job_role_id AS id
         FROM sys.sys_job_roles jr
        WHERE jr.job_role_tenant_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM sys.sys_blueprint_content_job_roles ct
             WHERE ct.blueprint_content_job_role_code = jr.job_role_code)
        LIMIT 1`,
    );
    expect(fuori.rowCount, "nessun ruolo fuori profilo: la prova non discrimina").toBe(1);
    const id = fuori.rows[0]!.id;

    const daBanca = await suite.app.inject({
      method: "GET",
      url: `/v1/job-roles/${id}`,
      headers: { cookie: ch(userS.cookies) },
    });
    expect(daBanca.statusCode).toBe(404);

    const daPiattaforma = await suite.app.inject({
      method: "GET",
      url: `/v1/job-roles/${id}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(daPiattaforma.statusCode).toBe(200);
  });

  it("B22 — il catalogo non si svuota: i ruoli fuori profilo restano nel catalogo di piattaforma", async () => {
    // La condizione che Enzo ha posto per iscritto, verificata sul dato e non sul discorso.
    const catalogo = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_job_roles WHERE job_role_tenant_id IS NULL`,
    );
    expect(Number(catalogo.rows[0]!.n)).toBeGreaterThanOrEqual(176);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════
  // C1 (S1096) — HEURESYS HA UN PROFILO SUO, E LE SUE PERSONE VEDONO I PROPRI MESTIERI.
  //
  // Prima della migrazione 000400 HEURESYS non aveva nessuna attivazione, quindi il
  // fail-closed di lib/scope/profilo.ts restituiva ZERO ruoli e 404 per identificativo a due
  // persone reali (TEAM_LEADER e USER). La giustificazione scritta nel codice — «HEURESYS usa
  // zero ruoli nelle proprie posizioni» — era falsa: veniva da una query su un tenant_code
  // che non esiste.
  //
  // ⚠ LA PROVA GIRA SUL RESOLVER, non su un login, e la ragione e' dichiarata: andrea e
  // chiara non sono fra le personas dei test, quindi le loro credenziali non sono derivabili
  // con la convenzione della suite. Il resolver e' pero' l'unita' che DECIDE cosa quelle
  // persone vedono: e' li' che la domanda si risolve, ed e' li' che si misura.
  //
  // Sa fallire: se l'attivazione di HEURESYS sparisse, `codiciDelProfilo` tornerebbe vuoto e
  // il primo expect cadrebbe.
  // ══════════════════════════════════════════════════════════════════════════════════════
  it("C1 — il profilo di HEURESYS contiene i mestieri che le sue posizioni usano davvero", async () => {
    const t = await pool.query<{ id: string }>(
      `SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS'`,
    );
    expect(t.rowCount, "il cliente HEURESYS non esiste").toBe(1);
    const tenantId = t.rows[0]!.id;

    // Cio' che le posizioni di HEURESYS usano, ri-derivato dal vivo e mai cablato.
    const usati = await pool.query<{ code: string }>(
      `SELECT DISTINCT jr.job_role_code AS code
         FROM sys.sys_positions p
         JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
        WHERE p.position_tenant_id = $1`,
      [tenantId],
    );
    expect(usati.rowCount, "HEURESYS non usa nessun ruolo: la prova non discrimina")
      .toBeGreaterThan(0);

    const profilo = await codiciDelProfilo(pool, tenantId, "job_roles");
    expect(profilo.length, "il profilo di HEURESYS e' vuoto: le sue persone vedrebbero zero ruoli")
      .toBeGreaterThan(0);

    const mancanti = usati.rows.map((r) => r.code).filter((c) => !profilo.includes(c));
    expect(mancanti, `mestieri usati da HEURESYS e fuori dal suo profilo: ${mancanti.join(", ")}`)
      .toEqual([]);
  });

  it("C1 — una persona di HEURESYS che non amministra la piattaforma riceve il profilo, non il vuoto e non il catalogo", async () => {
    const u = await pool.query<{ id: string; tenant: string }>(
      `SELECT u.user_id AS id, u.user_tenant_id AS tenant
         FROM sys.sys_users u
         JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id AND t.tenant_code = 'HEURESYS'
        WHERE u.user_status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM sys.sys_user_auth_roles ur
              JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
             WHERE ur.user_auth_role_user_id = u.user_id
               AND ur.user_auth_role_revoked_at IS NULL
               AND r.auth_role_code = 'PLATFORM_ADMIN')
        LIMIT 1`,
    );
    expect(u.rowCount, "nessuna persona non-di-piattaforma in HEURESYS").toBe(1);

    const perimetro = await perimetroDiCatalogo(
      pool,
      { userId: u.rows[0]!.id, tenantId: u.rows[0]!.tenant, roles: ["USER"] },
      "job_roles",
    );
    expect(perimetro.tipo, "una persona non-di-piattaforma non deve vedere tutto il catalogo")
      .toBe("profilo");
    if (perimetro.tipo === "profilo") {
      expect(perimetro.codici.length, "il perimetro e' vuoto: e' il difetto che C1 chiude")
        .toBeGreaterThan(0);
      const catalogo = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.sys_job_roles WHERE job_role_tenant_id IS NULL`,
      );
      expect(perimetro.codici.length, "il profilo coincide col catalogo intero: non filtra nulla")
        .toBeLessThan(Number(catalogo.rows[0]!.n));
    }
  });

  it("POST without x-csrf-token header → 403", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-roles",
      headers: {
        cookie: ch(platformS.cookies),
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_NOCSRF`, name: "No Csrf Role" },
    });
    expect(r.statusCode).toBe(403);
  });
});
