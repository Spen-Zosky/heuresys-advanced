/**
 * apps/api/test/tenant-process-facets.integration.test.ts — le faccette di un processo del tenant.
 *
 * ADR-0061 D4, passo 2 del piano di attuazione (000507). Prova, su persone vere di RTL:
 *  · il vocabolario ha le sette faccette e 26 valori, con i nomi in italiano;
 *  · il mandato HR assegna più valori a una faccetta con il criterio, li rilegge come decisione
 *    della persona (fonte PERSONA, stato APPROVATA), li sostituisce e li toglie con la lista vuota;
 *  · un valore fuori vocabolario risponde 400; senza criterio 400;
 *  · senza `bpm_process:update` la rotta è negata (403 FORBIDDEN); un PROCESS_OWNER che non presidia
 *    il processo riceve 403 PERMISSION_DENIED e vede `canEdit` falso;
 *  · un processo inesistente risponde 404; senza CSRF 403;
 *  · chi regge la posizione responsabile del processo lo classifica anche senza PROCESS_OWNER
 *    (decisione di Enzo del 2026-11-22): il potere viene dal dato, non dal ruolo.
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
function putFacet(app: TestApp, s: Session, id: string, facet: string, payload: unknown, csrf = true) {
  return app.app.inject({
    method: "PUT",
    url: `/v1/tenant-processes/${id}/faccette/${facet}`,
    headers: { cookie: ch(s.cookies), ...(csrf ? { "x-csrf-token": s.csrfToken } : {}) },
    payload: payload as Record<string, unknown>,
  });
}
function getFacets(app: TestApp, s: Session, id: string) {
  return app.app.inject({ method: "GET", url: `/v1/tenant-processes/${id}/faccette`, headers: { cookie: ch(s.cookies) } });
}

let suite: TestApp;
let hrms: Session;
let plain: Session;
let owner: Session;
let processId = "";
let processoDiTommaso = "";

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
     VALUES ($1, $2, 'Processo di prova delle faccette (ADR-0061 D4)', $3, 'NATIVO')
     RETURNING tenant_process_id AS id`,
    [a.tenant_id, `D4-PROVA-${Date.now()}`, a.position_id]);
  processId = ins.rows[0]!.id;

  // Un secondo processo, il cui responsabile è una posizione che Tommaso regge oggi: lui, con il
  // solo ruolo USER, ne è il responsabile in carica.
  const sua = await pool.query<{ position_id: string }>(
    `SELECT a.user_position_assignment_position_id AS position_id
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id AND u.user_email = $1
      WHERE a.user_position_assignment_status = 'ACTIVE' LIMIT 1`,
    [TOMMASO]);
  if (!sua.rows[0]) throw new Error("Tommaso Fiore non regge nessuna posizione attiva");
  const ins2 = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_tenant_processes
       (tenant_process_tenant_id, tenant_process_code, tenant_process_name, tenant_process_owner_position_id, origine_dato)
     VALUES ($1, $2, 'Processo di prova del responsabile in carica (ADR-0061)', $3, 'NATIVO')
     RETURNING tenant_process_id AS id`,
    [a.tenant_id, `D4-RESP-${Date.now()}`, sua.rows[0].position_id]);
  processoDiTommaso = ins2.rows[0]!.id;

  plain = await login(suite, TOMMASO);          // USER, senza bpm_process:update
  await grant(ANTONIO, "HRMS_MANAGER");
  await grant(TOMMASO, "PROCESS_OWNER");
  hrms = await login(suite, ANTONIO);
  owner = await login(suite, TOMMASO);          // ora porta PROCESS_OWNER
});

afterAll(async () => {
  await suite.app.close();
});

describe("ADR-0061 D4 — le faccette di un processo del tenant", () => {
  it("il vocabolario ha sette faccette e 26 valori, in italiano e in inglese", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/tenant-processes/faccette/vocabolario", headers: { cookie: ch(hrms.cookies) } });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: Array<{ facet: string; code: string; label: string; labelEn: string; description: string; descriptionEn: string }> }).items;
    expect(items).toHaveLength(26);
    expect(new Set(items.map((x) => x.facet)).size).toBe(7);
    const cliente = items.find((x) => x.facet === "BENEFICIARIO" && x.code === "CLIENTE_ESTERNO");
    expect(cliente?.label).toBe("Cliente esterno");
    // N2 del giro di verifica del 25/11/2026: anche l'inglese, che la pagina inglese mostra.
    expect(cliente?.labelEn).toBe("External customer");
    expect(items.every((x) => x.labelEn.length > 0 && x.descriptionEn.length > 0)).toBe(true);
  });

  it("il mandato HR assegna più valori con il criterio e li rilegge come decisione", async () => {
    const r = await putFacet(suite, hrms, processId, "BENEFICIARIO", { codes: ["CLIENTE_ESTERNO", "AUTORITA"], criterion: "Il risultato va al cliente e alla vigilanza" });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { canEdit: boolean; items: Array<{ facet: string; code: string; labelEn: string; source: string; status: string; criterion: string }> };
    expect(body.canEdit).toBe(true);
    const ben = body.items.filter((x) => x.facet === "BENEFICIARIO");
    expect(ben.map((x) => x.code)).toEqual(["CLIENTE_ESTERNO", "AUTORITA"]);
    expect(ben[0]?.labelEn).toBe("External customer");
    expect(ben.every((x) => x.source === "PERSONA" && x.status === "APPROVATA")).toBe(true);
    expect(ben[0]!.criterion).toBe("Il risultato va al cliente e alla vigilanza");
  });

  it("sostituire tiene solo i nuovi valori; la lista vuota toglie la faccetta", async () => {
    const r1 = await putFacet(suite, hrms, processId, "BENEFICIARIO", { codes: ["AUTORITA"], criterion: "Solo la vigilanza" });
    expect(r1.statusCode).toBe(200);
    expect((r1.json() as { items: Array<{ code: string }> }).items.map((x) => x.code)).toEqual(["AUTORITA"]);
    const r2 = await putFacet(suite, hrms, processId, "BENEFICIARIO", { codes: [] });
    expect(r2.statusCode).toBe(200);
    const g = await getFacets(suite, hrms, processId);
    expect((g.json() as { items: unknown[] }).items).toHaveLength(0);
  });

  it("un valore fuori vocabolario o senza criterio risponde 400", async () => {
    expect((await putFacet(suite, hrms, processId, "PERIMETRO", { codes: ["CLIENTE_ESTERNO"], criterion: "x" })).statusCode).toBe(400);
    expect((await putFacet(suite, hrms, processId, "PERIMETRO", { codes: ["INTERFUNZIONALE"] })).statusCode).toBe(400);
  });

  it("senza bpm_process:update la scrittura è negata (403 FORBIDDEN)", async () => {
    const r = await putFacet(suite, plain, processId, "PERIMETRO", { codes: ["INTERFUNZIONALE"], criterion: "x" });
    expect(r.statusCode).toBe(403);
    expect(codeOf(r)).toBe("FORBIDDEN");
  });

  it("un PROCESS_OWNER che non presidia il processo è negato dal perimetro e non può modificare", async () => {
    const r = await putFacet(suite, owner, processId, "PERIMETRO", { codes: ["INTERFUNZIONALE"], criterion: "x" });
    expect(r.statusCode).toBe(403);
    expect(codeOf(r)).toBe("PERMISSION_DENIED");
    const g = await getFacets(suite, owner, processId);
    expect(g.statusCode).toBe(200);
    expect((g.json() as { canEdit: boolean }).canEdit).toBe(false);
  });

  it("il responsabile in carica classifica il proprio processo anche senza PROCESS_OWNER (Enzo, 2026-11-22)", async () => {
    const g = await getFacets(suite, plain, processoDiTommaso);
    expect(g.statusCode).toBe(200);
    expect((g.json() as { canEdit: boolean }).canEdit).toBe(true);
    const r = await putFacet(suite, plain, processoDiTommaso, "PERIMETRO", { codes: ["INTERFUNZIONALE"], criterion: "Attraversa più direzioni" });
    expect(r.statusCode).toBe(200);
    const items = (r.json() as { items: Array<{ facet: string; code: string; source: string; status: string }> }).items;
    expect(items.find((x) => x.facet === "PERIMETRO")).toMatchObject({ code: "INTERFUNZIONALE", source: "PERSONA", status: "APPROVATA" });
    // CONTROPROVA: sullo stesso profilo, un processo che non presidia resta negato e non modificabile.
    expect(codeOf(await putFacet(suite, plain, processId, "PERIMETRO", { codes: ["INTERFUNZIONALE"], criterion: "x" }))).toBe("FORBIDDEN");
    expect(((await getFacets(suite, plain, processId)).json() as { canEdit: boolean }).canEdit).toBe(false);
  });

  it("un processo inesistente risponde 404; senza CSRF la scrittura è rifiutata", async () => {
    expect((await getFacets(suite, hrms, GHOST)).statusCode).toBe(404);
    expect((await putFacet(suite, hrms, processId, "PERIMETRO", { codes: ["INTERFUNZIONALE"], criterion: "x" }, false)).statusCode).toBe(403);
  });
});
