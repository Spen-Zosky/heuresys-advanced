/**
 * apps/api/test/tenant-process-step-apqc.integration.test.ts — il tipo di corrispondenza di
 * un'attività con la voce APQC da cui viene (ADR-0061 D7, passo 4; migrazione 000509).
 *
 * Prova, su persone vere di RTL, con un processo e due attività creati dal file:
 *  · la scheda del processo porta il codice APQC dei metadati e nessun tipo («da dichiarare»);
 *  · il mandato HR dichiara il tipo con il criterio; la scheda lo rilegge come decisione della persona;
 *  · un'attività senza voce APQC risponde 400; un tipo fuori elenco 400;
 *  · senza `bpm_process:update` 403 FORBIDDEN; un PROCESS_OWNER che non presidia 403 PERMISSION_DENIED;
 *  · un'attività di un altro processo risponde 404; senza CSRF 403.
 * Le scritture si annullano a fine file (isolamento transazionale).
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
function putApqc(app: TestApp, s: Session, id: string, stepId: string, payload: unknown, csrf = true) {
  return app.app.inject({
    method: "PUT",
    url: `/v1/tenant-processes/${id}/attivita/${stepId}/apqc`,
    headers: { cookie: ch(s.cookies), ...(csrf ? { "x-csrf-token": s.csrfToken } : {}) },
    payload: payload as Record<string, unknown>,
  });
}
function scheda(app: TestApp, s: Session, id: string) {
  return app.app.inject({ method: "GET", url: `/v1/processes/${id}/scheda`, headers: { cookie: ch(s.cookies) } });
}

let suite: TestApp;
let hrms: Session;
let plain: Session;
let owner: Session;
let processId = "";
let stepApqc = "";
let stepSenza = "";

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
     VALUES ($1, $2, 'Processo di prova delle corrispondenze (ADR-0061 D7)', $3, 'NATIVO')
     RETURNING tenant_process_id AS id`,
    [a.tenant_id, `D7-PROVA-${Date.now()}`, a.position_id]);
  processId = ins.rows[0]!.id;
  const st = await pool.query<{ id: string; code: string }>(
    `INSERT INTO sys.sys_tenant_process_steps
       (tenant_process_step_tenant_id, tenant_process_step_process_id, tenant_process_step_code, tenant_process_step_name,
        tenant_process_step_ordinal, tenant_process_step_metadata, origine_dato)
     VALUES ($1, $2, 'A1', 'Attività di prova con la voce APQC', 1, '{"apqc":"10002"}'::jsonb, 'NATIVO'),
            ($1, $2, 'A2', 'Attività di prova senza voce APQC', 2, '{}'::jsonb, 'NATIVO')
     RETURNING tenant_process_step_id AS id, tenant_process_step_code AS code`,
    [a.tenant_id, processId]);
  stepApqc = st.rows.find((x) => x.code === "A1")!.id;
  stepSenza = st.rows.find((x) => x.code === "A2")!.id;

  plain = await login(suite, TOMMASO);          // USER, senza bpm_process:update
  await grant(ANTONIO, "HRMS_MANAGER");
  await grant(TOMMASO, "PROCESS_OWNER");
  hrms = await login(suite, ANTONIO);
  owner = await login(suite, TOMMASO);          // ora porta PROCESS_OWNER
});

afterAll(async () => {
  await suite.app.close();
});

interface Att { activityId: string; apqcCode: string | null; apqcMatch: { kind: string; criterion: string; source: string; status: string } | null }

describe("ADR-0061 D7 — la corrispondenza delle attività con APQC", () => {
  it("la scheda porta il codice dei metadati e nessun tipo dichiarato", async () => {
    const r = await scheda(suite, hrms, processId);
    expect(r.statusCode).toBe(200);
    const att = (r.json() as { activities: Att[] }).activities;
    const a = att.find((x) => x.activityId === stepApqc)!;
    expect(a.apqcCode).toBe("10002");
    expect(a.apqcMatch).toBeNull();
    expect(att.find((x) => x.activityId === stepSenza)!.apqcCode).toBeNull();
  });

  it("il mandato HR dichiara il tipo con il criterio e la scheda lo rilegge", async () => {
    const r = await putApqc(suite, hrms, processId, stepApqc, { kind: "PIU_RISTRETTO", criterion: "Copre solo la parte bancaria della voce" });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { apqcCode: string }).apqcCode).toBe("10002");
    const att = ((await scheda(suite, hrms, processId)).json() as { activities: Att[] }).activities;
    const m = att.find((x) => x.activityId === stepApqc)!.apqcMatch!;
    expect(m).toEqual({ kind: "PIU_RISTRETTO", criterion: "Copre solo la parte bancaria della voce", source: "PERSONA", status: "APPROVATA" });
  });

  it("un'attività senza voce APQC o un tipo fuori elenco rispondono 400", async () => {
    expect((await putApqc(suite, hrms, processId, stepSenza, { kind: "ESATTO", criterion: "x" })).statusCode).toBe(400);
    expect((await putApqc(suite, hrms, processId, stepApqc, { kind: "SIMILE", criterion: "x" })).statusCode).toBe(400);
  });

  it("senza bpm_process:update 403 FORBIDDEN; il responsabile che non presidia 403 PERMISSION_DENIED", async () => {
    const r1 = await putApqc(suite, plain, processId, stepApqc, { kind: "ESATTO", criterion: "x" });
    expect(r1.statusCode).toBe(403);
    expect(codeOf(r1)).toBe("FORBIDDEN");
    const r2 = await putApqc(suite, owner, processId, stepApqc, { kind: "ESATTO", criterion: "x" });
    expect(r2.statusCode).toBe(403);
    expect(codeOf(r2)).toBe("PERMISSION_DENIED");
  });

  it("un'attività che non è del processo risponde 404; senza CSRF 403", async () => {
    expect((await putApqc(suite, hrms, processId, GHOST, { kind: "ESATTO", criterion: "x" })).statusCode).toBe(404);
    expect((await putApqc(suite, hrms, processId, stepApqc, { kind: "ESATTO", criterion: "x" }, false)).statusCode).toBe(403);
  });
});
