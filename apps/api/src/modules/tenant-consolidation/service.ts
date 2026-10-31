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
  NotFoundError,
  UnprocessableEntityError,
} from "../../errors/index.js";
import {
  CONSOLIDATION_GROUP_VALUES,
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
