/**
 * apps/api/test/tenant-processes.integration.test.ts — il responsabile di un processo del tenant.
 *
 * ADR-0060 (le applet dell'assistente), voce P3 del piano: la rotta che il caso guida «processi senza
 * un responsabile in carica» chiedeva e che l'API non aveva. Prova, su persone vere di RTL:
 *  · il mandato HR (HRMS_MANAGER concesso per il file ad antonio.parisi, come in
 *    hrms-plenipotentiary) cambia il responsabile e riceve il valore di prima; rimandarlo annulla;
 *  · senza `bpm_process:update` la rotta risponde 403 FORBIDDEN;
 *  · un PROCESS_OWNER che non presidia il processo riceve 403 PERMISSION_DENIED;
 *  · un processo inesistente risponde 404; una posizione inesistente 400; senza CSRF 403.
 * Le scritture si annullano a fine file (isolamento transazionale, `.claude/rules/tests.md`).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";

// Il file muta i ruoli degli attori prima del login: le sessioni non si prendono dalla cache.
senzaCacheDiSessione();

const GHOST = "00000000-0000-4000-8000-0000000000fe";
const ANTONIO = "antonio.parisi@rtl-bank.org";
const TOMMASO = "tommaso.fiore@rtl-bank.org";

interface Session { cookies: Map<string, string>; csrfToken: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
const codeOf = (r: { json: () => unknown }) => (r.json() as { error?: { code?: string } }).error?.code;

async function login(app: TestApp, email: string): Promise<Session> {
  const r = await loginRaw(app.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
function patchOwner(app: TestApp, s: Session, id: string, ownerPositionId: string | null, csrf = true) {
  return app.app.inject({
    method: "PATCH",
    url: `/v1/tenant-processes/${id}/owner`,
    headers: { cookie: ch(s.cookies), ...(csrf ? { "x-csrf-token": s.csrfToken } : {}) },
    payload: { ownerPositionId },
  });
}

let suite: TestApp;
let hrms: Session;
let plain: Session;
let owner: Session;
let processId = "";
let previousOwner: string | null = null;
let otherPosition = "";

async function grant(email: string, role: string): Promise<void> {
  await pool.query(
    `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
     SELECT u.user_id, r.auth_role_id, u.user_tenant_id
       FROM sys.sys_users u, sys.sys_auth_roles r
      WHERE u.user_email = $1 AND r.auth_role_code = $2
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles x
                         WHERE x.user_auth_role_user_id = u.user_id AND x.user_auth_role_role_id = r.auth_role_id)`,
    [email, role]);
}

beforeAll(async () => {
  suite = await buildTestApp();

  // Il file crea il proprio processo, attivo, nel tenant di RTL: la copia della CI non porta i
  // processi del riempimento fuori catena (db/scripts/attivita/), e una prova che dipende da
  // righe che forse ci sono non prova niente. Due posizioni attive dello stesso tenant: la prima
  // è il responsabile di partenza, la seconda quella a cui si passa; nessuna delle due è retta dal
  // PROCESS_OWNER di prova, così il suo diniego viene dal perimetro. L'isolamento transazionale
  // annulla tutto a fine file.
  const pos = await pool.query<{ position_id: string; tenant_id: string }>(
    `SELECT p.position_id, p.position_tenant_id AS tenant_id
       FROM sys.sys_positions p
       JOIN sys.sys_users u ON u.user_email = $1 AND u.user_tenant_id = p.position_tenant_id
      WHERE p.position_is_active
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_user_position_assignments a
            JOIN sys.sys_users t ON t.user_id = a.user_position_assignment_user_id AND t.user_email = $2
           WHERE a.user_position_assignment_position_id = p.position_id
             AND a.user_position_assignment_status = 'ACTIVE')
      ORDER BY p.position_id LIMIT 2`,
    [ANTONIO, TOMMASO]);
  const [a, b] = pos.rows;
  if (!a || !b) throw new Error("servono due posizioni attive nel tenant di RTL");
  const ins = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_tenant_processes
       (tenant_process_tenant_id, tenant_process_code, tenant_process_name, tenant_process_owner_position_id, origine_dato)
     VALUES ($1, $2, 'Processo di prova del responsabile (ADR-0060 P3)', $3, 'NATIVO')
     RETURNING tenant_process_id AS id`,
    [a.tenant_id, `P3-PROVA-${Date.now()}`, a.position_id]);
  processId = ins.rows[0]!.id;
  previousOwner = a.position_id;
  otherPosition = b.position_id;

  plain = await login(suite, TOMMASO);          // USER, senza bpm_process:update
  await grant(ANTONIO, "HRMS_MANAGER");
  await grant(TOMMASO, "PROCESS_OWNER");
  hrms = await login(suite, ANTONIO);
  owner = await login(suite, TOMMASO);          // ora porta PROCESS_OWNER
});

afterAll(async () => {
  await suite.app.close();
});

describe("ADR-0060 P3 — il responsabile di un processo del tenant", () => {
  it("il mandato HR cambia il responsabile e riceve il valore di prima", async () => {
    const r = await patchOwner(suite, hrms, processId, otherPosition);
    expect(r.statusCode).toBe(200);
    const body = r.json() as { process: { id: string; ownerPositionId: string | null }; previousOwnerPositionId: string | null };
    expect(body.process.id).toBe(processId);
    expect(body.process.ownerPositionId).toBe(otherPosition);
    expect(body.previousOwnerPositionId).toBe(previousOwner);

    const g = await suite.app.inject({ method: "GET", url: `/v1/tenant-processes/${processId}`, headers: { cookie: ch(hrms.cookies) } });
    expect(g.statusCode).toBe(200);
    expect((g.json() as { ownerPositionId: string | null }).ownerPositionId).toBe(otherPosition);
  });

  it("rimandare il valore di prima annulla la modifica", async () => {
    const r = await patchOwner(suite, hrms, processId, previousOwner);
    expect(r.statusCode).toBe(200);
    const body = r.json() as { process: { ownerPositionId: string | null }; previousOwnerPositionId: string | null };
    expect(body.process.ownerPositionId).toBe(previousOwner);
    expect(body.previousOwnerPositionId).toBe(otherPosition);
  });

  it("senza bpm_process:update la rotta è negata (403 FORBIDDEN)", async () => {
    const r = await patchOwner(suite, plain, processId, otherPosition);
    expect(r.statusCode).toBe(403);
    expect(codeOf(r)).toBe("FORBIDDEN");
  });

  it("un PROCESS_OWNER che non presidia il processo è negato dal perimetro (403 PERMISSION_DENIED)", async () => {
    const r = await patchOwner(suite, owner, processId, otherPosition);
    expect(r.statusCode).toBe(403);
    expect(codeOf(r)).toBe("PERMISSION_DENIED");
  });

  it("un processo inesistente risponde 404", async () => {
    const r = await patchOwner(suite, hrms, GHOST, otherPosition);
    expect(r.statusCode).toBe(404);
  });

  it("una posizione inesistente risponde 400", async () => {
    const r = await patchOwner(suite, hrms, processId, GHOST);
    expect(r.statusCode).toBe(400);
  });

  it("senza CSRF la scrittura è rifiutata", async () => {
    const r = await patchOwner(suite, hrms, processId, otherPosition, false);
    expect(r.statusCode).toBe(403);
  });
});
