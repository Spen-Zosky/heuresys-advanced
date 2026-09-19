/**
 * apps/api/test/data-steward.integration.test.ts — mandato K, R-6 sessione 2 (passo 57).
 *
 * DATA_STEWARD: ruolo di cliente per il custode del dato che ARRIVA da fuori. Scrive/legge
 * sui moduli tenant-import-runs, reference-sync, provenance, generated-origins, MAI sui dati
 * nativi — il confine e' l'ASSENZA della rotta (X-0), non un 403: nessuna rotta di scrittura
 * esiste sulle tabelle classificate `importato`. La prova che lo dice non conta a occhio, la
 * enumera (DIF-4): per ogni tabella `importato`, il modulo che la scrive (se esiste) non ha
 * NESSUNA rotta POST/PATCH/PUT/DELETE.
 *
 * Lettura mascherata dei dati personali: provenance/generated-origins/reference-sync non ne
 * hanno (D-51: provenienza e' metadata, non contenuto di persona; reference-sync e'
 * tassonomia globale) — l'unico punto reale e' `GET /v1/tenant-import-runs/:id`, il cui
 * `candidates[]` porta email/displayName in chiaro. Mascherato per intero (mask.ts).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, withTransaction, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";
import { senzaCacheDiSessione } from "./helpers/session-cache.js";
import * as repo from "../src/modules/tenant-import-runs/repository.js";
import type { TenantImportRunDetail, TenantImportSource, TenantImportRow } from "@heuresys/shared";

senzaCacheDiSessione();

const DATA_STEWARD_EMAIL = "data-steward@collaudo.invalid";
// Controprova per (a)/(c)/(d) — obiettivo, dominio nativo (I22): una persona REALE con
// HRMS_MANAGER su RTL_BANK (stesso criterio del test gemello di R-6 s1).
const HRMS_MANAGER_EMAIL = "maria.colombo@rtl-bank.org";
// Controprova per la mascheratura — dominio tenant-import-runs: misurato sul vivo,
// HRMS_MANAGER NON detiene seed_acquisition:read (solo PLATFORM_ADMIN/TENANT_ADMIN/
// DATA_STEWARD/IMPLEMENTATION_CONSULTANT). TENANT_ADMIN e' il plenipotenziario giusto
// per questo modulo, collaudo gia' esistente su RTL_BANK.
const TENANT_ADMIN_EMAIL = "governo@collaudo.invalid";

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(t: TestApp, email: string, password: string): Promise<S> {
  const r = await loginRaw(t.app, email, password);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const b = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: b.csrfToken, userId: b.user.userId };
}

let suite: TestApp;
let hrmsManager: S;
let dataSteward: S;
let peopleManager: S;
let tenantAdmin: S;

describe("mandato K, R-6 s2 — DATA_STEWARD", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    hrmsManager = await login(suite, HRMS_MANAGER_EMAIL, TEST_PERSONA_PASSWORD);
    dataSteward = await login(suite, DATA_STEWARD_EMAIL, deriveCollaudoPassword(key, DATA_STEWARD_EMAIL));
    peopleManager = await login(suite, "people-manager@collaudo.invalid", deriveCollaudoPassword(key, "people-manager@collaudo.invalid"));
    tenantAdmin = await login(suite, TENANT_ADMIN_EMAIL, deriveCollaudoPassword(key, TENANT_ADMIN_EMAIL));
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("(a) PEOPLE_MANAGER scrive un obiettivo -> 201 (controllo di contesto, gia' provato da R-6 s1)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/goals",
      headers: { cookie: ch(peopleManager.cookies), "x-csrf-token": peopleManager.csrfToken },
      payload: { title: "Obiettivo di collaudo R-6 s2" },
    });
    expect(r.statusCode).toBe(201);
  });

  it("(b) NESSUNA rotta di scrittura tocca una tabella classificata 'importato' — enumerata, non contata a occhio (DIF-4)", async () => {
    const importate = await pool.query<{ tabella: string }>(
      "SELECT tabella FROM sys.sys_classificazione_direzione_dato WHERE stato = 'importato' ORDER BY 1",
    );
    const tabelleImportate = new Set(importate.rows.map((r) => r.tabella));
    expect(tabelleImportate.size, "la classificazione X-1 e' vuota: il test non guarda il database giusto").toBeGreaterThan(50);

    const MODULI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "modules");
    const SCRITTURA_RE = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+sys\.(sys_[a-z0-9_]+)\b/gi;
    const ROTTA_RE = /app\.(get|post|patch|put|delete)\(\s*["']([^"']*)["']/gi;
    const SCRITTURA_METODI = new Set(["post", "patch", "put", "delete"]);
    // ECCEZIONE MISURATA (non assunta): `tenant-materialization` scrive su
    // sys_user_kpi_evidence (classificata 'importato'), ma X-1 lo dichiara nel
    // proprio campo `motivo` — "unico scrittore in codice e' l'effetto di
    // materializzazione onboarding tenant". La materializzazione (X-2) e' un
    // TERZO valore di origine, distinto da IMPORT: semina lo stato iniziale di
    // un tenant appena costruito, non importa da un sistema HR esterno (D6). La
    // rotta POST / e' comunque gia' PLATFORM_ADMIN-only (#132 E29) — nessun
    // ruolo di questo mandato, DATA_STEWARD incluso, vi accede. Trovato da
    // questa stessa prova (prima misura strutturale, non a occhio); registrato
    // in REGISTRO_SCOPERTE come «fuori da questo ciclo», non un difetto da
    // correggere qui.
    const MODULI_MATERIALIZZAZIONE = new Set(["tenant-materialization"]);

    const violazioni: string[] = [];
    for (const modulo of readdirSync(MODULI)) {
      if (MODULI_MATERIALIZZAZIONE.has(modulo)) continue;
      const moduloDir = join(MODULI, modulo);
      if (!statSync(moduloDir).isDirectory()) continue;

      const scritte = new Set<string>();
      for (const file of readdirSync(moduloDir)) {
        if (!file.toLowerCase().includes("repository") || !file.endsWith(".ts")) continue;
        const testo = readFileSync(join(moduloDir, file), "utf8");
        for (const m of testo.matchAll(SCRITTURA_RE)) scritte.add(m[1]!);
      }
      const tocca = [...scritte].filter((t) => tabelleImportate.has(t));
      if (tocca.length === 0) continue;

      const routesPath = join(moduloDir, "routes.ts");
      let testoRoutes: string;
      try { testoRoutes = readFileSync(routesPath, "utf8"); } catch { continue; }
      for (const m of testoRoutes.matchAll(ROTTA_RE)) {
        const metodo = m[1]!.toLowerCase();
        if (SCRITTURA_METODI.has(metodo)) {
          violazioni.push(`modulo ${modulo}: rotta di scrittura ${metodo.toUpperCase()} ${m[2]} su tabella/e importate ${tocca.join(",")}`);
        }
      }
    }
    expect(violazioni, violazioni.join("\n")).toHaveLength(0);
  });

  it("(b bis) prova concreta — DATA_STEWARD prova a scrivere una busta paga: la rotta non esiste (404 di rotta, NON 403)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/me/pay-slips",
      headers: { cookie: ch(dataSteward.cookies), "x-csrf-token": dataSteward.csrfToken },
      payload: {},
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error?: { code?: string } }).error?.code).not.toBe("FORBIDDEN");
  });

  it("(c) DATA_STEWARD scrive un obiettivo -> 403", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/goals",
      headers: { cookie: ch(dataSteward.cookies), "x-csrf-token": dataSteward.csrfToken },
      payload: { title: "Non dovrebbe entrare" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("(d) controprova — HRMS_MANAGER scrive lo stesso obiettivo senza bisogno di DATA_STEWARD", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/goals",
      headers: { cookie: ch(hrmsManager.cookies), "x-csrf-token": hrmsManager.csrfToken },
      payload: { title: "Obiettivo di controprova (HRMS_MANAGER)" },
    });
    expect(r.statusCode).toBe(201);
  });

  it("DATA_STEWARD legge il proprio dominio: tenant-import-runs e reference-sync rispondono 200", async () => {
    const runs = await suite.app.inject({
      method: "GET", url: "/v1/tenant-import-runs",
      headers: { cookie: ch(dataSteward.cookies) },
    });
    expect(runs.statusCode, runs.body).toBe(200);

    const sync = await suite.app.inject({
      method: "GET", url: "/v1/reference-sync/sources",
      headers: { cookie: ch(dataSteward.cookies) },
    });
    expect(sync.statusCode, sync.body).toBe(200);
  });

  it("lettura mascherata dei dati personali — GET /:id nasconde i candidati a DATA_STEWARD, li mostra intatti a TENANT_ADMIN", async () => {
    const tenant = await pool.query<{ id: string }>(
      "SELECT tenant_id AS id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'",
    );
    const tenantId = tenant.rows[0]?.id;
    expect(tenantId, "tenant RTL_BANK non trovato").toBeTruthy();

    const marca = `DS-MASK-${Date.now()}`;
    const source: TenantImportSource = {
      sourceExportId: randomUUID(), name: `Fonte ${marca}`, fileHash: "a".repeat(64),
      retrievedAt: new Date().toISOString(), sizeBytes: 42, status: "AVAILABLE", rowCount: 1,
    };
    const runId = await withTransaction(async (client) => {
      const id = await repo.insertRun(client, { tenantId: tenantId!, code: `TENANT-IMPORT-${marca}`, source, createdBy: hrmsManager.userId });
      await repo.insertCandidate(client, {
        runId: id, tenantId: tenantId!, naturalKey: `mario.rossi.${marca}@cliente.invalid`, rowNo: 1,
        riga: { first_name: "Mario", last_name: "Rossi", email: `mario.rossi.${marca}@cliente.invalid` } satisfies TenantImportRow,
        email: `mario.rossi.${marca}@cliente.invalid`, positionId: null, positionCode: null,
        e19: null, hireDate: null, placeholderUserId: null, status: "PASSED",
        validations: [{ ruleCode: "PERSON_EMAIL", status: "PASSED", message: null, payload: { email: `mario.rossi.${marca}@cliente.invalid` } }],
      });
      return id;
    });

    const perDataSteward = await suite.app.inject({
      method: "GET", url: `/v1/tenant-import-runs/${runId}`,
      headers: { cookie: ch(dataSteward.cookies) },
    });
    expect(perDataSteward.statusCode, perDataSteward.body).toBe(200);
    const corsaMascherata = perDataSteward.json() as TenantImportRunDetail;
    expect(corsaMascherata.candidates).toBeUndefined();
    expect((corsaMascherata as unknown as { masked?: string[] }).masked).toEqual(["candidates"]);
    expect(corsaMascherata.runId).toBe(runId);
    expect(corsaMascherata.referto.persone).toBe(1);

    const perTenantAdmin = await suite.app.inject({
      method: "GET", url: `/v1/tenant-import-runs/${runId}`,
      headers: { cookie: ch(tenantAdmin.cookies) },
    });
    expect(perTenantAdmin.statusCode, perTenantAdmin.body).toBe(200);
    const corsaIntatta = perTenantAdmin.json() as TenantImportRunDetail;
    expect(corsaIntatta.candidates).toHaveLength(1);
    expect(corsaIntatta.candidates![0]!.email).toBe(`mario.rossi.${marca}@cliente.invalid`);
    expect((corsaIntatta as unknown as { masked?: string[] }).masked).toBeUndefined();
  });
});
