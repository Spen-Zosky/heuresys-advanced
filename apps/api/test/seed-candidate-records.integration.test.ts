/**
 * apps/api/test/seed-candidate-records.integration.test.ts
 *
 * Integration coverage for the read-only seed-candidate-records viewer module.
 * Routes (apps/api/src/modules/seed-candidate-records/routes.ts):
 *   GET /v1/seed-candidate-records      requirePermission('seed_acquisition:read')
 *   GET /v1/seed-candidate-records/:id  requirePermission('seed_acquisition:read')
 *
 * The module is READ-ONLY (no POST/PATCH/DELETE, no CSRF, no mutations).
 * `seed_acquisition:read` is granted to PLATFORM_ADMIN + TENANT_ADMIN only
 * (see db/migrations/000005_auth_foundation.sql) — USER role personas are denied.
 * requirePermission throws ForbiddenError WITHOUT an explicit code on a missing
 * permission → the response envelope code is the ForbiddenError default "FORBIDDEN".
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface SeedCandidateRecord {
  seedCandidateRecordId: string;
  runId: string;
  tenantId: string;
  domain: string;
  naturalKey: string;
  payload: Record<string, unknown>;
  validationStatus: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
interface ListResponse { items: SeedCandidateRecord[]; total: number }
interface ErrorBody { error: { code: string; message: string; requestId?: string } }

let suite: TestApp;
let platformS: S;     // enzo.spenuso@heuresys.com — PLATFORM_ADMIN (has seed_acquisition:read)
let deniedS: S;       // tommaso.fiore@rtl-bank.org — USER (lacks seed_acquisition:read)

describe("/v1/seed-candidate-records/* integration (read-only)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "enzo.spenuso@heuresys.com");
    deniedS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    // Read-only module: no rows created by this suite → nothing to clean up.
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated LIST request → 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/seed-candidate-records" });
    expect(r.statusCode).toBe(401);
    expect((r.json() as ErrorBody).error.code).toBe("UNAUTHORIZED");
  });

  it("USER persona lacking seed_acquisition:read → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/seed-candidate-records",
      headers: { cookie: ch(deniedS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    // requirePermission throws ForbiddenError with no explicit code → default "FORBIDDEN".
    expect((r.json() as ErrorBody).error.code).toBe("FORBIDDEN");
  });

  it("PLATFORM_ADMIN LIST → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/seed-candidate-records?limit=5",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(0);
    // Shape check on any returned row — no hard-coded counts/ids/names.
    if (body.items.length > 0) {
      const first = body.items[0]!;
      expect(typeof first.seedCandidateRecordId).toBe("string");
      expect(typeof first.runId).toBe("string");
      expect(typeof first.tenantId).toBe("string");
      expect(typeof first.domain).toBe("string");
      expect(typeof first.naturalKey).toBe("string");
      expect(typeof first.validationStatus).toBe("string");
    }
  });

  it("PLATFORM_ADMIN LIST respects validationStatus filter (enum-valid) → 200", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/seed-candidate-records?validationStatus=PENDING&limit=3",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    // Every returned row (if any) must carry the filtered status.
    for (const item of body.items) {
      expect(item.validationStatus).toBe("PENDING");
    }
  });

  it("GET /:id with a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/seed-candidate-records/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrorBody).error.code).toBe("NOT_FOUND");
  });

  it("GET /:id returns the matching record when one exists (read-back of a LIST item)", async () => {
    // Discover a real id from the live LIST (no seeded id hard-coded).
    const list = await suite.app.inject({
      method: "GET", url: "/v1/seed-candidate-records?limit=1",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as ListResponse;
    if (body.items.length === 0) {
      // Empty seed volume is a legitimate runtime state — nothing to read back.
      return;
    }
    const target = body.items[0]!;
    const r = await suite.app.inject({
      method: "GET", url: `/v1/seed-candidate-records/${target.seedCandidateRecordId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const got = r.json() as SeedCandidateRecord;
    expect(got.seedCandidateRecordId).toBe(target.seedCandidateRecordId);
    expect(typeof got.domain).toBe("string");
    expect(typeof got.naturalKey).toBe("string");
    expect(typeof got.validationStatus).toBe("string");
  });

  it("l'ISTRUTTORIA di un record si può leggere (prima non la leggeva nessuno)", async () => {
    // `sys_seed_validation_results` e `sys_seed_source_evidence` si scrivevano
    // e nessuna API le leggeva: sono la parte che dà valore probatorio alla
    // pipeline — senza, l'approvazione di un record è una firma senza
    // istruttoria. Il cluster C11 le ha popolate con le validazioni VERE del
    // programma (doppia esecuzione a zero righe, batteria, cancello).
    // Il database della CI è un clone di produzione CONGELATO al provisioning
    // (D-08) e non contiene la pipeline scritta dopo. Un test che pretendesse
    // dei record sarebbe verde in locale e rosso in CI — e sarebbe il test a
    // sbagliare. Senza record si verifica comunque il CONTRATTO: gli endpoint
    // esistono, rispondono e proteggono. Che i record ci siano è sorvegliato
    // dalla batteria SQL, che gira sul database vero.
    const lista = await suite.app.inject({
      method: "GET", url: "/v1/seed-candidate-records?limit=1",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(lista.statusCode).toBe(200);
    const items = (lista.json() as { items: SeedCandidateRecord[] }).items;
    if (items.length === 0) {
      // niente pipeline in questo database: resta da provare che le due rotte
      // rispondano coerentemente su un id qualsiasi (404, non 500 né 404-route)
      const vuoto = await suite.app.inject({
        method: "GET", url: "/v1/seed-candidate-records/123e4567-e89b-42d3-a456-426614174000/validations",
        headers: { cookie: ch(platformS.cookies) },
      });
      expect(vuoto.statusCode).toBe(404);
      return;
    }
    const id = items[0]!.seedCandidateRecordId;

    const val = await suite.app.inject({
      method: "GET", url: `/v1/seed-candidate-records/${id}/validations`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(val.statusCode).toBe(200);
    const vb = val.json() as { items: Array<{ ruleCode: string; status: string }>; total: number };
    expect(vb.total).toBeGreaterThan(0);
    // le regole sono quelle vere del programma, non etichette generiche
    expect(vb.items.some((i) => i.ruleCode === "TWICE_RUN_ZERO")).toBe(true);

    const ev = await suite.app.inject({
      method: "GET", url: `/v1/seed-candidate-records/${id}/evidence`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(ev.statusCode).toBe(200);
    const eb = ev.json() as { items: Array<{ url: string | null }>; total: number };
    expect(eb.total).toBeGreaterThan(0);
    // la fonte è il seed stesso, versionato nel repository
    expect(eb.items[0]!.url).toMatch(/^repo:\/\/db\/seeds\//);
  });

  it("istruttoria e fonti di un record inesistente → 404", async () => {
    // un UUID formalmente valido (v4) che non corrisponde a nessun record: con uno
    // non conforme allo schema la richiesta si fermerebbe prima, con un 400
    const finto = "123e4567-e89b-42d3-a456-426614174000";
    for (const coda of ["validations", "evidence"]) {
      const r = await suite.app.inject({
        method: "GET", url: `/v1/seed-candidate-records/${finto}/${coda}`,
        headers: { cookie: ch(platformS.cookies) },
      });
      expect(r.statusCode).toBe(404);
    }
  });

  it("GET /:id with a malformed (non-uuid) id → 400 validation error", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/seed-candidate-records/not-a-uuid",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(400);
  });
});
