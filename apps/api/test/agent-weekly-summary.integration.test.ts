/**
 * apps/api/test/agent-weekly-summary.integration.test.ts — ADR-0063 D3, piano «Heuresys AI-driven»
 * voce F0c (decisione E5): il riepilogo settimanale delle scritture fatte con l'assistente.
 *
 * Righe del diario del cancello scritte qui, in una settimana lontana (gennaio 2001) che nessun dato
 * vero tocca; l'isolamento transazionale del file le annulla. Si prova: la classificazione per
 * ragione (confermata, negata, autonoma; le letture fuori), i confini della settimana in ora di Roma,
 * il perimetro (la piattaforma vede tutti i tenant, il Direttore HR solo il suo), la persona come
 * «Cognome, Nome», l'operazione con il nome del permesso e non con un codice, e la CLI che mette
 * l'avviso nella casella della piattaforma una volta sola.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { agentWeeklySummaryService as svc } from "../src/modules/agent-weekly-summary/service.js";
import { runWeeklySummaryCli } from "../src/modules/agent-weekly-summary/summary-cli.js";
import { messaggioDellAvviso } from "../src/lib/notifications/messaggi.js";

const LUNEDI = "2001-01-01"; // un lunedì
let piattaforma: ActorContext;
let direttore: ActorContext;
let tenantDirettore = "";
let nomeDirettore = "";

async function ruoliDi(userId: string): Promise<RoleCode[]> {
  const r = await pool.query<{ code: string }>(
    `SELECT ro.auth_role_code AS code FROM sys.sys_user_auth_roles ur
       JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
      WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_revoked_at IS NULL`,
    [userId],
  );
  return r.rows.map((x) => x.code) as RoleCode[];
}

async function personaCon(ruolo: string, diPiattaforma: boolean) {
  const r = await pool.query<{ user_id: string; user_tenant_id: string | null; nome: string; tenant_code: string | null }>(
    `SELECT u.user_id, u.user_tenant_id, t.tenant_code,
            COALESCE(NULLIF(concat_ws(', ', NULLIF(trim(u.user_last_name), ''), NULLIF(trim(u.user_first_name), '')), ''), u.user_display_name) AS nome
       FROM sys.sys_users u
       LEFT JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
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

/** Una riga del diario: `ora` è l'ora di Roma. */
async function diario(tenant: string, subject: string, ora: string, reason: string, concept = "organization-units", operation = "post") {
  await pool.query(
    `INSERT INTO audit.agent_gateway_decisions
       (conversation_id, ts, principal_kind, principal_subject, tenant, tool, args_hash, concept, operation, decision, reason)
     VALUES ('00000000-0000-4000-8000-00000000f0c1', ($3::timestamp AT TIME ZONE 'Europe/Rome'), 'user', $2, $1,
             'hrx_org_units_upsert', 'h', $5, $6, $7, $4)`,
    [tenant, subject, ora, reason, concept, operation, reason.startsWith("WRITE_DENIED") ? "deny" : "allow"],
  );
}

beforeAll(async () => {
  await loadRolePermissionCache();
  const p = await personaCon("PLATFORM_ADMIN", true);
  if (!p) throw new Error("nessun PLATFORM_ADMIN attivo");
  piattaforma = { userId: p.user_id, tenantId: p.user_tenant_id, roles: await ruoliDi(p.user_id) };
  const d = await personaCon("HRMS_MANAGER", false);
  if (!d || !d.user_tenant_id || !d.tenant_code) throw new Error("nessun HRMS_MANAGER di tenant attivo");
  direttore = { userId: d.user_id, tenantId: d.user_tenant_id, roles: await ruoliDi(d.user_id) };
  tenantDirettore = d.tenant_code;
  nomeDirettore = d.nome;

  await diario(tenantDirettore, d.user_id, `${LUNEDI} 00:30`, "WRITE_HUMAN_APPROVED");
  await diario(tenantDirettore, d.user_id, "2001-01-03 10:00", "WRITE_HUMAN_APPROVED LIBERA_SPENTA prova@1");
  await diario(tenantDirettore, d.user_id, "2001-01-04 11:00", "WRITE_DENIED_OR_TIMEOUT");
  await diario(tenantDirettore, d.user_id, "2001-01-05 12:00", "READ_ALLOWED", "organization-units", "get");
  await diario("ALTRO_TENANT_F0C", "persona-sconosciuta", "2001-01-07 23:30", "WRITE_HUMAN_APPROVED");
  // fuori dalla settimana, di un soffio, in ora di Roma
  await diario(tenantDirettore, d.user_id, "2000-12-31 23:59", "WRITE_HUMAN_APPROVED");
  await diario(tenantDirettore, d.user_id, "2001-01-08 00:00", "WRITE_HUMAN_APPROVED");
});

