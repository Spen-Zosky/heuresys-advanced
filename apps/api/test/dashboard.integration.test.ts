/**
 * apps/api/test/dashboard.integration.test.ts
 * Integration tests for GET /v1/dashboard/widgets (role-gated aggregator).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { unManagerConPosizioniAttive, unEstraneoOrganizzativo } from "./helpers/org-actors.js";
import { M1 } from "../src/lib/scope/matrix.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S { cookies: Map<string, string> }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let managerS: S;
let employeeS: S;

describe("GET /v1/dashboard/widgets integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "platform-test-admin@collaudo.invalid");
    tenantS = await login(suite, "governo@collaudo.invalid");
    // [S1045] Il manager si sceglie per CARATTERISTICA: deve possedere almeno una
    // posizione ATTIVA, perche' e' da li' che il cruscotto ricava lo scope TEAM.
    // `paolo.caputo`, nominato prima, dopo la ricostruzione ne possiede 5 tutte
    // disattivate: il suo cruscotto e' legittimamente vuoto e il test non misurava
    // piu' lo scope di squadra. Il dipendente e' un suo estraneo senza mandato, che
    // e' tutto cio' che serve per il 403.
    const manager = await unManagerConPosizioniAttive(pool);
    managerS = await login(suite, manager.email);
    const dipendente = await unEstraneoOrganizzativo(pool, manager.userId);
    employeeS = await login(suite, dipendente.email);
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("PLATFORM_ADMIN sees PLATFORM scope with tenants counter populated", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      role: string;
      scope: { kind: string; tenantId: string | null; teamPositionIds: string[] };
      counters: {
        tenants: number | null;
        users: number;
        positions: number;
        blueprints: number | null;
      };
      generatedAt: string;
    };
    expect(body.role).toBe("PLATFORM_ADMIN");
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    expect(body.counters.tenants).not.toBeNull();
    expect(body.counters.tenants!).toBeGreaterThanOrEqual(1);
    expect(body.counters.users).toBeGreaterThanOrEqual(5); // 5 test personas
    expect(body.counters.positions).toBeGreaterThanOrEqual(3); // TEST positions
    expect(body.counters.blueprints).not.toBeNull();
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("PLATFORM trends expose 8-week cumulative series for StatsCard sparklines", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      counters: { users: number };
      trends: Array<{
        key: string; current: number; previousWeek: number;
        deltaPct: number; direction: string; series: number[]; weeks: number;
      }>;
    };
    expect(Array.isArray(body.trends)).toBe(true);
    expect([...body.trends].map((t) => t.key).sort()).toEqual([
      "learningGaps", "learningPaths", "organizationUnits", "positions", "users",
    ]);
    for (const t of body.trends) {
      expect(t.weeks).toBe(8);
      expect(t.series.length).toBe(8);
      expect(["up", "down", "flat"]).toContain(t.direction);
      // Cumulative count series must be non-decreasing and end at `current`.
      for (let i = 1; i < t.series.length; i++) {
        expect(t.series[i]!).toBeGreaterThanOrEqual(t.series[i - 1]!);
      }
      expect(t.series[t.series.length - 1]).toBe(t.current);
    }
    const usersTrend = body.trends.find((t) => t.key === "users")!;
    expect(usersTrend.current).toBe(body.counters.users);
  });

  it("TENANT_ADMIN sees TENANT scope filtered to own tenant", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      role: string;
      scope: { kind: string; tenantId: string | null };
      counters: { tenants: number | null; users: number; positions: number };
    };
    expect(body.role).toBe("TENANT_ADMIN");
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    // No cross-tenant tenants counter for non-platform.
    expect(body.counters.tenants).toBeNull();
    expect(body.counters.users).toBeGreaterThanOrEqual(4); // RTL personas
    expect(body.counters.positions).toBeGreaterThanOrEqual(1);
  });

  it("MANAGER sees TEAM scope with own owned position(s)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
      headers: { cookie: ch(managerS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      role: string;
      scope: { kind: string; teamPositionIds: string[] };
      counters: { users: number; positions: number };
      trends: unknown[];
    };
    // #142 F2 — l'attesa era scritta a mano (`"MANAGER"`) e rispecchiava la `highestRoleLabel`
    // cancellata. Al tier TEAM il perimetro non lo giustifica un RUOLO ma un DOMINIO — un
    // fatto nei dati — quindi l'etichetta e' un dominio di M1. L'atteso si deriva dalla
    // matrice, non si sostituisce con un secondo letterale che invecchierebbe uguale.
    expect(Object.keys(M1)).toContain(body.role);
    expect(body.scope.kind).toBe("TEAM");
    // paolo.caputo (manager persona) dirige unita' reali: il perimetro non e' vuoto.
    expect(body.scope.teamPositionIds.length).toBeGreaterThanOrEqual(1);
    // positions count == owned positions count.
    expect(body.counters.positions).toBe(body.scope.teamPositionIds.length);
    // TEAM scope returns no trends (no fabricated team-disaggregated history).
    expect(body.trends).toEqual([]);
  });

  it("D1/D2: il contatore delle persone e l'attivita' recente escludono le utenze di servizio", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets", headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      scope: { tenantId: string };
      counters: { users: number };
      recentActivity: Array<{ kind: string; resourceId: string }>;
    };
    const atteso = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_users WHERE user_tenant_id = $1 AND user_type <> 'SERVICE'`,
      [body.scope.tenantId],
    );
    expect(body.counters.users).toBe(Number(atteso.rows[0]!.n));
    const servizio = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_type = 'SERVICE'`,
    );
    const idServizio = new Set(servizio.rows.map((x) => x.user_id));
    expect(body.recentActivity.filter((a) => idServizio.has(a.resourceId))).toEqual([]);
  });

  it("D2/D7: chi guida una catena vede nell'attivita' solo la sua catena e non i contatori del tenant", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets", headers: { cookie: ch(managerS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      scope: { teamPositionIds: string[] };
      counters: { learningPaths: number | null; blueprints: number | null; pendingRecommendations: number | null };
      recentActivity: Array<{ kind: string; resourceId: string }>;
    };
    expect(body.counters.learningPaths).toBeNull();
    expect(body.counters.blueprints).toBeNull();
    expect(body.counters.pendingRecommendations).toBeNull();
    const nelPerimetro = await pool.query<{ id: string }>(
      `SELECT a.user_position_assignment_user_id AS id FROM sys.sys_user_position_assignments a
        WHERE a.user_position_assignment_status = 'ACTIVE'
          AND a.user_position_assignment_position_id = ANY($1::uuid[])
       UNION
       SELECT p FROM unnest($1::uuid[]) AS p`,
      [body.scope.teamPositionIds],
    );
    const ammessi = new Set(nelPerimetro.rows.map((x) => x.id));
    for (const a of body.recentActivity) expect(ammessi.has(a.resourceId)).toBe(true);
  });

  it("USER (employee) has no dashboard:view permission → 403", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("unauthenticated → 401", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
    });
    expect(r.statusCode).toBe(401);
  });
});
