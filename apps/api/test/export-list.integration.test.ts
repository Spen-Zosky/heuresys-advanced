/**
 * apps/api/test/export-list.integration.test.ts
 * Integration tests for the 3.5 generic list-export hook against a real list
 * endpoint (GET /v1/users, {items,total}) hitting the live OCI DB. Asserts the
 * download envelope + magic bytes per format, RBAC passthrough, and that the
 * normal JSON response is untouched without ?format.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

let suite: TestApp;
let adminCookies: Map<string, string>;

describe("GET /v1/users — generic ?format export hook (3.5)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "admin@heuresys.com", PWD);
    adminCookies = new Map<string, string>();
    for (const c of r.cookies) adminCookies.set(c.name, c.value);
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("no ?format → normal JSON list untouched", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/users", headers: { cookie: ch(adminCookies) } });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("application/json");
    expect(r.headers["content-disposition"]).toBeUndefined();
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("?format=csv → text/csv download with header + rows", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/users?format=csv", headers: { cookie: ch(adminCookies) } });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("text/csv");
    expect(r.headers["content-disposition"]).toMatch(/attachment; filename="users-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = r.body.trim().split("\n");
    expect(lines.length).toBeGreaterThan(1); // header + at least one user
    expect(lines[0]).toContain(","); // multi-column header
  });

  it("?format=xlsx → spreadsheet download (zip 'PK' magic)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/users?format=xlsx", headers: { cookie: ch(adminCookies) } });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("spreadsheetml");
    expect(r.headers["content-disposition"]).toMatch(/\.xlsx"/);
    expect(r.rawPayload[0]).toBe(0x50); // P
    expect(r.rawPayload[1]).toBe(0x4b); // K
  });

  it("?format=pdf → pdf download ('%PDF' magic)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/users?format=pdf", headers: { cookie: ch(adminCookies) } });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");
    expect(r.headers["content-disposition"]).toMatch(/\.pdf"/);
    expect(r.rawPayload.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("unknown ?format=bogus → ignored, normal JSON", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/users?format=bogus", headers: { cookie: ch(adminCookies) } });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("application/json");
    expect(r.headers["content-disposition"]).toBeUndefined();
  });

  it("unauthenticated + ?format=csv → 401 (hook does not fire on non-200)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/users?format=csv" });
    expect(r.statusCode).toBe(401);
    expect(r.headers["content-disposition"]).toBeUndefined();
  });
});
