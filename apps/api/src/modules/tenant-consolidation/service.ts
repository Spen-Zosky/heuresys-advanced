/**
 * apps/api/src/modules/tenant-consolidation/service.ts — AC-9.
 *
 * Chi decide (disegno §7): il Direttore HR del tenant (`HRMS_MANAGER`, permesso
 * `consolidation:decide`) su tutti i gruppi; un suo delegato solo sui gruppi della delega
 * `CONSOLIDATION` (mig 000465), e solo finché il delegante è ancora Direttore. Il tenant viene
 * sempre dalla sessione autenticata (I5).
 *
 * Una decisione non si modifica: se ne registra una nuova che sostituisce la precedente, e solo
 * il Direttore può rivedere ciò che è già stato deciso (specifica §6). Qui si registra la
 * decisione; l'applicazione ai dati del tenant è AC-8 e passa dalle strade che già esistono.
 */
import { pool, withTransaction } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { userHasPermission } from "../../middleware/rbac.js";
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnprocessableEntityError,
} from "../../errors/index.js";
import {
  ALLOWED_DECISIONS,
  CONSOLIDATION_CERTAIN_THRESHOLD,
  CONSOLIDATION_GROUP_VALUES,
  nextConsolidationGroup,
  type ApplyChangesResult,
  type ApprovalPreview,
  type CascadeResponse,
  type PendingApproval,
  type AvailableDeliveryList,
  type BlueprintRun,
  type ReceiveDeliveryBody,
  type ConsolidationAccess,
  type ConsolidationGroup,
  type ConsolidationProposal,
  type Decision,
  type DecideProposalBody,
  type GroupProgress,
  type LinkForm,
  type StartConsolidationBody,
  type TenantConsolidation,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { consolidaGruppo, nuovoStato, type Giudice } from "./engine.js";
import { giudiceDaAmbiente } from "./giudice.js";
import { applicaDecisione } from "./applicazione.js";
import { vociDelPrototipo, vociDelTenant } from "./sorgenti.js";
import { accese, contaSentinelle } from "./approvazione.js";
import { CAMPI_IN_CASCATA, cascataDi, sceltaInCascata } from "./cascata.js";
import {
  accogliConsegna,
  consegneDisponibili,
  corsa,
  elencoCorse,
  rendiDefinitiva,
  risultatoIniziale,
  sessioneAperta,
} from "./corse.js";

/** La soglia degli abbinamenti certi, la stessa che la pagina usa (`@heuresys/shared`). */
export const SOGLIA_CERTI = CONSOLIDATION_CERTAIN_THRESHOLD;
const DECISIONI_AMMESSE = ALLOWED_DECISIONS;

function tenantDi(actor: ActorContext): string {
  if (!actor.tenantId) throw new ForbiddenError("Tenant context required", "PERMISSION_DENIED");
  return actor.tenantId;
}

interface Mandato {
  direttore: boolean;
  /** Per ogni gruppo, la delega che lo copre (null per il Direttore). */
  gruppi: Map<ConsolidationGroup, string | null>;
}

async function mandatoDi(actor: ActorContext): Promise<Mandato> {
  const tenantId = tenantDi(actor);
  if (userHasPermission(actor, "consolidation:decide")) {
    return { direttore: true, gruppi: new Map(CONSOLIDATION_GROUP_VALUES.map((g) => [g, null])) };
  }
  const gruppi = new Map<ConsolidationGroup, string | null>();
  for (const d of await repo.activeConsolidationDelegations(pool, tenantId, actor.userId)) {
    for (const g of d.groups) if (!gruppi.has(g)) gruppi.set(g, d.delegationId);
  }
  return { direttore: false, gruppi };
}

/** Lettura: chi ha `consolidation:read` vede tutto; un delegato vede i gruppi della sua delega. */
async function gruppiLeggibili(actor: ActorContext): Promise<ConsolidationGroup[] | null> {
  if (userHasPermission(actor, "consolidation:read")) return null;
  const m = await mandatoDi(actor);
  if (m.gruppi.size === 0) throw new ForbiddenError("Nessun mandato sul consolidamento", "PERMISSION_DENIED");
  return [...m.gruppi.keys()];
}

/** Lo stato ADR-0048 che una decisione dà alla voce (disegno §6). */
function statoAdr48(d: Decision, form: LinkForm | null): "EREDITATA" | "CONSERVATA" | "PROPRIA" | null {
  if (d === "CONFERMATA") return form === "FORMA_TENANT" ? "CONSERVATA" : "EREDITATA";
  if (d === "ADOTTATA") return "EREDITATA";
  if (d === "PERSONALIZZAZIONE") return "PROPRIA";
  return null;
}

async function sessione(tenantId: string, id: string): Promise<TenantConsolidation> {
  const s = await repo.getConsolidation(pool, tenantId, id);
  if (!s) throw new NotFoundError("Sessione di consolidamento non trovata", "CONSOLIDATION_NOT_FOUND");
  return s;
}

/**
 * Le proposte con il nome delle loro voci. Il registro tiene le chiavi (identificativi del
 * tenant, codici del prototipo); i nomi si rileggono dalle stesse sorgenti dei giri, così una
 * voce rinominata nel frattempo si vede col nome di oggi, e una sparita col nome nullo.
 */
async function conNomi(
  tenantId: string,
  s: TenantConsolidation,
  proposte: ConsolidationProposal[],
): Promise<ConsolidationProposal[]> {
  const gruppi = [...new Set(proposte.map((p) => p.group))];
  const nomi = new Map<ConsolidationGroup, { tenant: Map<string, string>; prototipo: Map<string, string> }>();
  await Promise.all(gruppi.map(async (g) => {
    const [t, pr] = await Promise.all([vociDelTenant(pool, tenantId, g), vociDelPrototipo(pool, s.variantVersionId, g)]);
    nomi.set(g, { tenant: new Map(t.map((v) => [v.key, v.name])), prototipo: new Map(pr.map((v) => [v.key, v.name])) });
  }));
  return proposte.map((p) => {
    const n = nomi.get(p.group)!;
    return {
      ...p,
      tenantItems: p.tenantKeys.map((key) => ({ key, name: n.tenant.get(key) ?? null })),
      prototypeItems: p.prototypeKeys.map((key) => ({ key, name: n.prototipo.get(key) ?? null })),
    };
  });
}

/**
 * I giri di un gruppo, dalla lettura delle voci al registro. Esportata perché la prova la
 * aspetti; la rotta la lancia senza aspettarla. Non lancia mai: l'esito, buono o no, finisce
 * nel metadata della sessione e libera il turno.
 */
export async function eseguiGiri(
  tenantId: string,
  s: TenantConsolidation,
  group: ConsolidationGroup,
  giudice: Giudice,
): Promise<void> {
  const id = s.consolidationId;
  const inizio = Date.now();
  try {
    const [tenant, prototipo, rifiuti] = await Promise.all([
      vociDelTenant(pool, tenantId, group),
      vociDelPrototipo(pool, s.variantVersionId, group),
      repo.rejectedPairs(pool, id, group),
    ]);
    const vocabolario = await repo.approvedVocabulary(pool, group);
    const stato = nuovoStato(group, prototipo, tenant);
    stato.rejected.push(...rifiuti);
    await consolidaGruppo(stato, giudice, { vocabulary: vocabolario });
    const scritte = await withTransaction((client) => repo.saveGroup(client, id, stato, null));
    const ms = Date.now() - inizio;
    await repo.releaseRun(pool, id, {
      group, ok: true, proposals: scritte, rounds: stato.rounds.length, fuse: stato.fuseTripped, ms,
    });
    // la misura di partenza della corsa: solo il primo giro del gruppo nella prima sessione la scrive
    const conta = (o: string) => stato.proposals.filter((p) => p.outcome === o).length;
    await risultatoIniziale(pool, id, group, {
      tenantItems: tenant.length,
      prototypeItems: prototipo.length,
      proposals: stato.proposals.length,
      matches: conta("CORRISPONDENZA"),
      certain: stato.proposals.filter((p) => p.outcome === "CORRISPONDENZA" && p.confidence >= SOGLIA_CERTI).length,
      gaps: conta("LACUNA"),
      customizations: conta("PERSONALIZZAZIONE"),
      ms,
      at: new Date().toISOString(),
    }).catch(() => undefined);
  } catch (e) {
    const codice = e instanceof InternalError ? e.code : "CONSOLIDATION_RUN_FAILED";
    await repo.releaseRun(pool, id, { group, ok: false, error: codice, ms: Date.now() - inizio }).catch(() => undefined);
  }
}

/** L'approvazione definitiva, l'anteprima e lo scarto sono del Direttore HR: un delegato decide, non riversa. */
async function soloDirettore(actor: ActorContext): Promise<void> {
  const m = await mandatoDi(actor);
  if (!m.direttore) {
    throw new ForbiddenError("Solo il Direttore HR approva definitivamente le modifiche", "PERMISSION_DENIED");
  }
}

/**
 * Riversa nei dati vivi tutte le decisioni della bozza, in una transazione: misura le sentinelle prima
 * e dopo, e se `conferma` è falso (anteprima) o qualche sentinella si accende, annulla tutto.
 */
async function riversa(
  tenantId: string,
  id: string,
  userId: string | null,
  conferma: boolean,
): Promise<ApprovalPreview> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const s = await repo.getConsolidation(client, tenantId, id, true);
    if (!s) throw new NotFoundError("Sessione di consolidamento non trovata", "CONSOLIDATION_NOT_FOUND");
    if (s.runningGroup) {
      throw new ConflictError("L'agente sta lavorando su questa sessione: si approva quando ha finito", "CONSOLIDATION_RUN_BUSY");
    }
    const prima = await contaSentinelle(client);
    const da = await repo.decisioniDaApplicare(client, tenantId, id);
    const result: ApplyChangesResult = { applied: 0, changed: 0, created: 0, reverted: 0, skipped: [] };
    for (const r of da) {
      const rap = await applicaDecisione(
        client, tenantId, s.variantVersionId,
        { proposalId: r.proposalId, group: r.group, tenantKeys: r.tenantKeys, prototypeKeys: r.prototypeKeys },
        { decisionId: r.decisionId, decision: r.decision, form: r.form, adr48State: r.adr48State },
      );
      result.applied++;
      result.changed += rap.changed.length;
      result.created += rap.created.length;
      result.reverted += rap.reverted;
      result.skipped.push(...rap.skipped);
    }
    const dopo = await contaSentinelle(client);
    const violations = accese(prima, dopo);
    const toRecompute = accese(prima, dopo, true);
    if (conferma && violations.length === 0) {
      if (s.runId && result.applied > 0) {
        await client.query(
          `UPDATE sys.sys_blueprint_runs
              SET blueprint_run_final_results = jsonb_build_object(
                    'approvedAt', now(), 'approvedBy', $2::text, 'consolidationId', $3::text,
                    'applied', $4::int, 'changed', $5::int, 'created', $6::int, 'reverted', $7::int,
                    'previous', CASE WHEN blueprint_run_final_results = '{}'::jsonb THEN NULL ELSE blueprint_run_final_results END)
            WHERE blueprint_run_id = $1`,
          [s.runId, userId, id, result.applied, result.changed, result.created, result.reverted],
        );
      }
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }
    return { result, violations, toRecompute };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export const tenantConsolidationService = {
  async access(actor: ActorContext): Promise<ConsolidationAccess> {
    const m = await mandatoDi(actor);
    return {
      canRun: userHasPermission(actor, "consolidation:run"),
      decidesAs: m.direttore ? "DIRETTORE" : m.gruppi.size > 0 ? "DELEGATO" : null,
      groups: CONSOLIDATION_GROUP_VALUES.filter((g) => m.gruppi.has(g)),
    };
  },

  async list(actor: ActorContext): Promise<TenantConsolidation[]> {
    await gruppiLeggibili(actor);
    return repo.listConsolidations(pool, tenantDi(actor));
  },

  async get(actor: ActorContext, id: string): Promise<TenantConsolidation> {
    await gruppiLeggibili(actor);
    return sessione(tenantDi(actor), id);
  },

  async start(actor: ActorContext, body: StartConsolidationBody): Promise<TenantConsolidation> {
    const tenantId = tenantDi(actor);
    // Una corsa del registro porta il suo modello; senza, la versione indicata; senza, quella attiva
    // per il tenant: è il prototipo che ha davvero.
    let runId: string | null = null;
    let variantVersionId: string | null | undefined = body.variantVersionId;
    if (body.runId) {
      const c = await corsa(pool, tenantId, body.runId);
      if (!c) throw new NotFoundError("Corsa non trovata nel registro", "BLUEPRINT_RUN_NOT_FOUND");
      if (!c.variantVersionId) {
        throw new UnprocessableEntityError(
          { runId: "senza modello" },
          "La versione di modello di questa corsa non c'è più",
          "CONSOLIDATION_VERSION_INVALID",
        );
      }
      runId = c.runId;
      variantVersionId = c.variantVersionId;
    }
    variantVersionId ??= await repo.activeVariantVersion(pool, tenantId);
    if (!variantVersionId) {
      throw new UnprocessableEntityError(
        { variantVersionId: "nessuna attiva" },
        "Il tenant non ha una versione del prototipo attiva",
        "CONSOLIDATION_VERSION_INVALID",
      );
    }
    if (!(await repo.variantVersionExists(pool, variantVersionId))) {
      throw new UnprocessableEntityError(
        { variantVersionId: "inesistente" },
        "La versione del prototipo non esiste",
        "CONSOLIDATION_VERSION_INVALID",
      );
    }
    // Senza corsa indicata, la sessione si lega alla corsa del registro che porta lo stesso modello, se c'è.
    runId ??= (await elencoCorse(pool, tenantId)).find((c) => c.variantVersionId === variantVersionId)?.runId ?? null;
    const versione = variantVersionId;
    const creata = await withTransaction(async (client) => {
      if (body.closeOpen) {
        await client.query(
          `UPDATE sys.sys_tenant_consolidations
              SET tenant_consolidation_status = 'CHIUSA', tenant_consolidation_open_group = NULL,
                  tenant_consolidation_closed_at = now()
            WHERE tenant_consolidation_tenant_id = $1 AND tenant_consolidation_status IN ('GIRI', 'IN_CONFERMA')
              AND tenant_consolidation_metadata->>'running_group' IS NULL`,
          [tenantId],
        );
      }
      const s = await repo.createConsolidation(client, tenantId, {
        variantVersionId: versione,
        trigger: body.trigger,
        userId: actor.userId,
        openGroup: CONSOLIDATION_GROUP_VALUES[0],
        runId,
      });
      if (s && runId) await sessioneAperta(client, runId, s.consolidationId);
      return s;
    });
    if (!creata) {
      throw new ConflictError(
        "Il tenant ha già una sessione di consolidamento aperta",
        "CONSOLIDATION_ALREADY_OPEN",
      );
    }
    return creata;
  },

  async proposals(actor: ActorContext, id: string, group: ConsolidationGroup | undefined): Promise<ConsolidationProposal[]> {
    const tenantId = tenantDi(actor);
    const leggibili = await gruppiLeggibili(actor);
    const s = await sessione(tenantId, id);
    let gruppi: ConsolidationGroup[] | null = leggibili;
    if (group) {
      if (leggibili && !leggibili.includes(group)) {
        throw new ForbiddenError("Il gruppo non è nella tua delega", "PERMISSION_DENIED");
      }
      gruppi = [group];
    }
    return conNomi(tenantId, s, await repo.listProposals(pool, tenantId, id, gruppi));
  },

  async progress(actor: ActorContext, id: string): Promise<GroupProgress[]> {
    const tenantId = tenantDi(actor);
    const leggibili = await gruppiLeggibili(actor);
    await sessione(tenantId, id);
    const tutti = await repo.progress(pool, tenantId, id);
    return leggibili ? tutti.filter((p) => leggibili.includes(p.group)) : tutti;
  },

  async decide(actor: ActorContext, proposalId: string, body: DecideProposalBody): Promise<ConsolidationProposal> {
    const tenantId = tenantDi(actor);
    const m = await mandatoDi(actor);
    const decisa = await withTransaction(async (client) => {
      const [p] = await repo.getProposals(client, tenantId, [proposalId]);
      if (!p) throw new NotFoundError("Proposta non trovata", "CONSOLIDATION_PROPOSAL_NOT_FOUND");
      if (p.status !== "GIRI" && p.status !== "IN_CONFERMA") {
        throw new ConflictError("La sessione non accetta più decisioni", "CONSOLIDATION_CLOSED");
      }
      if (!m.gruppi.has(p.group)) {
        throw new ForbiddenError("Il gruppo non è nella tua delega", "PERMISSION_DENIED");
      }
      // Rivedere una decisione è del Direttore: il delegato decide, non corregge gli altri.
      if (p.decisionId && !m.direttore) {
        throw new ForbiddenError("Solo il Direttore HR rivede una decisione già presa", "PERMISSION_DENIED");
      }
      if (!DECISIONI_AMMESSE[p.outcome].includes(body.decision)) {
        throw new UnprocessableEntityError(
          { decision: `non ammessa per ${p.outcome}` },
          "Questa decisione non vale per questo tipo di proposta",
          "CONSOLIDATION_DECISION_INVALID",
        );
      }
      if (body.form && body.decision !== "CONFERMATA") {
        throw new UnprocessableEntityError(
          { form: "solo per una corrispondenza confermata" },
          "La forma vale solo per una corrispondenza confermata",
          "CONSOLIDATION_FORM_INVALID",
        );
      }
      const form: LinkForm | null = body.decision === "CONFERMATA" ? body.form ?? "NORMALIZZATA" : null;
      await repo.insertDecision(client, tenantId, {
        proposalId,
        decision: body.decision,
        form,
        adr48State: statoAdr48(body.decision, form),
        reason: body.reason ?? null,
        userId: actor.userId,
        delegationId: m.gruppi.get(p.group) ?? null,
        supersedesId: p.decisionId,
      });
      // «Aggiorna cascata»: la stessa scelta sulle proposte legate a questa nel modello e ancora senza decisione.
      if (body.cascade) {
        const s = await repo.getConsolidation(client, tenantId, p.consolidationId);
        for (const c of s ? await cascataDi(client, s.variantVersionId, p) : []) {
          if (c.decision !== null || !m.gruppi.has(c.group)) continue;
          const scelta = sceltaInCascata(body.decision, c.outcome);
          if (!scelta) continue;
          const formaC: LinkForm | null = scelta === "CONFERMATA" ? "NORMALIZZATA" : null;
          await repo.insertDecision(client, tenantId, {
            proposalId: c.proposalId,
            decision: scelta,
            form: formaC,
            adr48State: statoAdr48(scelta, formaC),
            reason: `In cascata dalla decisione sulla proposta ${proposalId}`,
            userId: actor.userId,
            delegationId: m.gruppi.get(c.group) ?? null,
            supersedesId: null,
          });
        }
      }
      // Decidere registra soltanto, nella bozza: i dati cambiano con «Approva definitivamente le modifiche».
      const [dopo] = await repo.getProposals(client, tenantId, [proposalId]);
      const { decisionId: _d, status: _s, ...proposta } = dopo!;
      return proposta;
    });
    const [conNome] = await conNomi(tenantId, await sessione(tenantId, decisa.consolidationId), [decisa]);
    return conNome!;
  },

  /**
   * La conferma a gruppi (R-5): un gesto conferma, nella forma normalizzata, le corrispondenze
   * certe ancora senza decisione. Ciò che non lo è (fiducia sotto la soglia, già deciso, un
   * gruppo fuori delega) si salta e si dice quale: non si conferma niente «per vicinanza».
   */
  async confirmCertain(actor: ActorContext, ids: readonly string[]): Promise<{ confirmed: number; skipped: string[] }> {
    const tenantId = tenantDi(actor);
    const m = await mandatoDi(actor);
    return withTransaction(async (client) => {
      const proposte = await repo.getProposals(client, tenantId, ids);
      const trovate = new Set(proposte.map((p) => p.proposalId));
      const skipped = ids.filter((id) => !trovate.has(id));
      let confirmed = 0;
      for (const p of proposte) {
        const certa = p.outcome === "CORRISPONDENZA" && p.confidence >= SOGLIA_CERTI && !p.decisionId;
        const aperta = p.status === "GIRI" || p.status === "IN_CONFERMA";
        if (!certa || !aperta || !m.gruppi.has(p.group)) {
          skipped.push(p.proposalId);
          continue;
        }
        await repo.insertDecision(client, tenantId, {
          proposalId: p.proposalId,
          decision: "CONFERMATA",
          form: "NORMALIZZATA",
          adr48State: "EREDITATA",
          reason: null,
          userId: actor.userId,
          delegationId: m.gruppi.get(p.group) ?? null,
          supersedesId: null,
        });
        confirmed++;
      }
      return { confirmed, skipped };
    });
  },

  /** Quante decisioni aspettano di essere applicate ai dati (registrate, non ancora eseguite). */
  async pendingChanges(actor: ActorContext, id: string): Promise<{ pending: number }> {
    const tenantId = tenantDi(actor);
    const m = await mandatoDi(actor);
    await sessione(tenantId, id);
    const righe = await repo.decisioniDaApplicare(pool, tenantId, id);
    return { pending: righe.filter((r) => m.gruppi.has(r.group)).length };
  },

  /**
   * «Esegui modifiche»: applica ai dati, in un ciclo solo e in una sola transazione, tutte le
   * decisioni registrate e non ancora eseguite (o cambiate dopo l'ultima esecuzione), gruppo per
   * gruppo nell'ordine della sessione. Idempotente: una seconda esecuzione trova niente da fare.
   */
  async applyChanges(actor: ActorContext, id: string): Promise<ApplyChangesResult> {
    const tenantId = tenantDi(actor);
    await soloDirettore(actor);
    const { result, violations } = await riversa(tenantId, id, actor.userId, true);
    if (violations.length > 0) {
      throw new ConflictError(
        `L'approvazione accenderebbe ${violations.length} controlli del database (${violations.map((v) => v.view).join(", ")}): niente è stato scritto`,
        "CONSOLIDATION_APPROVAL_BREAKS_INVARIANTS",
      );
    }
    return result;
  },

  /** L'anteprima dell'approvazione: la stessa transazione, annullata alla fine. */
  async previewChanges(actor: ActorContext, id: string): Promise<ApprovalPreview> {
    const tenantId = tenantDi(actor);
    await soloDirettore(actor);
    return riversa(tenantId, id, actor.userId, false);
  },

  /** «Scarta modifiche»: toglie dalla bozza le decisioni non ancora approvate; restano quelle già riversate. */
  async discardChanges(actor: ActorContext, id: string): Promise<{ discarded: number }> {
    const tenantId = tenantDi(actor);
    await soloDirettore(actor);
    return withTransaction(async (client) => {
      const s = await repo.getConsolidation(client, tenantId, id, true);
      if (!s) throw new NotFoundError("Sessione di consolidamento non trovata", "CONSOLIDATION_NOT_FOUND");
      const r = await client.query(
        `DELETE FROM sys.sys_tenant_consolidation_decisions d
          USING sys.sys_tenant_consolidation_proposals p
          WHERE p.tenant_consolidation_proposal_id = d.tenant_consolidation_decision_proposal_id
            AND p.tenant_consolidation_proposal_consolidation_id = $1
            AND d.tenant_consolidation_decision_tenant_id = $2
            AND NOT EXISTS (SELECT 1 FROM sys.sys_tenant_consolidation_links l
                             WHERE l.tenant_consolidation_link_decision_id = d.tenant_consolidation_decision_id)
            AND NOT EXISTS (SELECT 1 FROM sys.sys_tenant_consolidation_decisions x
                              JOIN sys.sys_tenant_consolidation_links l2
                                ON l2.tenant_consolidation_link_decision_id = x.tenant_consolidation_decision_id
                             WHERE x.tenant_consolidation_decision_supersedes_id = d.tenant_consolidation_decision_id)`,
        [id, tenantId],
      );
      return { discarded: r.rowCount ?? 0 };
    });
  },

  /** Le modifiche nella bozza e non ancora approvate, per l'avviso nell'intestazione. */
  async pendingApproval(actor: ActorContext): Promise<PendingApproval> {
    const tenantId = tenantDi(actor);
    const leggibili = await gruppiLeggibili(actor);
    const aperta = (await repo.listConsolidations(pool, tenantId)).find((s) => s.status === "GIRI" || s.status === "IN_CONFERMA");
    if (!aperta) return { pending: 0, consolidationId: null, since: null };
    // un delegato conta solo le decisioni dei gruppi della sua delega
    const da = (await repo.decisioniDaApplicare(pool, tenantId, aperta.consolidationId))
      .filter((r) => leggibili === null || leggibili.includes(r.group));
    const { rows } = await pool.query<{ t: Date | null }>(
      `SELECT min(d.tenant_consolidation_decision_decided_at) AS t
         FROM sys.sys_tenant_consolidation_decisions d WHERE d.tenant_consolidation_decision_id = ANY($1::uuid[])`,
      [da.map((x) => x.decisionId)],
    );
    return { pending: da.length, consolidationId: aperta.consolidationId, since: rows[0]?.t ? rows[0].t.toISOString() : null };
  },

  /** La cascata di una proposta, con i nomi delle voci, prima di decidere. */
  async cascade(actor: ActorContext, proposalId: string): Promise<CascadeResponse> {
    const tenantId = tenantDi(actor);
    const leggibili = await gruppiLeggibili(actor);
    const [p] = await repo.getProposals(pool, tenantId, [proposalId]);
    if (!p) throw new NotFoundError("Proposta non trovata", "CONSOLIDATION_PROPOSAL_NOT_FOUND");
    if (leggibili !== null && !leggibili.includes(p.group)) {
      throw new ForbiddenError("La proposta è fuori dai gruppi della delega", "PERMISSION_DENIED");
    }
    const s = await sessione(tenantId, p.consolidationId);
    // un delegato vede della cascata solo le voci dei gruppi della sua delega
    const voci = (await cascataDi(pool, s.variantVersionId, p)).filter((v) => leggibili === null || leggibili.includes(v.group));
    const gruppi = [...new Set(voci.map((v) => v.group))];
    const nomi = new Map<string, string>();
    await Promise.all(gruppi.map(async (g) => {
      for (const v of await vociDelPrototipo(pool, s.variantVersionId, g)) nomi.set(`${g}#${v.key}`, v.name);
    }));
    return {
      items: voci.map((v) => ({ ...v, prototypeItems: v.prototypeKeys.map((key) => ({ key, name: nomi.get(`${v.group}#${key}`) ?? null })) })),
      fields: CAMPI_IN_CASCATA[p.group] ?? [],
    };
  },

  /**
   * Avvia i giri del gruppo aperto (R-6: i gruppi si fanno in ordine). La risposta torna subito:
   * un gruppo grande chiede molti lotti al giudice, e una richiesta HTTP non resta aperta per
   * minuti. L'esito si legge dal registro (giri, proposte) e dal metadata della sessione.
   * Lo stato si ricostruisce ogni volta dalle voci vere e dai rifiuti del registro: così un
   * rifiuto rifà i giri che ne dipendevano (R-13) senza una seconda memoria da tenere allineata.
   */
  async runGroup(
    actor: ActorContext,
    id: string,
    group: ConsolidationGroup,
    giudice: Giudice | null = giudiceDaAmbiente(),
  ): Promise<{ started: true; group: ConsolidationGroup }> {
    const tenantId = tenantDi(actor);
    const s = await sessione(tenantId, id);
    if (s.openGroup !== group) {
      throw new ConflictError(`Il gruppo aperto è ${s.openGroup ?? "nessuno"}: i gruppi si fanno in ordine`, "CONSOLIDATION_GROUP_NOT_OPEN");
    }
    if (!giudice) {
      throw new InternalError(
        "CONSOLIDATION_JUDGE_UNAVAILABLE",
        "CONSOLIDATION_GATEWAY_URL o CONSOLIDATION_GATEWAY_TOKEN non configurati",
        "Il giudice del consolidamento non è configurato su questo server",
      );
    }
    if (!(await repo.claimRun(pool, tenantId, id, group))) {
      throw new ConflictError("Un giro di questa sessione è già in corso, o la sessione non è nei giri", "CONSOLIDATION_RUN_BUSY");
    }
    void eseguiGiri(tenantId, s, group, giudice);
    return { started: true, group };
  },

  /** Chiude il gruppo aperto quando nessuna proposta aspetta più una decisione, e apre il prossimo. */
  async closeGroup(actor: ActorContext, id: string, group: ConsolidationGroup): Promise<TenantConsolidation> {
    const tenantId = tenantDi(actor);
    return withTransaction(async (client) => {
      const s = await repo.getConsolidation(client, tenantId, id, true);
      if (!s) throw new NotFoundError("Sessione di consolidamento non trovata", "CONSOLIDATION_NOT_FOUND");
      if (s.status !== "GIRI" || s.openGroup !== group) {
        throw new ConflictError("Il gruppo non è quello aperto", "CONSOLIDATION_GROUP_NOT_OPEN");
      }
      const aperte = await repo.pendingInGroup(client, id, group);
      if (aperte > 0) {
        throw new ConflictError(`${aperte} proposte aspettano ancora una decisione`, "CONSOLIDATION_GROUP_PENDING");
      }
      const prossimo = nextConsolidationGroup(group);
      await repo.setStatus(client, id, prossimo ? "GIRI" : "IN_CONFERMA", prossimo);
      return (await repo.getConsolidation(client, tenantId, id))!;
    });
  },

  /** Il registro delle corse del tenant, dalla più recente: la pagina parte dalla prima. */
  async runs(actor: ActorContext): Promise<BlueprintRun[]> {
    await gruppiLeggibili(actor);
    return elencoCorse(pool, tenantDi(actor));
  },

  /** Le consegne del datastore che si possono accogliere, con quelle già nel registro segnate. */
  async deliveries(actor: ActorContext): Promise<AvailableDeliveryList> {
    await gruppiLeggibili(actor);
    return consegneDisponibili(tenantDi(actor));
  },

  /** Accoglie una consegna come versione di modello e la mette nel registro (idempotente). */
  async receive(actor: ActorContext, body: ReceiveDeliveryBody): Promise<BlueprintRun> {
    return accogliConsegna(tenantDi(actor), actor.userId, body.code, body.packageVersion);
  },

  /** La corsa diventa il modello in uso del tenant. Solo il Direttore HR: è una scelta sul modello, non su una voce. */
  async makeDefinitive(actor: ActorContext, runId: string): Promise<BlueprintRun> {
    if (!userHasPermission(actor, "consolidation:decide")) {
      throw new ForbiddenError("Solo il Direttore HR rende definitiva una corsa", "PERMISSION_DENIED");
    }
    return rendiDefinitiva(tenantDi(actor), runId, actor.userId);
  },

  async vocabulary() {
    return repo.listEquivalences(pool);
  },

  async decideVocabulary(actor: ActorContext, id: string, status: "APPROVATA" | "RITIRATA") {
    const cambiata = await repo.setEquivalenceStatus(pool, id, status, actor.userId);
    if (!cambiata) {
      throw new NotFoundError("Equivalenza non trovata o già in quello stato", "VOCABULARY_EQUIVALENCE_NOT_FOUND");
    }
    const tutte = await repo.listEquivalences(pool);
    return tutte.find((e) => e.equivalenceId === id)!;
  },
};
