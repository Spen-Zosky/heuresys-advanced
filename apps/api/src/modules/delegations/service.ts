/**
 * apps/api/src/modules/delegations/service.ts — #99 F6b, ADR-0051.
 *
 * Due vie per conferire una delega.
 *
 *  - **Per conto di altri** (`/v1/delegations`, permesso `delegation:manage`): atto amministrativo
 *    dei mandati HR e di governo. Per ADR-0051 §4 è l'ECCEZIONE (il capo assente all'improvviso), e
 *    per una delega di catena rispetta lo stesso vincolo: cambia CHI la crea, non A CHI va.
 *  - **Da sé** (`/v1/me/delegations`, ADR-0051 §4): il capo affida una SUA attività a una persona
 *    della sua catena. Non serve un permesso di ruolo: il diritto nasce dall'essere capo (il ruolo
 *    segue il lavoro), e la catena lo misura.
 *
 * La catena si misura alla creazione E a ogni uso (§2): se l'organigramma cambia, la delega resta
 * registrata ma non ha effetto finché il delegato non torna nella catena. Revocare è un atto.
 */
import { pool, withTransaction } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { haMandatoPiattaforma } from "../../lib/scope/mandati.js";
import { delegationChainUserIds, isInDelegationChain, ownUnitIds } from "../../lib/scope/org.js";
import { getUserRoleGrants } from "../auth/repository.js";
import { userHasPermission } from "../../middleware/rbac.js";
import { emitNotification } from "../../lib/notifications/emit.js";
import { approvalService } from "../approvals/service.js";
import type { PoolClient } from "pg";
// `UnprocessableEntityError` e non `ValidationError`: quest'ultima ha il codice FISSO a
// `VALIDATION_ERROR` (il suo primo argomento sono i *details*, non il messaggio), e un
// vincolo di dominio violato merita un codice che dica QUALE — chi chiama deve poter
// distinguere «hai delegato a te stesso» da «la finestra è invertita» senza leggere il testo.
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from "../../errors/index.js";
import type {
  ApprovalStep,
  CreateDelegationBody,
  CreateMyDelegationBody,
  DecideApprovalStepBody,
  Delegation,
  DelegationCandidatesResponse,
  DelegationListQuery,
  DelegatedApprovalsResponse,
  DelegationProposalsResponse,
  MeDelegationsResponse,
} from "@heuresys/shared";
import { DELEGABLE_REQUEST_TYPES, delegationKindOf } from "@heuresys/shared";
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
    const r = await repo.listDelegations(pool, tenantDi(actor), query);
    return { ...r, items: await conCatena(r.items) };
  },

  async get(actor: ActorContext, id: string): Promise<Delegation> {
    const d = await repo.getDelegation(pool, tenantDi(actor), id);
    if (!d) throw new NotFoundError("Delega non trovata", "DELEGATION_NOT_FOUND");
    return (await conCatena([d]))[0]!;
  },

  async create(actor: ActorContext, body: CreateDelegationBody): Promise<Delegation> {
    const tenantId = tenantDi(actor);

    // `FULL` non si concede dall'API: esiste nel vincolo perché un giorno servirà, ma
    // aprirlo è una decisione, non un valore da accettare perché il tipo lo ammette.
    if (body.scope === "FULL" && !haMandatoPiattaforma(actor)) {
      throw new ForbiddenError(
        "L'ambito FULL non è concedibile da questa superficie",
        "PERMISSION_DENIED",
      );
    }
    // CONSOLIDATION (mig 000465): la delega del Direttore HR porta sempre i gruppi su cui vale;
    // gli altri ambiti non ne portano. Lo stesso vincolo sta nel CHECK della tabella.
    const gruppi = body.groups && body.groups.length > 0 ? [...new Set(body.groups)] : null;
    if ((body.scope === "CONSOLIDATION") !== (gruppi !== null)) {
      throw new UnprocessableEntityError(
        { groups: body.scope === "CONSOLIDATION" ? "obbligatori" : "ammessi solo per CONSOLIDATION" },
        "I gruppi di dati valgono solo, e sempre, per una delega di consolidamento",
        "DELEGATION_GROUPS_INVALID",
      );
    }
    return conferisci(tenantId, actor.userId, {
      delegatorUserId: body.delegatorUserId,
      delegateUserId: body.delegateUserId,
      scope: body.scope,
      groups: gruppi,
      requestType: body.requestType ?? null,
      tenantProcessStepId: body.tenantProcessStepId ?? null,
      startsOn: body.startsOn,
      endsOn: body.endsOn ?? null,
      reason: body.reason ?? null,
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
    const r = await repo.listMyDelegations(pool, tenantDi(actor), actor.userId);
    return { granted: await conCatena(r.granted), received: await conCatena(r.received) };
  },

  /* ── ADR-0051 — la delega di catena, dall'area personale ─────────────────────────────── */

  /** §4 — il capo delega da sé una SUA attività. Il delegante è sempre chi chiama. */
  async createMine(actor: ActorContext, body: CreateMyDelegationBody): Promise<Delegation> {
    const tenantId = tenantDi(actor);
    return conferisci(tenantId, actor.userId, {
      delegatorUserId: actor.userId,
      delegateUserId: body.delegateUserId,
      scope: body.scope,
      groups: null,
      requestType: body.requestType ?? null,
      tenantProcessStepId: body.tenantProcessStepId ?? null,
      startsOn: body.startsOn,
      endsOn: body.endsOn ?? null,
      reason: body.reason ?? null,
    });
  },

  /** Il delegante revoca una delega che ha conferito. Le altre non sono sue: 404, come se non ci fossero. */
  async revokeMine(actor: ActorContext, id: string, reason: string | null): Promise<Delegation> {
    const tenantId = tenantDi(actor);
    const d = await repo.getDelegation(pool, tenantId, id);
    if (!d || d.delegatorUserId !== actor.userId) {
      throw new NotFoundError("Delega non trovata", "DELEGATION_NOT_FOUND");
    }
    return this.revoke(actor, id, reason);
  },

  /** §1 — a chi posso delegare, e quali attività di processo sono mie. Vuoto = non sono capo di nessuno. */
  async candidates(actor: ActorContext): Promise<DelegationCandidatesResponse> {
    const tenantId = tenantDi(actor);
    const persone = await delegationChainUserIds(pool, actor.userId);
    const items = await repo.describePeople(pool, tenantId, persone);
    // Le attività si offrono solo a chi ha qualcuno a cui delegarle.
    const attivita = items.length === 0
      ? []
      : await repo.processStepsOfUnits(pool, tenantId, await ownUnitIds(pool, actor.userId));
    return {
      items,
      processSteps: attivita.map(({ unitId: _u, ...a }) => a),
    };
  },

  /** §3 e §5 — i passi che posso decidere per conto di chi mi ha delegato, oggi. */
  async delegatedApprovals(actor: ActorContext): Promise<DelegatedApprovalsResponse> {
    const tenantId = tenantDi(actor);
    const items: DelegatedApprovalsResponse["items"] = [];
    const visti = new Set<string>();
    for (const d of await repo.chainDelegationsInForceReceived(pool, tenantId, actor.userId)) {
      if (!(await isInDelegationChain(pool, d.delegatorUserId, actor.userId))) continue;
      if (!(await puoDecidere(pool, tenantId, d.delegatorUserId))) continue;
      const tipi = tipiDellaDelega(d);
      for (const p of await repo.openStepsAssignedTo(pool, tenantId, d.delegatorUserId, tipi)) {
        if (d.scope === "PROCESS_STEP" && p.tenantProcessStepId !== d.tenantProcessStepId) continue;
        if (visti.has(p.approvalStepId)) continue;
        visti.add(p.approvalStepId);
        const { tenantProcessStepId: _t, ...resto } = p;
        items.push({
          ...resto,
          delegationId: d.delegationId,
          delegatorUserId: d.delegatorUserId,
          delegatorName: d.delegatorName,
        });
      }
    }
    return { items };
  },

  /**
   * §5 — decidere un passo per conto del delegante. Ogni condizione si ri-verifica DENTRO la
   * transazione della decisione: una delega revocata o un organigramma cambiato fra la lettura
   * della casella e il clic non devono lasciar passare la decisione.
   */
  async decideOnBehalf(
    actor: ActorContext,
    requestId: string,
    stepId: string,
    body: DecideApprovalStepBody,
  ): Promise<ApprovalStep> {
    const tenantId = tenantDi(actor);
    const candidate = await repo.chainDelegationsInForceReceived(pool, tenantId, actor.userId);
    // Il passo è di un delegante solo: si cerca, fra le deleghe di quel delegante, quella che copre
    // il tipo della richiesta (e l'attività, per PROCESS_STEP).
    const passo = await pool.query<{ approver: string | null; tipo: string | null; attivita: string | null }>(
      `SELECT s.approval_step_approver_user_id AS approver, r.approval_request_resource_type AS tipo,
              r.approval_request_tenant_process_step_id::text AS attivita
         FROM sys.sys_approval_steps s
         JOIN sys.sys_approval_requests r ON r.approval_request_id = s.approval_step_request_id
        WHERE s.approval_step_id = $1 AND s.approval_step_request_id = $2 AND s.approval_step_tenant_id = $3`,
      [stepId, requestId, tenantId],
    );
    const riga = passo.rows[0];
    if (!riga?.approver) throw new NotFoundError("Approval step");
    const delDelegante = candidate.filter((d) => d.delegatorUserId === riga.approver);
    if (delDelegante.length === 0) {
      throw new ForbiddenError("Nessuna delega in vigore per questo passo", "DELEGATION_NOT_IN_FORCE");
    }
    const delega = delDelegante.find((d) =>
      riga.tipo !== null && tipiDellaDelega(d).includes(riga.tipo)
      && (d.scope !== "PROCESS_STEP" || d.tenantProcessStepId === riga.attivita));
    if (!delega) {
      throw new ForbiddenError("Questo tipo di richiesta non è delegato", "DELEGATION_TYPE_EXCLUDED");
    }
    const deciso = await approvalService.decideStep(actor, requestId, stepId, body, {
      delegationId: delega.delegationId,
      delegatorUserId: delega.delegatorUserId,
      verifica: async (client, richiesta) => {
        await verificaUso(client, tenantId, delega.delegationId, actor.userId, richiesta);
      },
    });
    // §5 — il delegante sa di ogni azione fatta a suo nome. Fuori dalla transazione: un avviso
    // perso non deve annullare una decisione presa.
    const titolo = await pool.query<{ t: string }>(
      `SELECT approval_request_title AS t FROM sys.sys_approval_requests WHERE approval_request_id = $1`,
      [requestId],
    );
    await emitNotification(pool, {
      tenantId,
      userId: delega.delegatorUserId,
      type: "SYSTEM",
      subject: `${delega.delegateName ?? "Il tuo delegato"} ha ${body.decision === "APPROVE" ? "approvato" : "respinto"} per conto tuo: ${titolo.rows[0]?.t ?? "una richiesta"}`,
      body: body.comment ?? null,
      priority: "INFO",
      resourceType: "APPROVAL_STEP",
      resourceId: stepId,
      actionUrl: `/approvals/${requestId}?step=${stepId}`,
      createdBy: actor.userId,
    });
    return deciso;
  },

  /**
   * §6 — l'agente PROPONE, la persona decide. Regola di oggi: ho un'assenza approvata che comincia
   * entro 30 giorni (o è in corso), ho persone a cui delegare e passi di approvazione aperti, e non
   * ho già una delega di catena che copre quei giorni. Suggerisce l'ultima persona a cui ho delegato,
   * se è ancora nella mia catena; altrimenti non suggerisce nessuno, e lo dice.
   */
  async proposals(actor: ActorContext): Promise<DelegationProposalsResponse> {
    const tenantId = tenantDi(actor);
    const catena = await delegationChainUserIds(pool, actor.userId);
    if (catena.length === 0) return { items: [] };
    const aperti = await repo.openStepsAssignedTo(pool, tenantId, actor.userId, DELEGABLE_REQUEST_TYPES);
    const assenze = await repo.upcomingApprovedAbsences(pool, tenantId, actor.userId, 30);
    if (assenze.length === 0) return { items: [] };
    const mie = (await repo.listMyDelegations(pool, tenantId, actor.userId)).granted
      .filter((d) => d.kind === "CHAIN" && d.status === "ACTIVE");
    const ultimo = await repo.lastChainDelegateOf(pool, tenantId, actor.userId);
    const suggerito = ultimo && catena.includes(ultimo) ? ultimo : null;
    const nome = suggerito
      ? (await repo.describePeople(pool, tenantId, [suggerito]))[0]?.name ?? null
      : null;
    const items: DelegationProposalsResponse["items"] = [];
    for (const a of assenze) {
      const coperta = mie.some((d) => d.startsOn <= a.startsOn && (d.endsOn === null || d.endsOn >= a.endsOn));
      if (coperta) continue;
      items.push({
        motivo: "ASSENZA_APPROVATA",
        spiegazione:
          `Sarai assente dal ${a.startsOn} al ${a.endsOn} e hai ${aperti.length} ` +
          `${aperti.length === 1 ? "richiesta" : "richieste"} da approvare. ` +
          (suggerito
            ? `Propongo di delegare le approvazioni a ${nome ?? "chi le ha seguite l'ultima volta"}, che le ha già seguite.`
            : "Scegli tu a chi delegare le approvazioni fra le persone della tua catena."),
        startsOn: a.startsOn,
        endsOn: a.endsOn,
        pendingApprovals: aperti.length,
        suggestedDelegateUserId: suggerito,
        suggestedDelegateName: nome,
      });
    }
    return { items };
  },
};

/* ── ADR-0051 — le regole, in un posto solo ─────────────────────────────────────────── */

/** I tipi di richiesta che una delega tocca: il suo, se lo restringe, altrimenti tutti i delegabili. */
function tipiDellaDelega(d: Delegation): readonly string[] {
  if (d.scope === "APPROVALS" && d.requestType) {
    return (DELEGABLE_REQUEST_TYPES as readonly string[]).includes(d.requestType) ? [d.requestType] : [];
  }
  return DELEGABLE_REQUEST_TYPES;
}

/** «Mai più di quanto abbia chi delega»: il delegante può ancora decidere approvazioni nel tenant? */
async function puoDecidere(q: typeof pool | PoolClient, tenantId: string, userId: string): Promise<boolean> {
  const ruoli = (await getUserRoleGrants(q, userId))
    .filter((g) => g.tenantId === tenantId || g.tenantId === null)
    .map((g) => g.roleCode);
  return userHasPermission({ roles: ruoli }, "approval:decide");
}

/** Riempie `inChain` per le deleghe di catena: misurato adesso, non ricordato. */
async function conCatena(deleghe: Delegation[]): Promise<Delegation[]> {
  const cache = new Map<string, string[]>();
  const out: Delegation[] = [];
  for (const d of deleghe) {
    if (d.kind !== "CHAIN") { out.push({ ...d, inChain: null }); continue; }
    let catena = cache.get(d.delegatorUserId);
    if (!catena) {
      catena = await delegationChainUserIds(pool, d.delegatorUserId);
      cache.set(d.delegatorUserId, catena);
    }
    out.push({ ...d, inChain: catena.includes(d.delegateUserId) });
  }
  return out;
}

/** §2 e §3 — tutte le condizioni d'uso, rilette sulla connessione della transazione. */
async function verificaUso(
  client: PoolClient,
  tenantId: string,
  delegationId: string,
  delegateUserId: string,
  richiesta: { resourceType: string | null; tenantProcessStepId: string | null },
): Promise<void> {
  const d = await repo.getDelegation(client, tenantId, delegationId);
  if (!d || !d.isInForce || d.delegateUserId !== delegateUserId || d.kind !== "CHAIN") {
    throw new ForbiddenError("La delega non è in vigore", "DELEGATION_NOT_IN_FORCE");
  }
  if (!(await isInDelegationChain(client, d.delegatorUserId, delegateUserId))) {
    throw new ForbiddenError(
      "La delega è sospesa: non sei più nella catena di chi te l'ha conferita",
      "DELEGATION_OUT_OF_CHAIN",
    );
  }
  if (!richiesta.resourceType || !tipiDellaDelega(d).includes(richiesta.resourceType)) {
    throw new ForbiddenError("Questo tipo di richiesta non è delegato", "DELEGATION_TYPE_EXCLUDED");
  }
  if (d.scope === "PROCESS_STEP" && richiesta.tenantProcessStepId !== d.tenantProcessStepId) {
    throw new ForbiddenError("La richiesta non appartiene all'attività delegata", "DELEGATION_TYPE_EXCLUDED");
  }
  if (!(await puoDecidere(client, tenantId, d.delegatorUserId))) {
    throw new ForbiddenError("Chi ti ha delegato non può più decidere approvazioni", "DELEGATION_NOT_IN_FORCE");
  }
}

/**
 * Il punto unico di nascita di una delega, dalle due vie. Per una delega di catena (§2-§3): il
 * delegato nella catena del delegante, il tipo di richiesta solo per APPROVALS, l'attività solo e
 * sempre per PROCESS_STEP e solo se è del delegante.
 */
async function conferisci(
  tenantId: string,
  actorId: string,
  dati: {
    delegatorUserId: string; delegateUserId: string; scope: Delegation["scope"]; groups: string[] | null;
    requestType: string | null; tenantProcessStepId: string | null;
    startsOn: string; endsOn: string | null; reason: string | null;
  },
): Promise<Delegation> {
  // Il vincolo esiste anche nel database (CHECK), e va bene che sia in due posti: qui
  // produce un messaggio comprensibile, là impedisce che una via diversa dall'API lo
  // aggiri. Una guardia sola sarebbe o scortese o aggirabile.
  if (dati.delegatorUserId === dati.delegateUserId) {
    throw new UnprocessableEntityError(
      { delegateUserId: "uguale al delegante" },
      "Nessuno delega a se stesso",
      "DELEGATION_SELF",
    );
  }
  if (dati.endsOn && dati.endsOn < dati.startsOn) {
    throw new UnprocessableEntityError(
      { endsOn: "precedente a startsOn" },
      "La delega finisce prima di cominciare",
      "DELEGATION_WINDOW_INVALID",
    );
  }
  if (dati.requestType !== null && dati.scope !== "APPROVALS") {
    throw new UnprocessableEntityError(
      { requestType: "ammesso solo per APPROVALS" },
      "Il tipo di richiesta restringe solo una delega di approvazioni",
      "DELEGATION_OBJECT_INVALID",
    );
  }
  if ((dati.scope === "PROCESS_STEP") !== (dati.tenantProcessStepId !== null)) {
    throw new UnprocessableEntityError(
      { tenantProcessStepId: dati.scope === "PROCESS_STEP" ? "obbligatoria" : "ammessa solo per PROCESS_STEP" },
      "L'attività di processo vale solo, e sempre, per una delega di attività",
      "DELEGATION_OBJECT_INVALID",
    );
  }
  await verificaPersone(tenantId, dati.delegatorUserId, dati.delegateUserId);

  if (delegationKindOf(dati.scope) === "CHAIN") {
    if (!(await isInDelegationChain(pool, dati.delegatorUserId, dati.delegateUserId))) {
      throw new UnprocessableEntityError(
        { delegateUserId: "fuori dalla catena del delegante" },
        "Si delega solo a una persona della propria catena",
        "DELEGATION_OUT_OF_CHAIN",
      );
    }
    if (dati.tenantProcessStepId) {
      const unita = await repo.processStepUnit(pool, tenantId, dati.tenantProcessStepId);
      if (unita === undefined) {
        throw new UnprocessableEntityError(
          { tenantProcessStepId: "inesistente o di un altro tenant" },
          "Attività di processo inesistente",
          "DELEGATION_OBJECT_INVALID",
        );
      }
      const mie = await ownUnitIds(pool, dati.delegatorUserId);
      if (unita === null || !mie.includes(unita)) {
        throw new UnprocessableEntityError(
          { tenantProcessStepId: "non è un'attività del delegante" },
          "Si delega solo un'attività propria",
          "DELEGATION_NOT_OWN_ACTIVITY",
        );
      }
    }
  }

  // Delega e avviso nella stessa transazione: una delega senza il suo avviso, o un avviso
  // senza la delega, non devono poter esistere.
  const creata = await withTransaction(async (client) => {
    const d = await repo.createDelegation(client, tenantId, {
      delegatorUserId: dati.delegatorUserId,
      delegateUserId: dati.delegateUserId,
      scope: dati.scope,
      groups: dati.groups,
      requestType: dati.requestType,
      tenantProcessStepId: dati.tenantProcessStepId,
      startsOn: dati.startsOn,
      endsOn: dati.endsOn,
      reason: dati.reason,
      actorId,
    });
    // Chi riceve la delega lo sa subito, con quello che gli è stato affidato. Nessun
    // `resourceType`: il CHECK degli avvisi non conosce le deleghe, e il collegamento basta.
    await emitNotification(client, {
      tenantId,
      userId: d.delegateUserId,
      type: "SYSTEM",
      subject: `${d.delegatorName ?? "Il tuo responsabile"} ti ha delegato ${
        d.scope === "PROCESS_STEP" ? `l'attività «${d.tenantProcessStepName ?? ""}»` : "le sue approvazioni"
      } dal ${d.startsOn}${d.endsOn ? ` al ${d.endsOn}` : ""}`,
      body: d.reason,
      priority: "INFO",
      actionUrl: "/me/delegations",
      createdBy: actorId,
    });
    return d;
  });
  return (await conCatena([creata]))[0]!;
}

