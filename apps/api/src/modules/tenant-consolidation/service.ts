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
  CONSOLIDATION_GROUP_VALUES,
  nextConsolidationGroup,
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
import { vociDelPrototipo, vociDelTenant } from "./sorgenti.js";

/** La soglia degli abbinamenti certi che si confermano a gruppi (specifica R-5, valore iniziale). */
export const SOGLIA_CERTI = 90;

/** Quali decisioni ammette ogni esito: una lacuna non si «conferma», si adotta o no. */
const DECISIONI_AMMESSE: Record<ConsolidationProposal["outcome"], readonly Decision[]> = {
  CORRISPONDENZA: ["CONFERMATA", "RIFIUTATA"],
  LACUNA: ["ADOTTATA", "NON_ADOTTATA"],
  PERSONALIZZAZIONE: ["PERSONALIZZAZIONE", "RIFIUTATA"],
};

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
    await repo.releaseRun(pool, id, {
      group, ok: true, proposals: scritte, rounds: stato.rounds.length, fuse: stato.fuseTripped, ms: Date.now() - inizio,
    });
  } catch (e) {
    const codice = e instanceof InternalError ? e.code : "CONSOLIDATION_RUN_FAILED";
    await repo.releaseRun(pool, id, { group, ok: false, error: codice, ms: Date.now() - inizio }).catch(() => undefined);
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
    if (!(await repo.variantVersionExists(pool, body.variantVersionId))) {
      throw new UnprocessableEntityError(
        { variantVersionId: "inesistente" },
        "La versione del prototipo non esiste",
        "CONSOLIDATION_VERSION_INVALID",
      );
    }
    const creata = await repo.createConsolidation(pool, tenantId, {
      variantVersionId: body.variantVersionId,
      trigger: body.trigger,
      userId: actor.userId,
      openGroup: CONSOLIDATION_GROUP_VALUES[0],
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
    await sessione(tenantId, id);
    let gruppi: ConsolidationGroup[] | null = leggibili;
    if (group) {
      if (leggibili && !leggibili.includes(group)) {
        throw new ForbiddenError("Il gruppo non è nella tua delega", "PERMISSION_DENIED");
      }
      gruppi = [group];
    }
    return repo.listProposals(pool, tenantId, id, gruppi);
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
    return withTransaction(async (client) => {
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
      const [dopo] = await repo.getProposals(client, tenantId, [proposalId]);
      const { decisionId: _d, status: _s, ...proposta } = dopo!;
      return proposta;
    });
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
