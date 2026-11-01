/**
 * apps/api/test/delegations-chain.integration.test.ts — ADR-0051, le attività delegate lungo la catena.
 *
 * Il principio di Enzo (2026-10-31): un capo, anche un referente che non dirige un'unità, delega
 * una sua attività a una persona della sua catena, mai oltre ciò che lui stesso può fare. Qui si
 * prova che:
 *  - la catena ha due fonti (unità e riporti fra posizioni) e la seconda NON allarga il perimetro
 *    dei dati sensibili;
 *  - fuori catena non si delega, né da sé né per mano di un amministratore;
 *  - il delegato decide i passi del delegante, firmato «per conto di», solo sui tipi delegabili;
 *  - se l'organigramma cambia, la delega resta registrata ma smette di avere effetto.
 *
 * Gli attori si derivano dall'organigramma vivo (helpers/org-actors.ts); le scene si scrivono
 * dentro la transazione del file, che le annulla a fine suite.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { loginRaw } from "./helpers/login.js";
import {
  unCapoConSottoposti, unSottopostoOrganizzativo, unEstraneoOrganizzativo, type Attore,
} from "./helpers/org-actors.js";
import { delegationChainUserIds, orgSubtreeUserIds, ownUnitIds } from "../src/lib/scope/org.js";

const AMMINISTRA = "federica.marchetti@rtl-bank.org";

let t: TestApp;
let capo: Attore;
let sotto: Attore;
let estraneo: Attore;
const sessioni = new Map<string, { cookie: string; csrf: string }>();

const oggi = () => new Date().toISOString().slice(0, 10);
const fra = (giorni: number) => {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
};

async function sessione(email: string) {
  const s = sessioni.get(email);
  if (s) return s;
  const login = await loginRaw(t.app, email);
  const cookie = (login.cookies as { name: string; value: string }[]).map((c) => `${c.name}=${c.value}`).join("; ");
  const csrf = (login.json() as { csrfToken: string }).csrfToken;
  const nuova = { cookie, csrf };
  sessioni.set(email, nuova);
  return nuova;
}

async function chiama(email: string, method: "GET" | "POST", url: string, payload?: Record<string, unknown>) {
  const s = await sessione(email);
  return t.app.inject({
    method,
    url,
    headers: { cookie: s.cookie, ...(method === "POST" ? { "x-csrf-token": s.csrf } : {}) },
    ...(payload ? { payload } : {}),
  });
}

/** Una richiesta di approvazione con il capo come approvatore, creata dall'amministratore. */
async function richiestaPerIlCapo(resourceType: string, title: string) {
  const r = await chiama(AMMINISTRA, "POST", "/v1/approvals", {
    title, resourceType, approverUserIds: [capo.userId],
  });
  expect(r.statusCode, `richiesta ${resourceType}: ${r.statusCode} ${r.body.slice(0, 300)}`).toBe(200);
  const req = r.json() as { approvalRequestId: string };
  const passo = await pool.query<{ id: string }>(
    `SELECT approval_step_id AS id FROM sys.sys_approval_steps WHERE approval_step_request_id = $1`,
    [req.approvalRequestId],
  );
  return { requestId: req.approvalRequestId, stepId: passo.rows[0]!.id };
}

