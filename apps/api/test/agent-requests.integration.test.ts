/**
 * apps/api/test/agent-requests.integration.test.ts — tappa T2, migrazione 000501.
 *
 * Il cancello «richiesta dell'agente con previsione di spesa, tetto, accetta o rifiuta» e il registro
 * di costo e durata, provati sul servizio con persone prese dal dato. Si prova: la previsione oltre il
 * tetto non crea la richiesta (servizio e database), il tetto oltre il massimo nemmeno; la richiesta è
 * della persona che la propone e la coda di tutti la vede solo chi ha `agent_request:read:all`;
 * decide solo chi ha il permesso e mai un gettone d'agente; si decide una volta sola; rifiutare
 * chiede un motivo; il registro somma costo e durata. I due permessi nuovi stanno a PLATFORM_ADMIN
 * e a nessun altro ruolo. L'isolamento transazionale del file annulla tutto.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import { userHasPermission } from "../src/middleware/rbac.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { agentRequestsService as svc, maxCapUsd } from "../src/modules/agent-requests/service.js";

let anna: ActorContext;
let bruno: ActorContext;
let agente: ActorContext;
let piattaforma: ActorContext;

async function ruoliDi(userId: string): Promise<RoleCode[]> {
  const r = await pool.query<{ code: string }>(
    `SELECT ro.auth_role_code AS code FROM sys.sys_user_auth_roles ur
       JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
      WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_revoked_at IS NULL`,
    [userId],
  );
  return r.rows.map((x) => x.code) as RoleCode[];
}

async function codiceDi(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
}

const richiesta = (o: Partial<{ estimateUsd: number; capUsd: number; title: string }> = {}) => ({
  agentCode: "assistente-hr",
  title: o.title ?? "Difetto nella pagina dei processi",
  body: "# Difetto\n\nLa tabella dei processi non mostra il responsabile.",
  perimeter: "Direzione HR",
  estimateUsd: o.estimateUsd ?? 0.5,
  capUsd: o.capUsd ?? 1,
});

beforeAll(async () => {
  await loadRolePermissionCache();
  const r = await pool.query<{ user_id: string; user_tenant_id: string }>(
    `SELECT u.user_id, u.user_tenant_id FROM sys.sys_users u
      WHERE u.user_status = 'ACTIVE' AND u.user_tenant_id = (
              SELECT u2.user_tenant_id FROM sys.sys_users u2
               WHERE u2.user_status = 'ACTIVE' AND u2.user_tenant_id IS NOT NULL
               GROUP BY u2.user_tenant_id HAVING count(*) >= 2
               ORDER BY u2.user_tenant_id LIMIT 1)
      ORDER BY u.user_id LIMIT 2`,
  );
  const [a, b] = r.rows;
  if (!a || !b) throw new Error("servono due persone attive dello stesso tenant");
  anna = { userId: a.user_id, tenantId: a.user_tenant_id, roles: await ruoliDi(a.user_id) };
  bruno = { userId: b.user_id, tenantId: b.user_tenant_id, roles: await ruoliDi(b.user_id) };
  agente = { ...anna, agente: { codice: "assistente-hr", compito: "prova", permessi: null } };
  // chi decide: la persona qualunque con il ruolo di piattaforma (il permesso lo guarda la rotta)
  piattaforma = { userId: bruno.userId, tenantId: bruno.tenantId, roles: ["PLATFORM_ADMIN"] };
});

afterAll(async () => {
  await closePool();
});

describe("i permessi (000501)", () => {
  it("decidere e leggere la coda stanno a PLATFORM_ADMIN e a nessun altro ruolo", async () => {
    const r = await pool.query<{ code: string }>(`SELECT auth_role_code AS code FROM sys.sys_auth_roles WHERE retired_at IS NULL`);
    for (const { code } of r.rows) {
      const ha = code === "PLATFORM_ADMIN";
      expect(userHasPermission({ roles: [code as RoleCode] }, "agent_request:decide"), code).toBe(ha);
      expect(userHasPermission({ roles: [code as RoleCode] }, "agent_request:read:all"), code).toBe(ha);
    }
  });
});

describe("il cancello della previsione", () => {
  it("una richiesta dentro il tetto nasce in attesa, con la previsione e il tetto", async () => {
    const r = await svc.create(anna, richiesta());
    expect(r.status).toBe("IN_ATTESA");
    expect(r.estimateUsd).toBe(0.5);
    expect(r.capUsd).toBe(1);
    expect(r.requesterId).toBe(anna.userId);
  });

  it("la previsione oltre il tetto non crea la richiesta", async () => {
    expect(await codiceDi(svc.create(anna, richiesta({ estimateUsd: 2, capUsd: 1 })))).toBe("AGENT_REQUEST_ESTIMATE_OVER_CAP");
  });

  it("il tetto oltre il massimo del servizio non crea la richiesta", async () => {
    const max = maxCapUsd();
    expect(await codiceDi(svc.create(anna, richiesta({ estimateUsd: 1, capUsd: max + 1 })))).toBe("AGENT_REQUEST_CAP_OVER_MAX");
  });

  it("il database rifiuta da sé una previsione oltre il tetto e un rifiuto senza motivo", async () => {
    const dentro = await svc.create(anna, richiesta());
    const sopra = await codiceDi(pool.query(
      `UPDATE sys.sys_agent_requests SET agent_request_estimate_usd = agent_request_cap_usd + 1 WHERE agent_request_id = $1`, [dentro.id]));
    expect(sopra).toBe("23514");
    const senzaMotivo = await codiceDi(pool.query(
      `UPDATE sys.sys_agent_requests SET agent_request_status = 'RIFIUTATA', agent_request_decided_at = now() WHERE agent_request_id = $1`, [dentro.id]));
    expect(senzaMotivo).toBe("23514");
  });
});

describe("chi vede e chi decide", () => {
  it("ognuno vede le proprie richieste; la coda di tutti la vede solo chi ha il permesso", async () => {
    const sua = await svc.create(anna, richiesta({ title: "Richiesta di Anna" }));
    const mie = await svc.list(anna, { scope: "own" });
    expect(mie.items.some((x) => x.id === sua.id)).toBe(true);
    expect(mie.maxCapUsd).toBe(maxCapUsd());
    const sue = await svc.list(bruno, { scope: "own" });
    expect(sue.items.some((x) => x.id === sua.id)).toBe(false);
    expect(await codiceDi(svc.list(anna, { scope: "all" }))).toBe("FORBIDDEN");
    const tutte = await svc.list(piattaforma, { scope: "all", status: "IN_ATTESA" });
    expect(tutte.items.some((x) => x.id === sua.id)).toBe(true);
  });

  it("un gettone d'agente non decide le richieste dell'agente", async () => {
    const r = await svc.create(anna, richiesta());
    expect(await codiceDi(svc.decide(agente, r.id, { decision: "ACCETTA" }))).toBe("AGENT_REQUEST_AGENT_CANNOT_DECIDE");
  });

  it("accettare segna la decisione, e si decide una volta sola", async () => {
    const r = await svc.create(anna, richiesta());
    const dopo = await svc.decide(piattaforma, r.id, { decision: "ACCETTA" });
    expect(dopo.status).toBe("ACCETTATA");
    expect(dopo.decidedAt).not.toBeNull();
    expect(await codiceDi(svc.decide(piattaforma, r.id, { decision: "RIFIUTA", reason: "tardi" }))).toBe("AGENT_REQUEST_NOT_PENDING");
  });

  it("rifiutare conserva il motivo", async () => {
    const r = await svc.create(anna, richiesta());
    const dopo = await svc.decide(piattaforma, r.id, { decision: "RIFIUTA", reason: "Già coperta dal thread dei processi" });
    expect(dopo.status).toBe("RIFIUTATA");
    expect(dopo.rejectReason).toBe("Già coperta dal thread dei processi");
  });

  it("una richiesta che non esiste risponde 404", async () => {
    expect(await codiceDi(svc.decide(piattaforma, randomUUID(), { decision: "ACCETTA" }))).toBe("NOT_FOUND");
  });
});

describe("il registro di costo e durata", () => {
  it("una chiamata si registra, anche legata a una richiesta, e i totali sommano", async () => {
    const r = await svc.create(anna, richiesta());
    const c1 = await svc.recordCall(anna, {
      agentCode: "assistente-hr", model: "claude-sonnet-5-5", outcome: "OK", durationMs: 1200,
      inputTokens: 1000, outputTokens: 200, costUsd: 0.0123, requestId: r.id,
    });
    expect(c1.requestId).toBe(r.id);
    await svc.recordCall(agente, {
      agentCode: "assistente-hr", model: "claude-sonnet-5-5", outcome: "ERRORE", durationMs: 300,
      inputTokens: 0, outputTokens: 0, costUsd: 0,
    });
    const reg = await svc.listCalls(500);
    const nostre = reg.items.filter((x) => x.tenantId === anna.tenantId && x.agentCode === "assistente-hr");
    expect(nostre.length).toBeGreaterThanOrEqual(2);
    expect(reg.totals.calls).toBe(reg.items.length);
    expect(reg.totals.costUsd).toBeGreaterThanOrEqual(0.0123);
  });

  it("non si lega a una richiesta che non c'è", async () => {
    expect(await codiceDi(svc.recordCall(anna, {
      agentCode: "assistente-hr", model: "m", outcome: "OK", durationMs: 1, inputTokens: 0, outputTokens: 0, costUsd: 0,
      requestId: randomUUID(),
    }))).toBe("NOT_FOUND");
  });
});
