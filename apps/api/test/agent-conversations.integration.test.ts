/**
 * apps/api/test/agent-conversations.integration.test.ts — ADR-0056 D4, piano dei principi agentici
 * voce T6a.
 *
 * Le conversazioni dell'assistente (000483) provate sul servizio con persone prese dal dato: due
 * persone attive dello stesso tenant e un gettone d'agente per conto della prima. Si prova ciò che
 * ADR-0056 §4 chiede: una conversazione è della persona, e un'altra utenza riceve un rifiuto; la
 * proposta la decide solo la persona, con un motivo quando la scarta; ciò che scade o resta aperto
 * troppo a lungo si legge scaduto o interrotto. L'isolamento transazionale del file annulla tutto.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import { userHasPermission } from "../src/middleware/rbac.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { agentConversationsService as svc } from "../src/modules/agent-conversations/service.js";

let anna: ActorContext;
let bruno: ActorContext;
let agente: ActorContext;

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

const fra = (minuti: number) => new Date(Date.now() + minuti * 60_000).toISOString();

beforeAll(async () => {
  await loadRolePermissionCache();
  // Due persone attive dello stesso tenant, con almeno un ruolo ciascuna.
  const r = await pool.query<{ user_id: string; user_tenant_id: string }>(
    `SELECT u.user_id, u.user_tenant_id FROM sys.sys_users u
      WHERE u.user_status = 'ACTIVE' AND u.user_tenant_id = (
              SELECT u2.user_tenant_id FROM sys.sys_users u2
               WHERE u2.user_status = 'ACTIVE' AND u2.user_tenant_id IS NOT NULL
               GROUP BY u2.user_tenant_id HAVING count(*) >= 2
               ORDER BY u2.user_tenant_id LIMIT 1)
        AND EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur
                     WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL)
      ORDER BY u.user_id LIMIT 2`,
  );
  const [a, b] = r.rows;
  if (!a || !b) throw new Error("servono due persone attive dello stesso tenant");
  anna = { userId: a.user_id, tenantId: a.user_tenant_id, roles: await ruoliDi(a.user_id) };
  bruno = { userId: b.user_id, tenantId: b.user_tenant_id, roles: await ruoliDi(b.user_id) };
  agente = { ...anna, agente: { codice: "assistente-hr", compito: "prova", permessi: null } };
});

afterAll(async () => {
  await closePool();
});

describe("il permesso (000483)", () => {
  it("ogni ruolo di tenant in servizio, e PLATFORM_ADMIN, usa l'assistente", async () => {
    const r = await pool.query<{ code: string }>(
      `SELECT r.auth_role_code AS code FROM sys.sys_auth_roles r
        WHERE r.retired_at IS NULL AND (r.auth_role_is_platform = false OR r.auth_role_code = 'PLATFORM_ADMIN')`,
    );
    expect(r.rows.length).toBeGreaterThan(0);
    for (const { code } of r.rows) {
      expect(userHasPermission({ roles: [code as RoleCode] }, "agent_conversation:use:self"), code).toBe(true);
    }
  });
});

describe("una conversazione è della persona (ADR-0056 §4)", () => {
  it("la persona la apre e la ritrova; un'altra persona dello stesso tenant non la vede", async () => {
    const c = await svc.create(anna, { agentCode: "assistente-hr", title: "Prova T6a" });
    expect(c).toMatchObject({ agentCode: "assistente-hr", title: "Prova T6a", activities: [], personsSeen: [] });
    expect((await svc.list(anna)).some((x) => x.id === c.id)).toBe(true);
    expect((await svc.list(bruno)).some((x) => x.id === c.id)).toBe(false);
    expect(await codiceDi(svc.get(bruno, c.id))).toBe("NOT_FOUND");
    expect(await codiceDi(svc.createActivity(bruno, c.id, { prompt: "leggi" }))).toBe("NOT_FOUND");
    expect(await codiceDi(svc.update(bruno, c.id, { sdkSessionRef: "x" }))).toBe("NOT_FOUND");
  });

  it("l'assistente scrive per conto della persona: sessione e impronte si sommano, senza doppioni", async () => {
    const c = await svc.create(agente, { agentCode: "assistente-hr", title: "Ripresa" });
    const h1 = "a".repeat(64);
    const h2 = "b".repeat(64);
    await svc.update(agente, c.id, { sdkSessionRef: "sessione-1", personsSeen: [h1] });
    const dopo = await svc.update(agente, c.id, { personsSeen: [h1, h2] });
    expect(dopo.sdkSessionRef).toBe("sessione-1");
    expect(dopo.personsSeen).toEqual([h1, h2]);
    // la stessa riga, letta dalla persona con i suoi cookie
    expect((await svc.get(anna, c.id)).personsSeen).toHaveLength(2);
  });
});

describe("attività, eventi e proposte", () => {
  it("il giro scrive gli eventi in ordine e una proposta in attesa; un'altra persona non li legge", async () => {
    const c = await svc.create(agente, { agentCode: "assistente-hr", title: "Giro" });
    const a = await svc.createActivity(agente, c.id, { prompt: "quante persone nel mio reparto?" });
    expect(a).toMatchObject({ status: "IN_CORSO", stopReason: null, endedAt: null, pendingProposals: 0 });
    expect(await svc.appendEvents(agente, a.id, { events: [{ kind: "TESTO", payload: { testo: "Guardo." } }] })).toEqual({ lastSeq: 1 });
    expect(await svc.appendEvents(agente, a.id, {
      events: [{ kind: "STRUMENTO", payload: { strumento: "hrx_users_list" } }, { kind: "TESTO", payload: { testo: "Sono 7." } }],
    })).toEqual({ lastSeq: 3 });
    const id = randomUUID();
    const p = await svc.createProposal(agente, a.id, {
      proposalId: id, kind: "SCRITTURA", tool: "hrx_goal_update", input: { goalId: "[redatto]" },
      actionClass: "B", expiresAt: fra(5),
    });
    expect(p).toMatchObject({ id, status: "IN_ATTESA", actionClass: "B", rejectReason: null, decidedAt: null });

    const e = await svc.events(anna, a.id, 0);
    expect(e.events.map((x) => [x.seq, x.kind])).toEqual([[1, "TESTO"], [2, "STRUMENTO"], [3, "TESTO"]]);
    expect(e.proposals.map((x) => x.status)).toEqual(["IN_ATTESA"]);
    expect(e.activity.pendingProposals).toBe(1);
    expect((await svc.events(anna, a.id, 1)).events.map((x) => x.seq)).toEqual([2, 3]);

    expect(await codiceDi(svc.events(bruno, a.id, 0))).toBe("NOT_FOUND");
    expect(await codiceDi(svc.appendEvents(bruno, a.id, { events: [{ kind: "TESTO", payload: {} }] }))).toBe("NOT_FOUND");
    expect(await codiceDi(svc.decide(bruno, id, { decision: "APPROVATA" }))).toBe("NOT_FOUND");
  });

  it("decide solo la persona; scartare chiede un motivo; una proposta decisa non si decide ancora", async () => {
    const c = await svc.create(agente, { agentCode: "assistente-hr", title: "Decisione" });
    const a = await svc.createActivity(agente, c.id, { prompt: "aggiorna l'obiettivo" });
    const id = randomUUID();
    await svc.createProposal(agente, a.id, {
      proposalId: id, kind: "SCRITTURA", tool: "hrx_goal_update", input: {}, actionClass: "B", expiresAt: fra(5),
    });
    expect(await codiceDi(svc.decide(agente, id, { decision: "APPROVATA" }))).toBe("AGENT_CANNOT_DECIDE");
    expect(await codiceDi(svc.decide(anna, id, { decision: "SCARTATA" }))).toBe("AGENT_PROPOSAL_REJECT_REASON_REQUIRED");
    expect(await codiceDi(svc.decide(anna, id, { decision: "SCARTATA", reason: "   " }))).toBe("AGENT_PROPOSAL_REJECT_REASON_REQUIRED");
    const p = await svc.decide(anna, id, { decision: "SCARTATA", reason: "obiettivo sbagliato" });
    expect(p).toMatchObject({ status: "SCARTATA", rejectReason: "obiettivo sbagliato" });
    expect(p.decidedAt).not.toBeNull();
    expect(await codiceDi(svc.decide(anna, id, { decision: "APPROVATA" }))).toBe("AGENT_PROPOSAL_NOT_PENDING");
  });

  it("una proposta oltre la scadenza si legge SCADUTA e non si decide", async () => {
    const c = await svc.create(agente, { agentCode: "assistente-hr", title: "Scadenza" });
    const a = await svc.createActivity(agente, c.id, { prompt: "scrivi" });
    const id = randomUUID();
    await svc.createProposal(agente, a.id, {
      proposalId: id, kind: "SCRITTURA", tool: "hrx_goal_update", input: {}, expiresAt: fra(5),
    });
    // la stessa proposta, come se fosse nata dieci minuti fa con cinque minuti di vita
    await pool.query(
      `UPDATE sys.sys_agent_proposals
          SET agent_proposal_created_at = now() - interval '10 minutes',
              agent_proposal_expires_at = now() - interval '5 minutes'
        WHERE agent_proposal_id = $1`,
      [id],
    );
    const e = await svc.events(anna, a.id, 0);
    expect(e.proposals.map((x) => x.status)).toEqual(["SCADUTA"]);
    expect(e.activity.pendingProposals).toBe(0);
    expect(await codiceDi(svc.decide(anna, id, { decision: "APPROVATA" }))).toBe("AGENT_PROPOSAL_EXPIRED");
  });

  it("un'attività chiusa non riceve altro; una aperta troppo vecchia si legge INTERROTTA", async () => {
    const c = await svc.create(agente, { agentCode: "assistente-hr", title: "Chiusura" });
    const a = await svc.createActivity(agente, c.id, { prompt: "riassumi" });
    const chiusa = await svc.updateActivity(agente, a.id, { status: "FATTA", result: "Fatto." });
    expect(chiusa).toMatchObject({ status: "FATTA", result: "Fatto." });
    expect(chiusa.endedAt).not.toBeNull();
    expect(await codiceDi(svc.appendEvents(agente, a.id, { events: [{ kind: "TESTO", payload: {} }] }))).toBe("AGENT_ACTIVITY_CLOSED");
    expect(await codiceDi(svc.updateActivity(agente, a.id, { status: "IN_CORSO" }))).toBe("AGENT_ACTIVITY_CLOSED");

    // in una conversazione sua, così l'attività più recente della conversazione è questa
    const c2 = await svc.create(agente, { agentCode: "assistente-hr", title: "Lavoro lungo" });
    const b = await svc.createActivity(agente, c2.id, { prompt: "lavoro lungo" });
    await pool.query(
      `UPDATE sys.sys_agent_activities SET agent_activity_started_at = now() - interval '31 minutes'
        WHERE agent_activity_id = $1`,
      [b.id],
    );
    const letta = (await svc.get(anna, c2.id)).activities.find((x) => x.id === b.id);
    expect(letta?.status).toBe("INTERROTTA");
    expect((await svc.list(anna)).find((x) => x.id === c2.id)?.lastActivityStatus).toBe("INTERROTTA");
    expect(await codiceDi(svc.appendEvents(agente, b.id, { events: [{ kind: "TESTO", payload: {} }] }))).toBe("AGENT_ACTIVITY_CLOSED");
  });

  it("il database rifiuta uno scarto senza motivo anche se il servizio lo lasciasse passare", async () => {
    const c = await svc.create(agente, { agentCode: "assistente-hr", title: "Vincolo" });
    const a = await svc.createActivity(agente, c.id, { prompt: "scrivi" });
    const id = randomUUID();
    await svc.createProposal(agente, a.id, {
      proposalId: id, kind: "SCRITTURA", tool: "hrx_goal_update", input: {}, expiresAt: fra(5),
    });
    // Una scrittura diretta gira nel suo punto di salvataggio (helpers/tx-isolation.ts): il rifiuto
    // non interrompe il resto del file.
    const codice = await codiceDi(pool.query(
      `UPDATE sys.sys_agent_proposals SET agent_proposal_status = 'SCARTATA', agent_proposal_decided_at = now()
        WHERE agent_proposal_id = $1`,
      [id],
    ));
    expect(codice).toBe("23514");
  });
});
