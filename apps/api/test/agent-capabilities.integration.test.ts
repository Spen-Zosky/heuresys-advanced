/**
 * apps/api/test/agent-capabilities.integration.test.ts — ADR-0053 A1/A3/D4, piano dei principi
 * agentici voce T3c.
 *
 * Il registro delle capacità degli agenti (000480) e chi lo decide (000481), provati sul servizio
 * con attori presi dal dato: un amministratore di piattaforma, un Direttore HR di un tenant, un
 * gettone d'agente per conto del Direttore. L'isolamento transazionale del file annulla tutto.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import { userHasPermission } from "../src/middleware/rbac.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { agentCapabilitiesService as svc } from "../src/modules/agent-capabilities/service.js";

let piattaforma: ActorContext;
let direttore: ActorContext;
let agente: ActorContext;
let lettore: ActorContext | undefined;
const CODICE = `prova.t3c_${Date.now().toString(36)}`;

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

/** Una persona attiva che ha il ruolo dato e nessun ruolo di piattaforma (o solo quello). */
async function personaCon(ruolo: string, diPiattaforma: boolean): Promise<{ user_id: string; user_tenant_id: string | null } | undefined> {
  const r = await pool.query<{ user_id: string; user_tenant_id: string | null }>(
    `SELECT u.user_id, u.user_tenant_id FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE r.auth_role_code = $1 AND u.user_status = 'ACTIVE'
        AND ($2 OR (u.user_tenant_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM sys.sys_user_auth_roles ur2 JOIN sys.sys_auth_roles r2 ON r2.auth_role_id = ur2.user_auth_role_role_id
               WHERE ur2.user_auth_role_user_id = u.user_id AND ur2.user_auth_role_revoked_at IS NULL AND r2.auth_role_is_platform)))
      ORDER BY u.user_id LIMIT 1`,
    [ruolo, diPiattaforma],
  );
  return r.rows[0];
}

beforeAll(async () => {
  await loadRolePermissionCache();
  const p = await personaCon("PLATFORM_ADMIN", true);
  if (!p) throw new Error("nessun PLATFORM_ADMIN attivo");
  piattaforma = { userId: p.user_id, tenantId: p.user_tenant_id, roles: await ruoliDi(p.user_id) };
  const d = await personaCon("HRMS_MANAGER", false);
  if (!d || !d.user_tenant_id) throw new Error("nessun HRMS_MANAGER di tenant attivo");
  direttore = { userId: d.user_id, tenantId: d.user_tenant_id, roles: await ruoliDi(d.user_id) };
  agente = { ...direttore, agente: { codice: "assistente-hr", compito: "prova", permessi: null } };
  const t = await personaCon("TENANT_ADMIN", false);
  if (t?.user_tenant_id) lettore = { userId: t.user_id, tenantId: t.user_tenant_id, roles: await ruoliDi(t.user_id) };
});

afterAll(async () => {
  await closePool();
});

describe("i permessi del registro (000481)", () => {
  it("il Direttore legge e decide, non scrive il catalogo; la piattaforma fa tutto; l'amministratore del tenant legge soltanto", () => {
    expect(userHasPermission(direttore, "agent_capability:read")).toBe(true);
    expect(userHasPermission(direttore, "agent_capability:activate")).toBe(true);
    expect(userHasPermission(direttore, "agent_capability:manage")).toBe(false);
    for (const p of ["agent_capability:read", "agent_capability:manage", "agent_capability:activate"]) {
      expect(userHasPermission(piattaforma, p)).toBe(true);
    }
    if (lettore && !lettore.roles.includes("HRMS_MANAGER")) {
      expect(userHasPermission(lettore, "agent_capability:read")).toBe(true);
      expect(userHasPermission(lettore, "agent_capability:activate")).toBe(false);
      expect(userHasPermission(lettore, "agent_capability:manage")).toBe(false);
    }
  });
});

