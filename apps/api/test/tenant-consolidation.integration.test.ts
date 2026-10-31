/**
 * apps/api/test/tenant-consolidation.integration.test.ts — AC-9.
 *
 * Il registro del consolidamento (mig 000464) e chi decide (mig 000465), provati sul servizio con
 * attori presi dal dato: un Direttore HR del tenant, un suo delegato limitato a un gruppo, una
 * persona senza mandato. Le proposte si scrivono a mano nel registro: il giudice e i giri hanno
 * le loro prove (`agent-gateway`, `tenant-consolidation-engine.unit`), qui conta chi può fare
 * che cosa. L'isolamento transazionale del file annulla tutto a fine suite.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, pool } from "../src/db/client.js";
import { loadRolePermissionCache } from "../src/modules/auth/cache-loader.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";
import { eseguiGiri, tenantConsolidationService as svc } from "../src/modules/tenant-consolidation/service.js";
import { activeVariantVersion } from "../src/modules/tenant-consolidation/repository.js";
import type { Giudice } from "../src/modules/tenant-consolidation/engine.js";

let direttore: ActorContext;
let delegato: ActorContext;
let estraneo: ActorContext;
let sessioneId = "";
const proposte: Record<string, string> = {};

async function ruoliDi(userId: string): Promise<RoleCode[]> {
  const r = await pool.query<{ code: string }>(
    `SELECT ro.auth_role_code AS code FROM sys.sys_user_auth_roles ur
       JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
      WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_revoked_at IS NULL`,
    [userId],
  );
  return r.rows.map((x) => x.code) as RoleCode[];
}

/** Il codice dell'errore del dominio, o null se la promessa riesce. */
async function codiceDi(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
}