beforeAll(async () => {
  t = await buildTestApp();
  capo = await unCapoConSottoposti(pool);
  sotto = await unSottopostoOrganizzativo(pool, capo.userId);
  estraneo = await unEstraneoOrganizzativo(pool, capo.userId);
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("ADR-0051 §1 — la catena di delega", () => {
  it("contiene i sottoposti del capo, non il capo, non un estraneo", async () => {
    const catena = await delegationChainUserIds(pool, capo.userId);
    expect(catena).toContain(sotto.userId);
    expect(catena, "il capo è nella propria catena: si delegherebbe a se stesso").not.toContain(capo.userId);
    expect(catena, "un estraneo all'albero delle unità è nella catena").not.toContain(estraneo.userId);
  });

  it("un referente senza unità ha nella catena chi riporta alla sua posizione, e NON ne vede i dati sensibili", async () => {
    // La scena: la posizione dell'estraneo riporta alla posizione del sottoposto, che non dirige
    // alcuna unità. Il sottoposto diventa referente dell'estraneo per la DELEGA soltanto.
    const pos = await pool.query<{ r: string; s: string }>(
      `SELECT (SELECT user_position_assignment_position_id FROM sys.sys_user_position_assignments
                WHERE user_position_assignment_user_id = $1 AND user_position_assignment_status = 'ACTIVE' LIMIT 1) AS r,
              (SELECT user_position_assignment_position_id FROM sys.sys_user_position_assignments
                WHERE user_position_assignment_user_id = $2 AND user_position_assignment_status = 'ACTIVE' LIMIT 1) AS s`,
      [sotto.userId, estraneo.userId],
    );
    const { r, s } = pos.rows[0]!;
    expect(r && s, "servono le posizioni attive di entrambi").toBeTruthy();

    const prima = await delegationChainUserIds(pool, sotto.userId);
    expect(prima, "la scena parte già con l'estraneo nella catena: non misurerebbe niente").not.toContain(estraneo.userId);

    const riportoPrima = await pool.query<{ p: string | null }>(
      `SELECT position_reports_to_position_id AS p FROM sys.sys_positions WHERE position_id = $1`, [s],
    );
    await pool.query(`UPDATE sys.sys_positions SET position_reports_to_position_id = $1 WHERE position_id = $2`, [r, s]);
    try {
      expect(await delegationChainUserIds(pool, sotto.userId), "il riporto fra posizioni non entra nella catena")
        .toContain(estraneo.userId);
      expect(await orgSubtreeUserIds(pool, sotto.userId), "il riporto fra posizioni ha allargato il perimetro dei dati sensibili")
        .not.toContain(estraneo.userId);

      // E il referente delega davvero, da sé.
      const d = await chiama(sotto.email, "POST", "/v1/me/delegations", {
        delegateUserId: estraneo.userId, scope: "APPROVALS", startsOn: oggi(), endsOn: fra(7),
      });
      expect(d.statusCode, `delega del referente: ${d.statusCode} ${d.body.slice(0, 300)}`).toBe(201);
      const creata = d.json() as { delegationId: string; inChain: boolean };
      expect(creata.inChain).toBe(true);
      // Revocata subito: le scene dopo questa vogliono un estraneo senza deleghe.
      await chiama(sotto.email, "POST", `/v1/me/delegations/${creata.delegationId}/revoke`, {});
    } finally {
      // La scena si smonta comunque: le prove che seguono vogliono l'estraneo FUORI dalla catena.
      await pool.query(`UPDATE sys.sys_positions SET position_reports_to_position_id = $1 WHERE position_id = $2`,
        [riportoPrima.rows[0]?.p ?? null, s]);
    }
  });
});

describe("ADR-0051 §2-§4 — chi delega, a chi, che cosa", () => {
  it("il capo delega da sé a un sottoposto, senza alcun permesso amministrativo", async () => {
    const r = await chiama(capo.email, "POST", "/v1/me/delegations", {
      delegateUserId: sotto.userId, scope: "APPROVALS", requestType: "TIME_OFF_REQUEST",
      startsOn: oggi(), endsOn: fra(14), reason: "ferie del capo",
    });
    expect(r.statusCode, `${r.statusCode} ${r.body.slice(0, 300)}`).toBe(201);
    const d = r.json() as { kind: string; inChain: boolean; delegatorUserId: string; requestType: string };
    expect(d.kind).toBe("CHAIN");
    expect(d.inChain).toBe(true);
    expect(d.delegatorUserId, "il delegante non è chi chiama").toBe(capo.userId);
    expect(d.requestType).toBe("TIME_OFF_REQUEST");
  });

  it("fuori catena si rifiuta, da sé", async () => {
    const r = await chiama(capo.email, "POST", "/v1/me/delegations", {
      delegateUserId: estraneo.userId, startsOn: oggi(),
    });
    expect(r.statusCode, "una delega a un estraneo è passata").toBe(422);
    expect((r.json() as { error: { code: string } }).error.code).toBe("DELEGATION_OUT_OF_CHAIN");
  });

  it("fuori catena si rifiuta anche per mano dell'amministratore: cambia chi crea, non a chi va", async () => {
    const r = await chiama(AMMINISTRA, "POST", "/v1/delegations", {
      delegatorUserId: capo.userId, delegateUserId: estraneo.userId, scope: "APPROVALS", startsOn: oggi(),
    });
    expect(r.statusCode).toBe(422);
    expect((r.json() as { error: { code: string } }).error.code).toBe("DELEGATION_OUT_OF_CHAIN");
  });

  it("un tipo di richiesta escluso non si può nominare, e chi non ha catena non ha candidati", async () => {
    const r = await chiama(capo.email, "POST", "/v1/me/delegations", {
      delegateUserId: sotto.userId, requestType: "COMPENSATION_RECOMMENDATION", startsOn: oggi(),
    });
    expect(r.statusCode, "gli adeguamenti retributivi sono delegabili lungo la catena").toBe(400);

    const c = await chiama(capo.email, "GET", "/v1/me/delegations/candidates");
    expect(c.statusCode).toBe(200);
    const ids = (c.json() as { items: { userId: string }[] }).items.map((x) => x.userId);
    expect(ids).toContain(sotto.userId);
    expect(ids).not.toContain(estraneo.userId);
  });

  it("un'attività di processo si delega solo se è del delegante", async () => {
    const mie = await ownUnitIds(pool, capo.userId);
    if (mie.length === 0) throw new Error("il capo non ha unità proprie: verifica cieca");
    // La scena si scrive qui: un processo e un'attività eseguita da un'unità che NON è del capo.
    // Le attività di processo si caricano fuori catena (ADR-0049) e la copia della CI può non averle.
    const scena = await pool.query<{ id: string }>(
      `WITH t AS (SELECT user_tenant_id AS tid FROM sys.sys_users WHERE user_id = $1),
            altra AS (SELECT o.organization_unit_id AS uid FROM sys.sys_organization_units o, t
                       WHERE o.organization_unit_tenant_id = t.tid AND o.organization_unit_is_active
                         AND NOT (o.organization_unit_id = ANY($2::uuid[])) LIMIT 1),
            pr AS (INSERT INTO sys.sys_tenant_processes (tenant_process_tenant_id, tenant_process_code, tenant_process_name)
                   SELECT tid, 'PROVA-ADR-0051', 'Processo di prova ADR-0051' FROM t
                   RETURNING tenant_process_id, tenant_process_tenant_id)
       INSERT INTO sys.sys_tenant_process_steps
         (tenant_process_step_tenant_id, tenant_process_step_process_id, tenant_process_step_code,
          tenant_process_step_name, tenant_process_step_ordinal, tenant_process_step_org_unit_id)
       SELECT pr.tenant_process_tenant_id, pr.tenant_process_id, 'PROVA-1', 'Attività di prova ADR-0051', 1, altra.uid
         FROM pr, altra
       RETURNING tenant_process_step_id AS id`,
      [capo.userId, mie],
    );
    const passo = scena.rows[0]?.id;
    if (!passo) throw new Error("nessuna unità fuori da quelle del capo: verifica cieca");

    const no = await chiama(capo.email, "POST", "/v1/me/delegations", {
      delegateUserId: sotto.userId, scope: "PROCESS_STEP", tenantProcessStepId: passo, startsOn: oggi(),
    });
    expect(no.statusCode).toBe(422);
    expect((no.json() as { error: { code: string } }).error.code).toBe("DELEGATION_NOT_OWN_ACTIVITY");

    // La stessa attività, assegnata (nella transazione) a un'unità del capo, diventa sua.
    await pool.query(
      `UPDATE sys.sys_tenant_process_steps SET tenant_process_step_org_unit_id = $1 WHERE tenant_process_step_id = $2`,
      [mie[0], passo],
    );
    const si = await chiama(capo.email, "POST", "/v1/me/delegations", {
      delegateUserId: sotto.userId, scope: "PROCESS_STEP", tenantProcessStepId: passo, startsOn: oggi(),
    });
    expect(si.statusCode, `${si.statusCode} ${si.body.slice(0, 300)}`).toBe(201);
    expect((si.json() as { tenantProcessStepId: string }).tenantProcessStepId).toBe(passo);
  });

  it("solo il delegante revoca una sua delega dall'area personale", async () => {
    const r = await chiama(capo.email, "POST", "/v1/me/delegations", {
      delegateUserId: sotto.userId, startsOn: fra(40), endsOn: fra(45),
    });
    const id = (r.json() as { delegationId: string }).delegationId;
    const altrui = await chiama(sotto.email, "POST", `/v1/me/delegations/${id}/revoke`, {});
    expect(altrui.statusCode, "il delegato ha revocato una delega che non ha conferito").toBe(404);
    const sua = await chiama(capo.email, "POST", `/v1/me/delegations/${id}/revoke`, { reason: "fine prova" });
    expect(sua.statusCode).toBe(200);
    expect((sua.json() as { status: string }).status).toBe("REVOKED");
    const avviso = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_inbox_notifications
        WHERE notification_user_id = $1 AND notification_subject LIKE '%ha revocato la delega%'`,
      [sotto.userId],
    );
    expect(Number(avviso.rows[0]?.n), "il delegato non ha saputo della revoca").toBeGreaterThan(0);
  });
});

describe("ADR-0051 §3 e §5 — decidere per conto di", () => {
  it("il delegato vede e decide il passo del capo, e la firma dice per conto di chi", async () => {
    const { requestId, stepId } = await richiestaPerIlCapo("TIME_OFF_REQUEST", "Ferie di prova ADR-0051");

    const casella = await chiama(sotto.email, "GET", "/v1/me/delegations/approvals");
    expect(casella.statusCode).toBe(200);
    const voce = (casella.json() as { items: { approvalStepId: string; delegatorUserId: string; delegationId: string }[] })
      .items.find((i) => i.approvalStepId === stepId);
    expect(voce, "il passo del capo non è nella casella del delegato").toBeTruthy();
    expect(voce!.delegatorUserId).toBe(capo.userId);

    const r = await chiama(sotto.email, "POST", `/v1/me/delegations/approvals/${requestId}/steps/${stepId}/decide`, {
      decision: "APPROVE", comment: "approvato per conto del capo",
    });
    expect(r.statusCode, `${r.statusCode} ${r.body.slice(0, 300)}`).toBe(200);
    const passo = r.json() as { approverUserId: string; decidedBy: string; actingDelegationId: string; status: string };
    expect(passo.status).toBe("APPROVED");
    expect(passo.approverUserId, "il passo ha cambiato titolare").toBe(capo.userId);
    expect(passo.decidedBy, "la decisione non è firmata dal delegato").toBe(sotto.userId);
    expect(passo.actingDelegationId, "manca il titolo della decisione").toBe(voce!.delegationId);
  });

  it("un tipo fuori delega non compare e non si decide", async () => {
    const { requestId, stepId } = await richiestaPerIlCapo("COMPENSATION_RECOMMENDATION", "Adeguamento di prova ADR-0051");
    const casella = await chiama(sotto.email, "GET", "/v1/me/delegations/approvals");
    const ids = (casella.json() as { items: { approvalStepId: string }[] }).items.map((i) => i.approvalStepId);
    expect(ids, "un adeguamento retributivo è arrivato al delegato").not.toContain(stepId);

    const r = await chiama(sotto.email, "POST", `/v1/me/delegations/approvals/${requestId}/steps/${stepId}/decide`, {
      decision: "APPROVE",
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("DELEGATION_TYPE_EXCLUDED");
  });

  it("chi non ha delega non decide il passo del capo", async () => {
    const { requestId, stepId } = await richiestaPerIlCapo("TIME_OFF_REQUEST", "Ferie di prova ADR-0051, estraneo");
    const r = await chiama(estraneo.email, "POST", `/v1/me/delegations/approvals/${requestId}/steps/${stepId}/decide`, {
      decision: "APPROVE",
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("DELEGATION_NOT_IN_FORCE");
  });

  it("§3 — il delegato non decide per conto del capo una richiesta che lo riguarda", async () => {
    const { requestId, stepId } = await richiestaPerIlCapo("TIME_OFF_REQUEST", "Ferie di prova ADR-0051, del delegato");
    // La richiesta diventa del delegato: è lui ad averla presentata.
    await pool.query(`UPDATE sys.sys_approval_requests SET created_by = $1 WHERE approval_request_id = $2`,
      [sotto.userId, requestId]);
    const casella = await chiama(sotto.email, "GET", "/v1/me/delegations/approvals");
    const ids = (casella.json() as { items: { approvalStepId: string }[] }).items.map((i) => i.approvalStepId);
    expect(ids, "la richiesta del delegato è arrivata nella sua casella per conto del capo").not.toContain(stepId);

    const r = await chiama(sotto.email, "POST", `/v1/me/delegations/approvals/${requestId}/steps/${stepId}/decide`, {
      decision: "APPROVE",
    });
    expect(r.statusCode, `il delegato si è approvato da sé: ${r.statusCode} ${r.body.slice(0, 300)}`).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("DELEGATION_OWN_REQUEST");
  });

  it("§2 — se il delegato esce dalla catena la delega resta, ma smette di avere effetto", async () => {
    const { requestId, stepId } = await richiestaPerIlCapo("TIME_OFF_REQUEST", "Ferie di prova ADR-0051, catena cambiata");
    await pool.query(
      `UPDATE sys.sys_user_position_assignments
          SET user_position_assignment_status = 'ENDED',
              user_position_assignment_end_date = greatest(current_date, user_position_assignment_start_date)
        WHERE user_position_assignment_user_id = $1 AND user_position_assignment_status = 'ACTIVE'`,
      [sotto.userId],
    );
    const r = await chiama(sotto.email, "POST", `/v1/me/delegations/approvals/${requestId}/steps/${stepId}/decide`, {
      decision: "APPROVE",
    });
    expect(r.statusCode, `${r.statusCode} ${r.body.slice(0, 300)}`).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("DELEGATION_OUT_OF_CHAIN");

    const mie = await chiama(capo.email, "GET", "/v1/me/delegations");
    const concesse = (mie.json() as { granted: { delegateUserId: string; status: string; inChain: boolean | null }[] }).granted
      .filter((d) => d.delegateUserId === sotto.userId && d.status === "ACTIVE");
    expect(concesse.length, "la delega è sparita invece di restare registrata").toBeGreaterThan(0);
    expect(concesse.every((d) => d.inChain === false), "la delega risulta ancora in catena").toBe(true);
  });
});
