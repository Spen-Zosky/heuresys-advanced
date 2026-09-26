/**
 * #206 T2/T3/T4/T8 — la superficie `/v1/tenant-import-runs`, e le prove che devono poter fallire:
 *
 *   T2 · una riga con `hire_date = '31/02/2024'` e `is_active = 'S'` DEVE entrare nell'atterraggio.
 *        Se la registrazione la rifiuta, la tabella e' tipizzata e il task e' sbagliato.
 *   T3 · lo stesso contenuto registrato due volte CON NOME DIVERSO e' riconosciuto per IMPRONTA:
 *        stessa fonte, nessuna riga atterrata di nuovo.
 *   T4 · tre esiti, e il terzo e' quello che di solito manca: chi copre tutti i CRITICAL e'
 *        AMMESSA; chi ne manca uno e' AMMESSA_CON_SCOSTAMENTO con l'elenco; una posizione con
 *        ZERO requisiti critici e' CIECA — se uscisse AMMESSA, la validazione confonderebbe
 *        «nessun problema» con «nessuna domanda». La data inesistente esce NOMINATA.
 *   T8 · nessun permesso nuovo: un attore senza `seed_acquisition:trigger` riceve FORBIDDEN
 *        (non PERMISSION_DENIED, che e' il codice dello scope negato dal service). La firma
 *        (E26) e' UNA richiesta di approvazione per corsa, con le eccezioni nominate nel corpo.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { costruisciAziendaP4, righeDelCliente, type AziendaDiProvaP4 } from "./helpers/azienda-di-prova-p4.js";
import type { RegisterTenantImportSourceResponse, TenantImportRunDetail, SubmitTenantImportRunResponse } from "@heuresys/shared";

const MARCA = `P4A-${Date.now()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
function post(t: TestApp, s: S, url: string, payload: Record<string, unknown>) {
  return t.app.inject({ method: "POST", url, payload, headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken, "content-type": "application/json" } });
}

let suite: TestApp;
let platform: S;
let utente: S;
let az: AziendaDiProvaP4;
let sourceExportId = "";
let runId = "";

beforeAll(async () => {
  suite = await buildTestApp();
  platform = await login(suite, "platform-test-admin@collaudo.invalid");
  utente = await login(suite, "tommaso.fiore@rtl-bank.org"); // USER: non detiene seed_acquisition:*
  az = await costruisciAziendaP4(pool, MARCA);
}, 120_000);

afterAll(async () => {
  await suite.app.close();
});

describe("/v1/tenant-import-runs — #206", () => {
  it("T8 · senza seed_acquisition:trigger la registrazione e' FORBIDDEN", async () => {
    const r = await post(suite, utente, "/v1/tenant-import-runs/sources", { name: `x ${MARCA}`, rows: righeDelCliente(az, MARCA) });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("T2 · la fonte si registra e '31/02/2024' ENTRA nell'atterraggio, come testo", async () => {
    const r = await post(suite, platform, "/v1/tenant-import-runs/sources", { name: `Estrazione HR ${MARCA}`, rows: righeDelCliente(az, MARCA) });
    expect(r.statusCode, r.body).toBe(201);
    const body = r.json() as RegisterTenantImportSourceResponse;
    expect(body.alreadyRegistered).toBe(false);
    expect(body.source.rowCount).toBe(5);
    expect(body.source.fileHash).toMatch(/^[0-9a-f]{64}$/);
    sourceExportId = body.source.sourceExportId;

    const atterrata = await pool.query<{ hire_date: string; is_active: string; email: string }>(
      `SELECT hire_date, is_active, email FROM staging.tenant_import_people
        WHERE tenant_import_person_export_id = $1 AND tenant_import_person_row_no = 2`,
      [sourceExportId],
    );
    expect(atterrata.rows[0]).toEqual({ hire_date: "31/02/2024", is_active: "S", email: `bruno.neri@${MARCA.toLowerCase()}.cliente.invalid` });
  });

  it("T3 · lo stesso contenuto con un NOME DIVERSO e' la stessa fonte, per impronta", async () => {
    const r = await post(suite, platform, "/v1/tenant-import-runs/sources", { name: `Copia rinominata ${MARCA}`, rows: righeDelCliente(az, MARCA) });
    expect(r.statusCode, r.body).toBe(201);
    const body = r.json() as RegisterTenantImportSourceResponse;
    expect(body.alreadyRegistered).toBe(true);
    expect(body.source.sourceExportId).toBe(sourceExportId);
    const n = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM staging.tenant_import_people WHERE tenant_import_person_export_id = $1`, [sourceExportId]);
    expect(n.rows[0]!.n, "le righe sono atterrate una seconda volta").toBe("5");
  });

  it("T3 · un contenuto NUOVO con un nome gia' usato e' un conflitto, non una sovrascrittura", async () => {
    const righe = righeDelCliente(az, MARCA);
    righe[0]!.first_name = "Annamaria";
    const r = await post(suite, platform, "/v1/tenant-import-runs/sources", { name: `Estrazione HR ${MARCA}`, rows: righe });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SOURCE_NAME_TAKEN");
  });

  it("T4 · la corsa valida ogni persona: AMMESSA, CON SCOSTAMENTO (con l'elenco), CIECA, e le escluse nominate", async () => {
    const r = await post(suite, platform, "/v1/tenant-import-runs", { sourceExportId, tenantId: az.tenantId });
    expect(r.statusCode, r.body).toBe(201);
    const corsa = r.json() as TenantImportRunDetail;
    runId = corsa.runId;
    expect(corsa.status).toBe("RUNNING");
    expect(corsa.tenantId).toBe(az.tenantId);
    expect(corsa.referto).toEqual({ persone: 5, ammesse: 1, conScostamento: 1, cieche: 1, escluse: 2 });
    expect(corsa.candidates).toHaveLength(5);

    const perRiga = new Map(corsa.candidates!.map((c) => [c.rowNo, c]));
    const regola = (rowNo: number, code: string) => perRiga.get(rowNo)!.validations.find((v) => v.ruleCode === code)!;

    // 1 — copre tutti i CRITICAL
    expect(perRiga.get(1)!.e19).toBe("AMMESSA");
    expect(regola(1, "E19_CRITICAL_SKILL_COVERAGE").status).toBe("PASSED");
    expect(perRiga.get(1)!.status).toBe("PASSED");

    // 2 — zero requisiti critici → CIECA (mai PASSED); occupata dal segnaposto; data inesistente NOMINATA
    expect(perRiga.get(2)!.e19).toBe("CIECA");
    expect(regola(2, "E19_CRITICAL_SKILL_COVERAGE").status).toBe("SKIPPED");
    expect(regola(2, "POSITION_VACANT").status).toBe("WARNING");
    expect(regola(2, "POSITION_VACANT").payload).toMatchObject({ placeholderUserId: az.segnaposto.userId });
    expect(regola(2, "HIRE_DATE_PARSEABLE").status).toBe("WARNING");
    expect(regola(2, "HIRE_DATE_PARSEABLE").message).toContain("31/02/2024");
    expect(perRiga.get(2)!.status).toBe("WARNING");

    // 3 — ne manca uno → CON SCOSTAMENTO, con l'elenco di cio' che manca
    expect(perRiga.get(3)!.e19).toBe("AMMESSA_CON_SCOSTAMENTO");
    const e19 = regola(3, "E19_CRITICAL_SKILL_COVERAGE");
    expect(e19.status).toBe("WARNING");
    expect(e19.payload).toMatchObject({ attesi: 1, mancanti: [{ skillCode: az.competenze.lean.toUpperCase(), skillName: "Lean manufacturing" }] });

    // 4 — senza email → esclusa
    expect(perRiga.get(4)!.status).toBe("FAILED");
    expect(regola(4, "PERSON_EMAIL").status).toBe("FAILED");

    // 5 — seconda persona sulla stessa posizione → esclusa
    expect(perRiga.get(5)!.status).toBe("FAILED");
    expect(regola(5, "POSITION_VACANT").status).toBe("FAILED");
  });

  it("una seconda corsa sulla stessa fonte, mentre la prima e' in volo, e' un conflitto", async () => {
    const r = await post(suite, platform, "/v1/tenant-import-runs", { sourceExportId, tenantId: az.tenantId });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SOURCE_RUN_IN_FLIGHT");
  });

  it("GET /:id e GET / rileggono la corsa col referto ri-derivato", async () => {
    const uno = await suite.app.inject({ method: "GET", url: `/v1/tenant-import-runs/${runId}`, headers: { cookie: ch(platform.cookies) } });
    expect(uno.statusCode).toBe(200);
    expect((uno.json() as TenantImportRunDetail).referto.escluse).toBe(2);
    const lista = await suite.app.inject({ method: "GET", url: `/v1/tenant-import-runs?status=RUNNING`, headers: { cookie: ch(platform.cookies) } });
    expect(lista.statusCode).toBe(200);
    expect((lista.json() as { items: Array<{ runId: string }> }).items.some((x) => x.runId === runId)).toBe(true);
    // un USER non vede nulla di tutto questo
    const negato = await suite.app.inject({ method: "GET", url: `/v1/tenant-import-runs/${runId}`, headers: { cookie: ch(utente.cookies) } });
    expect(negato.statusCode).toBe(403);
  });

  it("E26 · la sottomissione apre UNA richiesta di approvazione per corsa, con le eccezioni nominate", async () => {
    const r = await post(suite, platform, `/v1/tenant-import-runs/${runId}/submit`, {});
    expect(r.statusCode, r.body).toBe(201);
    const body = r.json() as SubmitTenantImportRunResponse;
    expect(body.runId).toBe(runId);
    const req = await pool.query<{ tipo: string; risorsa: string; corpo: string; stato: string; passi: string }>(
      `SELECT approval_request_resource_type AS tipo, approval_request_resource_id AS risorsa,
              approval_request_body AS corpo, approval_request_status AS stato,
              (SELECT count(*)::text FROM sys.sys_approval_steps s WHERE s.approval_step_request_id = a.approval_request_id) AS passi
         FROM sys.sys_approval_requests a WHERE a.approval_request_id = $1`,
      [body.approvalRequestId],
    );
    expect(req.rows[0]).toMatchObject({ tipo: "TENANT_IMPORT_RUN", risorsa: runId, stato: "PENDING" });
    expect(Number(req.rows[0]!.passi)).toBeGreaterThan(0);
    expect(req.rows[0]!.corpo).toContain("Carla Bianchi");       // con scostamento, nominata
    expect(req.rows[0]!.corpo).toContain("CIECA");               // la verifica cieca dichiarata tale
    expect(req.rows[0]!.corpo).toContain("ESCLUSE");             // chi non entra, nominato
    expect(req.rows[0]!.corpo).toContain("PERSON_EMAIL");

    // la seconda sottomissione e' un conflitto: UNA firma per corsa
    const bis = await post(suite, platform, `/v1/tenant-import-runs/${runId}/submit`, {});
    expect(bis.statusCode).toBe(409);
    expect((bis.json() as { error: { code: string } }).error.code).toBe("RUN_ALREADY_SUBMITTED");
  });
});