async function proposta(group: string, outcome: string, confidence: number, pk: string[], tk: string[]): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_tenant_consolidation_proposals
       (tenant_consolidation_proposal_consolidation_id, tenant_consolidation_proposal_group,
        tenant_consolidation_proposal_prototype_keys, tenant_consolidation_proposal_tenant_keys,
        tenant_consolidation_proposal_outcome, tenant_consolidation_proposal_method,
        tenant_consolidation_proposal_confidence, tenant_consolidation_proposal_reason,
        tenant_consolidation_proposal_round)
     VALUES ($1, $2, $3::text[], $4::text[], $5, 'SEMANTICA', $6, 'prova', 1)
     RETURNING tenant_consolidation_proposal_id AS id`,
    [sessioneId, group, pk, tk, outcome, confidence],
  );
  return r.rows[0]!.id;
}

beforeAll(async () => {
  await loadRolePermissionCache();
  // Un Direttore HR: chi ha `consolidation:decide` per ruolo (000465), letto dal permesso.
  const d = await pool.query<{ user_id: string; user_tenant_id: string }>(
    `SELECT u.user_id, u.user_tenant_id FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE p.auth_permission_code = 'consolidation:decide' AND u.user_status = 'ACTIVE' AND u.user_tenant_id IS NOT NULL
        -- la 000005 dà ogni permesso al ruolo di piattaforma: il Direttore è chi lo ha da un ruolo di tenant
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur2 JOIN sys.sys_auth_roles r2 ON r2.auth_role_id = ur2.user_auth_role_role_id
                         WHERE ur2.user_auth_role_user_id = u.user_id AND ur2.user_auth_role_revoked_at IS NULL AND r2.auth_role_is_platform)
      ORDER BY u.user_id LIMIT 1`,
  );
  const dir = d.rows[0];
  if (!dir) throw new Error("nessun utente con consolidation:decide: la 000465 non è applicata?");
  direttore = { userId: dir.user_id, tenantId: dir.user_tenant_id, roles: await ruoliDi(dir.user_id) };

  // Due persone dello stesso tenant senza nessun permesso di consolidamento.
  const altri = await pool.query<{ user_id: string }>(
    `SELECT u.user_id FROM sys.sys_users u
      WHERE u.user_tenant_id = $1 AND u.user_status = 'ACTIVE' AND u.user_id <> $2
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles ur
            JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = ur.user_auth_role_role_id
            JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
           WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
             AND p.auth_permission_code LIKE 'consolidation:%')
      ORDER BY u.user_id LIMIT 2`,
    [direttore.tenantId, direttore.userId],
  );
  expect(altri.rows.length).toBe(2);
  delegato = { userId: altri.rows[0]!.user_id, tenantId: direttore.tenantId, roles: await ruoliDi(altri.rows[0]!.user_id) };
  estraneo = { userId: altri.rows[1]!.user_id, tenantId: direttore.tenantId, roles: await ruoliDi(altri.rows[1]!.user_id) };

  await pool.query(
    `INSERT INTO sys.sys_user_delegations
       (user_delegation_tenant_id, user_delegation_delegator_id, user_delegation_delegate_id,
        user_delegation_scope, user_delegation_groups, user_delegation_starts_on, user_delegation_reason)
     VALUES ($1, $2, $3, 'CONSOLIDATION', ARRAY['SKILLS'], current_date, 'prova AC-9')`,
    [direttore.tenantId, direttore.userId, delegato.userId],
  );
});

afterAll(async () => {
  await closePool();
});

describe("chi decide il consolidamento (000465)", () => {
  it("il Direttore decide su tutti i gruppi, il delegato sui suoi, l'estraneo su nessuno", async () => {
    expect(await svc.access(direttore)).toMatchObject({ decidesAs: "DIRETTORE", groups: expect.arrayContaining(["ORGANIZATION", "SKILLS"]) });
    expect(await svc.access(delegato)).toMatchObject({ decidesAs: "DELEGATO", groups: ["SKILLS"], canRun: false });
    expect(await svc.access(estraneo)).toMatchObject({ decidesAs: null, groups: [] });
    expect(await codiceDi(svc.list(estraneo))).toBe("PERMISSION_DENIED");
  });

  it("il CHECK respinge una delega CONSOLIDATION senza gruppi e una APPROVALS con gruppi", async () => {
    for (const [scope, groups] of [["CONSOLIDATION", null], ["CONSOLIDATION", "{}"], ["APPROVALS", "{SKILLS}"]] as const) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const err = await c.query(
          `INSERT INTO sys.sys_user_delegations
             (user_delegation_tenant_id, user_delegation_delegator_id, user_delegation_delegate_id,
              user_delegation_scope, user_delegation_groups, user_delegation_starts_on)
           VALUES ($1, $2, $3, $4, $5::text[], current_date)`,
          [direttore.tenantId, direttore.userId, estraneo.userId, scope, groups],
        ).then(() => null, (e: { constraint?: string }) => e.constraint ?? "altro");
        await c.query("ROLLBACK");
        expect(err, `${scope} con gruppi ${groups}`).toBe("sys_user_delegations_groups_ck");
      } finally {
        c.release();
      }
    }
  });
});

describe("il registro del consolidamento (000464)", () => {
  it("si apre una sessione sola per tenant", async () => {
    const vv = await pool.query<{ id: string }>(
      `SELECT blueprint_variant_version_id AS id FROM sys.sys_blueprint_variant_versions ORDER BY 1 LIMIT 1`,
    );
    const body = { variantVersionId: vv.rows[0]!.id, trigger: "RICHIESTA" as const };
    const s = await svc.start(direttore, body);
    expect(s).toMatchObject({ status: "GIRI", openGroup: "ORGANIZATION", tenantId: direttore.tenantId, runningGroup: null, lastRun: null });
    sessioneId = s.consolidationId;
    expect(await codiceDi(svc.start(direttore, body))).toBe("CONSOLIDATION_ALREADY_OPEN");

    proposte.orgCerta = await proposta("ORGANIZATION", "CORRISPONDENZA", 95, ["ORG-1"], ["u-1"]);
    proposte.skillDubbia = await proposta("SKILLS", "CORRISPONDENZA", 60, ["SK-1"], ["s-1"]);
    proposte.skillLacuna = await proposta("SKILLS", "LACUNA", 80, ["SK-2"], []);
  });

  it("la conferma a gruppi prende solo le corrispondenze certe", async () => {
    const r = await svc.confirmCertain(direttore, [proposte.orgCerta!, proposte.skillDubbia!]);
    expect(r).toEqual({ confirmed: 1, skipped: [proposte.skillDubbia] });
  });

  it("una lacuna non si conferma: si adotta o no", async () => {
    expect(await codiceDi(svc.decide(direttore, proposte.skillLacuna!, { decision: "CONFERMATA" })))
      .toBe("CONSOLIDATION_DECISION_INVALID");
    expect(await codiceDi(svc.decide(direttore, proposte.skillLacuna!, { decision: "ADOTTATA", form: "NORMALIZZATA" })))
      .toBe("CONSOLIDATION_FORM_INVALID");
  });

  it("il delegato decide solo nel suo gruppo e non rivede le decisioni prese", async () => {
    const adottata = await svc.decide(delegato, proposte.skillLacuna!, { decision: "ADOTTATA" });
    expect(adottata.decision).toBe("ADOTTATA");
    expect(await codiceDi(svc.decide(delegato, proposte.orgCerta!, { decision: "RIFIUTATA" }))).toBe("PERMISSION_DENIED");
    expect(await codiceDi(svc.decide(delegato, proposte.skillLacuna!, { decision: "NON_ADOTTATA" }))).toBe("PERMISSION_DENIED");

    const viste = await svc.proposals(delegato, sessioneId, undefined);
    expect(new Set(viste.map((p) => p.group))).toEqual(new Set(["SKILLS"]));
    expect(await codiceDi(svc.proposals(delegato, sessioneId, "ORGANIZATION"))).toBe("PERMISSION_DENIED");

    const d = await pool.query<{ delegation_id: string | null }>(
      `SELECT tenant_consolidation_decision_delegation_id AS delegation_id FROM sys.sys_tenant_consolidation_decisions
        WHERE tenant_consolidation_decision_proposal_id = $1`,
      [proposte.skillLacuna],
    );
    expect(d.rows[0]?.delegation_id).toBeTruthy();
  });

  it("il Direttore rivede: la decisione nuova sostituisce la vecchia, che resta", async () => {
    const rivista = await svc.decide(direttore, proposte.skillLacuna!, { decision: "NON_ADOTTATA", reason: "non serve" });
    expect(rivista.decision).toBe("NON_ADOTTATA");
    const n = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_tenant_consolidation_decisions WHERE tenant_consolidation_decision_proposal_id = $1`,
      [proposte.skillLacuna],
    );
    expect(n.rows[0]!.n).toBe(2);

    const avanzamento = await svc.progress(direttore, sessioneId);
    expect(avanzamento.find((g) => g.group === "ORGANIZATION")).toMatchObject({ linked: 1, pending: 0 });
    expect(avanzamento.find((g) => g.group === "SKILLS")).toMatchObject({ rejected: 1, pending: 1 });
  });
});