describe("il catalogo e il modo (000480, ADR-0053)", () => {
  let id = "";

  it("la piattaforma crea una bozza; lo stesso codice fa una versione nuova", async () => {
    const corpo = {
      code: CODICE, agentCode: "assistente-hr", description: "prova T3c", dataGroups: ["ORGANIZATION"],
      excludedGroups: [], undoMechanism: "GIORNALE_UNDO" as const, undoRef: "staging.prova_undo", volumeCap: 3,
    };
    const c = await svc.create(piattaforma, corpo);
    expect(c).toMatchObject({ code: CODICE, version: 1, status: "BOZZA", operations: [], activation: null });
    id = c.id;
    expect((await svc.create(piattaforma, corpo)).version).toBe(2);
    expect(await codiceDi(svc.create(agente, corpo))).toBe("AGENT_CANNOT_DECIDE");
  });

  it("le operazioni rispettano le classi: GET è A e solo GET, DELETE è C", async () => {
    expect(await codiceDi(svc.addOperation(piattaforma, id, { conceptId: "organization-units", operationId: "get", httpMethod: "GET", actionClass: "B" }))).toBe("AGENT_CAPABILITY_RULE");
    expect(await codiceDi(svc.addOperation(piattaforma, id, { conceptId: "organization-units", operationId: "delete_by_id", httpMethod: "DELETE", actionClass: "B" }))).toBe("AGENT_CAPABILITY_RULE");
    const c = await svc.addOperation(piattaforma, id, { conceptId: "organization-units", operationId: "post", httpMethod: "POST", actionClass: "B" });
    expect(c.operations).toHaveLength(1);
    expect(await codiceDi(svc.addOperation(piattaforma, id, { conceptId: "organization-units", operationId: "post", httpMethod: "POST", actionClass: "B" }))).toBe("AGENT_CAPABILITY_DUPLICATE");
  });

  it("una bozza non ha un modo; pubblicata, l'elenco delle operazioni si chiude", async () => {
    expect(await codiceDi(svc.decide(direttore, id, { mode: "CONFERMA", reason: "prova" }))).toBe("AGENT_CAPABILITY_NOT_PUBLISHED");
    expect((await svc.setStatus(piattaforma, id, "PUBBLICATA")).status).toBe("PUBBLICATA");
    expect(await codiceDi(svc.addOperation(piattaforma, id, { conceptId: "positions", operationId: "post", httpMethod: "POST", actionClass: "B" }))).toBe("AGENT_CAPABILITY_RULE");
    expect(await codiceDi(svc.setStatus(piattaforma, id, "PUBBLICATA"))).toBe("AGENT_CAPABILITY_RULE");
  });

  it("il Direttore decide CONFERMA per il suo tenant, non per un altro, e non libera finché manca il registro «per conto di»", async () => {
    const c = await svc.decide(direttore, id, { mode: "CONFERMA", reason: "prova del Direttore" });
    expect(c.activation).toMatchObject({ mode: "CONFERMA", tenantId: direttore.tenantId, decidedBy: direttore.userId, source: "PERSONA" });
    expect(await codiceDi(svc.decide(direttore, id, { mode: "LIBERA", reason: "prova", noticeRef: "inf-1", rollbackProofRef: "prova-1" }))).toBe("AGENT_ONBEHALF_REGISTER_MISSING");
    const altro = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_id <> $1 LIMIT 1`, [direttore.tenantId]);
    if (altro.rows[0]) {
      expect(await codiceDi(svc.decide(direttore, id, { mode: "CONFERMA", reason: "prova", tenantId: altro.rows[0].tenant_id }))).toBe("PERMISSION_DENIED");
    }
  });

  it("un agente non decide il proprio modo, anche con il permesso della persona", async () => {
    expect(await codiceDi(svc.decide(agente, id, { mode: "CONFERMA", reason: "prova" }))).toBe("AGENT_CANNOT_DECIDE");
  });

  it("la piattaforma riporta a CONFERMA per un tenant, e non libera mai", async () => {
    expect(await codiceDi(svc.decide(piattaforma, id, { mode: "LIBERA", reason: "prova", tenantId: direttore.tenantId! }))).toBe("PLATFORM_ONLY_CONFERMA");
    const prima = (await svc.get(direttore, id)).activation!.id;
    await svc.decide(piattaforma, id, { mode: "CONFERMA", reason: "interruttore", tenantId: direttore.tenantId! });
    const dopo = (await svc.get(direttore, id)).activation!;
    expect(dopo.id).not.toBe(prima);
    expect(dopo).toMatchObject({ mode: "CONFERMA", decidedBy: piattaforma.userId, reason: "interruttore" });
    const r = await pool.query<{ s: string }>(
      `SELECT agent_capability_activation_supersedes_id AS s FROM sys.sys_agent_capability_activations WHERE agent_capability_activation_id = $1`,
      [dopo.id],
    );
    expect(r.rows[0]!.s).toBe(prima);
  });

  it("una capacità pubblicata si ritira, una volta sola", async () => {
    expect((await svc.setStatus(piattaforma, id, "RITIRATA")).status).toBe("RITIRATA");
    expect(await codiceDi(svc.setStatus(piattaforma, id, "RITIRATA"))).toBe("AGENT_CAPABILITY_RULE");
    expect((await svc.list(direttore)).some((c) => c.id === id)).toBe(true);
  });
});
