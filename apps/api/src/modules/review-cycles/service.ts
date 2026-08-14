/**
 * apps/api/src/modules/review-cycles/service.ts — #92 passo 3/7. READ-only.
 * Il ciclo e' META del processo (finestre, scadenze, stato macchina): nessun
 * giudizio per-persona, quindi niente mask. Tenant-scoped (orgGate "catalog");
 * PLATFORM_ADMIN vede tutti i tenant.
 *
 * [#92 F4] Le scritture. La macchina a stati e' dichiarata nel contratto condiviso
 * (`REVIEW_CYCLE_TRANSITIONS`) e fatta rispettare QUI, non nella UI: un client puo'
 * sempre chiamare l'API a mano, e un pulsante disabilitato non e' una regola.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from "../../errors/index.js";
import type {
  ReviewCycle,
  ReviewCycleListQuery,
  CreateReviewCycleBody,
  ReviewCycleStatus,
} from "@heuresys/shared";
import { canTransitionReviewCycle, REVIEW_CYCLE_TRANSITIONS } from "@heuresys/shared";
import * as repo from "./repository.js";

function catalogTenant(actor: ActorContext): string | undefined {
  return isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
}

export const reviewCyclesService = {
  async list(actor: ActorContext, query: ReviewCycleListQuery) {
    return repo.listReviewCycles(pool, catalogTenant(actor), query);
  },

  async getById(actor: ActorContext, id: string): Promise<ReviewCycle> {
    const cycle = await repo.findReviewCycleById(pool, id);
    // 404 anche fuori tenant: un 403 confermerebbe che il ciclo esiste altrove
    if (!cycle || (!isPlatform(actor) && cycle.tenantId !== actor.tenantId)) {
      throw new NotFoundError("ReviewCycle");
    }
    return cycle;
  },

  /** Un ciclo nasce sempre in DRAFT: lo stato iniziale non e' un parametro del client. */
  async create(actor: ActorContext, body: CreateReviewCycleBody): Promise<ReviewCycle> {
    const tenantId = actor.tenantId;
    if (!tenantId) {
      // PLATFORM_ADMIN senza tenant nel token non ha un tenant su cui creare: e' una
      // scrittura che deve dichiarare dove atterra, non indovinarlo.
      throw new ForbiddenError("Tenant context required to create a review cycle");
    }
    if (body.periodEnd < body.periodStart) {
      throw new ValidationError(
        { field: "periodEnd", value: body.periodEnd, periodStart: body.periodStart },
        "Il periodo finisce prima di cominciare",
      );
    }
    const esistente = await repo.findReviewCycleByCode(pool, tenantId, body.code);
    if (esistente) {
      throw new ConflictError(`Review cycle '${body.code}' already exists`, "REVIEW_CYCLE_CODE_CONFLICT");
    }
    return repo.insertReviewCycle(pool, tenantId, body);
  },

  /**
   * Il passaggio di stato. Lo stato di partenza si LEGGE dal database e non si accetta
   * dal client, e la scrittura ricontrolla la partenza nella `WHERE`: fra la lettura e
   * l'aggiornamento un'altra richiesta puo' aver mosso il ciclo.
   */
  async transition(actor: ActorContext, id: string, to: ReviewCycleStatus): Promise<ReviewCycle> {
    const cycle = await this.getById(actor, id); // 404 fuori tenant, come in lettura
    const da = cycle.status as ReviewCycleStatus;

    if (da === to) {
      throw new ConflictError(`Il ciclo e' gia' in stato ${to}`, "REVIEW_CYCLE_ALREADY_IN_STATE");
    }
    if (!canTransitionReviewCycle(da, to)) {
      const ammessi = REVIEW_CYCLE_TRANSITIONS[da];
      throw new ConflictError(
        ammessi.length === 0
          ? `${da} e' uno stato terminale: da qui non si va da nessuna parte`
          : `Da ${da} si puo' passare solo a ${ammessi.join(", ")} — non a ${to}`,
        "REVIEW_CYCLE_TRANSITION_ILLEGAL",
      );
    }

    const aggiornato = await repo.transitionReviewCycle(pool, id, da, to);
    if (!aggiornato) {
      throw new ConflictError(
        "Il ciclo e' cambiato mentre lo aggiornavo: rileggi e riprova",
        "REVIEW_CYCLE_CONCURRENT_CHANGE",
      );
    }
    return aggiornato;
  },
};