describe("un giro sul gruppo aperto, con un giudice finto", () => {
  it("legge le voci vere, non manda persone al giudice e scrive il registro", async () => {
    const s = await svc.get(direttore, sessioneId);
    const lotti: unknown[] = [];
    // Il giudice di prova non abbina niente: tutto ciò che il giro zero non chiude resta lacuna o personalizzazione.
    const giudice: Giudice = async (lotto) => {
      lotti.push(lotto);
      return lotto.questions.map((d) => ({ tenantKey: d.tenantItem.key, prototypeKeys: [], confidence: 10, reason: "prova" }));
    };
    await eseguiGiri(direttore.tenantId!, s, "ORGANIZATION", giudice);
    const dopo = await pool.query<{ m: { last_run?: { ok: boolean; error?: string } } }>(
      `SELECT tenant_consolidation_metadata AS m FROM sys.sys_tenant_consolidations WHERE tenant_consolidation_id = $1`,
      [sessioneId],
    );
    expect(dopo.rows[0]!.m.last_run, JSON.stringify(dopo.rows[0]!.m)).toMatchObject({ ok: true });
    expect(JSON.stringify(lotti)).not.toMatch(/userid/i);
    // La pagina legge l'esito dalla sessione: nessun giro in corso, l'ultimo andato bene.
    expect(await svc.get(direttore, sessioneId)).toMatchObject({ runningGroup: null, lastRun: { group: "ORGANIZATION", ok: true } });

    const unita = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1 AND organization_unit_is_active`,
      [direttore.tenantId],
    );
    const registro = await svc.proposals(direttore, sessioneId, "ORGANIZATION");
    const coperte = new Set(registro.flatMap((p) => p.tenantKeys));
    // Ogni unità attiva del tenant esce dal giro con una proposta: collegata o sua.
    expect(coperte.size).toBeGreaterThanOrEqual(unita.rows[0]!.n);
    // Chi decide legge nomi: ogni voce nata dal giro porta il nome della sua parte.
    const dalGiro = registro.filter((p) => p.proposalId !== proposte.orgCerta);
    expect(dalGiro.length).toBeGreaterThan(0);
    const senzaNome = dalGiro.flatMap((p) => [...p.tenantItems, ...p.prototypeItems]).filter((v) => v.name === null);
    expect(senzaNome, JSON.stringify(senzaNome.slice(0, 5))).toEqual([]);
  });
});

describe("la versione del prototipo, quando la sessione non la indica", () => {
  it("è quella dell'attivazione ACTIVE del tenant", async () => {
    const attesa = await pool.query<{ id: string | null }>(
      `SELECT blueprint_activation_variant_version_id AS id FROM sys.sys_blueprint_activations
        WHERE blueprint_activation_tenant_id = $1 AND blueprint_activation_status = 'ACTIVE'
          AND blueprint_activation_variant_version_id IS NOT NULL
        ORDER BY blueprint_activation_effective_from DESC LIMIT 1`,
      [direttore.tenantId],
    );
    expect(await activeVariantVersion(pool, direttore.tenantId!)).toBe(attesa.rows[0]?.id ?? null);
    // Un tenant inesistente non ha versione: la sessione non si apre su un prototipo indovinato.
    expect(await activeVariantVersion(pool, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