afterAll(async () => {
  await closePool();
});

describe("il riepilogo settimanale dell'assistente (ADR-0063 D3, E5)", () => {
  it("la piattaforma vede tutti i tenant della settimana, dal lunedì alla domenica in ora di Roma", async () => {
    const s = await svc.get(piattaforma, "2001-01-04");
    expect(s).toMatchObject({ weekStart: LUNEDI, weekEnd: "2001-01-07", writesTotal: 4 });
    expect(s.totals).toEqual({ confirmed: 3, denied: 1, autonomous: 0, people: 2, conversations: 1 });
    expect(s.writes.map((w) => w.outcome)).toEqual(["CONFERMATA", "NEGATA", "CONFERMATA", "CONFERMATA"]);
  });

  it("il Direttore HR vede solo il suo tenant, con la persona come «Cognome, Nome»", async () => {
    const s = await svc.get(direttore, LUNEDI);
    expect(s.totals).toMatchObject({ confirmed: 2, denied: 1, people: 1 });
    expect(s.people).toHaveLength(1);
    expect(s.people[0]).toMatchObject({ personName: nomeDirettore, tenantCode: tenantDirettore, confirmed: 2, denied: 1, autonomous: 0 });
  });

  it("l'operazione ha il nome del permesso nelle due lingue, non un codice", async () => {
    const s = await svc.get(direttore, LUNEDI);
    const op = s.writes[0]!;
    expect(op.method).toBe("POST");
    expect(op.operationLabel?.it).toBeTruthy();
    expect(op.operationLabel?.it).not.toMatch(/organization-units|:/);
  });

  it("una persona che non c'è più resta contata, senza nome, in fondo all'elenco", async () => {
    const s = await svc.get(piattaforma, LUNEDI);
    const ultimo = s.people[s.people.length - 1]!;
    expect(ultimo).toMatchObject({ userId: null, personName: null, tenantCode: "ALTRO_TENANT_F0C", confirmed: 1 });
  });

  it("la CLI mette l'avviso nella casella di ogni persona con il mandato di piattaforma, una volta sola", async () => {
    const primo = await runWeeklySummaryCli(LUNEDI);
    expect(primo.recipients).toBeGreaterThan(0);
    expect(primo.sent).toBe(primo.recipients);
    const r = await pool.query<{ subject: string; body: string; url: string }>(
      `SELECT notification_subject AS subject, notification_body AS body, notification_action_url AS url
         FROM sys.sys_inbox_notifications WHERE notification_user_id = $1 AND notification_type = 'SYSTEM'
          AND notification_action_url = $2`,
      [piattaforma.userId, `/admin/agent-weekly-summary?week=${LUNEDI}`],
    );
    expect(r.rows).toHaveLength(1);
    expect(messaggioDellAvviso("SYSTEM", r.rows[0]!.subject, r.rows[0]!.body)).toMatchObject({
      code: "AGENT_WEEKLY_SUMMARY",
      params: { from: LUNEDI, to: "2001-01-07", confirmed: 3, denied: 1, autonomous: 0 },
    });
    // letto o no, rieseguire non lo ripete
    await pool.query(
      `UPDATE sys.sys_inbox_notifications SET notification_status = 'READ'
        WHERE notification_user_id = $1 AND notification_action_url = $2`,
      [piattaforma.userId, `/admin/agent-weekly-summary?week=${LUNEDI}`],
    );
    expect((await runWeeklySummaryCli(LUNEDI)).sent).toBe(0);
  });
});
