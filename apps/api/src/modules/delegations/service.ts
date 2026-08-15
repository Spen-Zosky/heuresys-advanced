/**
 * apps/api/src/modules/delegations/service.ts — #99 F6b.
 *
 * L'autorizzazione qui è **di mandato, non di perimetro**: conferire una delega per conto di
 * altri è un atto amministrativo, e il permesso `delegation:manage` lo detengono solo
 * `PLATFORM_ADMIN`, `TENANT_ADMIN` e `HRMS_MANAGER` (mig `000314`). Un capo linea non lo ha,
 * e non è una dimenticanza: il suo perimetro dice **su chi** può guardare, non quali atti
 * amministrativi può compiere (I18).
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
// `UnprocessableEntityError` e non `ValidationError`: quest'ultima ha il codice FISSO a
// `VALIDATION_ERROR` (il suo primo argomento sono i *details*, non il messaggio), e un
// vincolo di dominio violato merita un codice che dica QUALE — chi chiama deve poter
// distinguere «hai delegato a te stesso» da «la finestra è invertita» senza leggere il testo.
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from "../../errors/index.js";
import type {
  CreateDelegationBody,
  Delegation,
  DelegationListQuery,
  MeDelegationsResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export type { ActorContext };

function tenantDi(actor: ActorContext): string {
  if (!actor.tenantId) throw new ForbiddenError("Tenant context required", "PERMISSION_DENIED");
  return actor.tenantId;
}

/** Le due persone devono esistere ED essere del tenant: una delega fra tenant non ha senso. */
async function verificaPersone(tenantId: string, a: string, b: string): Promise<void> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_users
      WHERE user_id = ANY($1::uuid[]) AND user_tenant_id = $2`,
    [[a, b], tenantId],
  );
  if (Number(rows[0]?.n ?? 0) !== 2) {
    throw new UnprocessableEntityError(
      { parties: "inesistenti o di un altro tenant" },
      "Delegante o delegato inesistente, oppure di un altro tenant",
      "DELEGATION_PARTY_INVALID",
    );
  }
}

export const delegationsService = {
  async list(actor: ActorContext, query: DelegationListQuery) {
    return repo.listDelegations(pool, tenantDi(actor), query);
  },

  async get(actor: ActorContext, id: string): Promise<Delegation> {
    const d = await repo.getDelegation(pool, tenantDi(actor), id);
    if (!d) throw new NotFoundError("Delega non trovata", "DELEGATION_NOT_FOUND");
    return d;
  },

  async create(actor: ActorContext, body: CreateDelegationBody): Promise<Delegation> {
    const tenantId = tenantDi(actor);

    // Il vincolo esiste anche nel database (CHECK), e va bene che sia in due posti: qui
    // produce un messaggio comprensibile, là impedisce che una via diversa dall'API lo
    // aggiri. Una guardia sola sarebbe o scortese o aggirabile.
    if (body.delegatorUserId === body.delegateUserId) {
      throw new UnprocessableEntityError(
        { delegateUserId: "uguale al delegante" },
        "Nessuno delega a se stesso",
        "DELEGATION_SELF",
      );
    }
    if (body.endsOn && body.endsOn < body.startsOn) {
      throw new UnprocessableEntityError(
        { endsOn: "precedente a startsOn" },
        "La delega finisce prima di cominciare",
        "DELEGATION_WINDOW_INVALID",
      );
    }
    // `FULL` non si concede dall'API: esiste nel vincolo perché un giorno servirà, ma
    // aprirlo è una decisione, non un valore da accettare perché il tipo lo ammette.
    if (body.scope === "FULL" && !isPlatform(actor)) {
      throw new ForbiddenError(
        "L'ambito FULL non è concedibile da questa superficie",
        "PERMISSION_DENIED",
      );
    }
    await verificaPersone(tenantId, body.delegatorUserId, body.delegateUserId);

    return repo.createDelegation(pool, tenantId, {
      delegatorUserId: body.delegatorUserId,
      delegateUserId: body.delegateUserId,
      scope: body.scope,
      startsOn: body.startsOn,
      endsOn: body.endsOn ?? null,
      reason: body.reason ?? null,
      actorId: actor.userId,
    });
  },

  async revoke(actor: ActorContext, id: string, reason: string | null): Promise<Delegation> {
    const tenantId = tenantDi(actor);
    const esiste = await repo.getDelegation(pool, tenantId, id);
    if (!esiste) throw new NotFoundError("Delega non trovata", "DELEGATION_NOT_FOUND");

    const { revocata } = await repo.revokeDelegation(pool, tenantId, id, actor.userId, reason);
    if (!revocata) {
      // Non è un 404: la delega c'è, ma era già revocata. Dirlo distintamente evita che
      // chi chiama pensi di aver sbagliato identificativo.
      throw new UnprocessableEntityError(
        { status: "non ACTIVE" },
        "La delega non è attiva",
        "DELEGATION_NOT_ACTIVE",
      );
    }
    return this.get(actor, id);
  },

  /** Self-scope (I17): le proprie deleghe, senza bisogno di alcun mandato. */
  async listMine(actor: ActorContext): Promise<MeDelegationsResponse> {
    return repo.listMyDelegations(pool, tenantDi(actor), actor.userId);
  },
};
