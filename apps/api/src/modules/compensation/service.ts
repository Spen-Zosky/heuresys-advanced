/**
 * apps/api/src/modules/compensation/service.ts
 * Decision-support layer for compensation intelligence + reward gates.
 * NOT payroll execution (invariant I8).
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { masksUnderPlatformMandate, masksTopOfChainPay, maskFields, type Masked } from "../../lib/scope/mask.js";
import { chainLevelOf } from "../../lib/scope/org.js";

/**
 * #124 — what goes when a compensation row is read under the platform mandate.
 *
 * `amountEur` is the obvious one. `narrative` goes because it is free text
 * written about the amount. `payload` goes WHOLE because it is an untyped
 * record that demonstrably carries pay data (measured 2026-08-04: every one of
 * the 116 rows holds `legacy.increase_percent`), and a partial mask over an
 * open record cannot be verified.
 */
const COMPENSATION_MONEY_FIELDS = ["amountEur", "narrative", "payload"] as const;

/**
 * #124 D3 (S1053) — la stessa regola sull'intera superficie del modulo.
 * Elenchi espliciti per endpoint, misurati sul dato reale prima di scrivere:
 * il payload di variable-pay porta attainment e curva; quello degli handoff
 * porta total_gross/total_net; lo score dei reward-gate e' un giudizio
 * per-persona. La riga resta sempre: periodi, stati, cataloghi, soggetti.
 */
const VARIABLE_PAY_MONEY_FIELDS = ["amountEur", "payload", "signalScore"] as const;
const VARIABLE_PAY_EVAL_MONEY_FIELDS = [
  "attainment", "curveExplanation", "curveFactor", "finalFactor", "recordedAmountEur",
] as const;
const REWARD_GATE_MASKED_FIELDS = ["payload"] as const;
const REWARD_GATE_RESULT_MASKED_FIELDS = ["payload", "score"] as const;
const BONUS_POOL_MONEY_FIELDS = ["payload", "totalEur"] as const;
const ECONOMIC_WEIGHT_MONEY_FIELDS = ["metadata", "value"] as const;
const HANDOFF_MONEY_FIELDS = ["payload"] as const;

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  CompensationProfile,
  RewardGatesListQuery,
  RewardGate,
  CompensationRecommendation,
  CreateCompensationRecommendationBody,
  PayrollHandoffRecord,
  CreatePayrollHandoffRecordBody,
  CompensationDistributionResponse,
  VariablePayCalculationListQuery,
  CompensationRecommendationListQuery,
  BonusPoolListQuery,
  ObjectiveRewardRuleListQuery,
  PositionEconomicWeightListQuery,
  PayrollHandoffRecordListQuery,
  VariablePayEvaluation,
  CompensationBandListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import {
  aggregateGates, payoutFactor, finalFactor,
  type GateOutcome, type PayoutCurveKind,
} from "./reward-engine.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

function requireTenant(a: ActorContext): string {
  if (!a.tenantId) {
    throw new ForbiddenError("Tenant context required", "TENANT_CONTEXT_REQUIRED");
  }
  return a.tenantId;
}

/** Reduce an OrgReadScope to the (tenantId?, userIdAllowList?) repo filter for the
 *  person-level compensation reads (A/L7 #32 — mirrors time-off/service.ts). */
async function orgFilter(
  actor: ActorContext,
): Promise<{ tenantId?: string; userIdAllowList?: string[] }> {
  const scope = await resolveOrgReadScope(pool, actor);
  switch (scope.kind) {
    case "all":
      return {};
    case "tenant":
      return { tenantId: scope.tenantId };
    case "subtree":
    case "self":
      return { tenantId: scope.tenantId, userIdAllowList: scope.userIdAllowList };
  }
}

/** Tenant filter for the catalog reads: PLATFORM_ADMIN → all tenants; else own tenant. */
function catalogTenant(actor: ActorContext): string | undefined {
  return isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
}

/**
 * [#99 F4] I due qualificatori che valgono sulla retribuzione, applicati insieme.
 *
 * Il primo (`masksUnderPlatformMandate`, #124) chiede «sei un amministratore tecnico?».
 * Il secondo (`masksTopOfChainPay`, ADR-0036 §5) chiede «stai abbastanza in alto per
 * vedere lo stipendio di un vertice?», e delimita perfino il mandato HR. Uno solo dei
 * due che dica di mascherare basta: sono limiti diversi, non alternative.
 *
 * I livelli si leggono UNA volta per richiesta e si passano dentro: farlo per riga
 * significherebbe una query ricorsiva per ogni stipendio in elenco.
 */
async function mascheraPaga(
  actor: ActorContext,
  soggetti: readonly (string | null)[],
): Promise<(userId: string | null) => boolean> {
  const distinti = [...new Set(soggetti.filter((x): x is string => x !== null))];
  const livelli = new Map<string, number | null>();
  const attore = await chainLevelOf(pool, actor.userId);
  await Promise.all(distinti.map(async (uid) => livelli.set(uid, await chainLevelOf(pool, uid))));
  return (userId: string | null) =>
    masksUnderPlatformMandate(actor, "COMPENSATION", userId) ||
    masksTopOfChainPay(actor, userId, attore, userId === null ? null : livelli.get(userId) ?? null);
}

export const compensationService = {
  async getProfileByPosition(actor: ActorContext, positionId: string): Promise<CompensationProfile> {
    const positionTenant = await repo.findPositionTenantId(pool, positionId);
    if (!positionTenant) throw new NotFoundError("Position");
    if (!isPlatform(actor) && positionTenant !== actor.tenantId) {
      throw new NotFoundError("Position");
    }
    const profile = await repo.findCompensationProfileByPositionId(pool, positionId);
    if (!profile) throw new NotFoundError("CompensationProfile");

    // #124 (S1055) — contraddizione interna sanata. Questo stesso modulo gia'
    // maschera `position-economic-weight` con la ragione «su una posizione con
    // un solo titolare il valore e' individuale»: MISURATO 2026-08-12, **280
    // posizioni su 299 hanno un solo titolare**, quindi la ragione vale identica
    // qui — e qui l'importo e' la BANDA, cioe' il dato piu' diretto dei due.
    // Restano visibili posizione, tenant e date: la riga esiste, il suo prezzo no.
    if (masksUnderPlatformMandate(actor, "COMPENSATION", null)) {
      return maskFields(profile, ["band", "economicWeight", "metadata", "rewardGatesApplied"]);
    }
    return profile;
  },

  async listRewardGates(
    actor: ActorContext,
    query: RewardGatesListQuery,
  ): Promise<{ items: Masked<RewardGate>[]; total: number }> {
    // ADR-0027 F3 (D-50): gate cross-user reward-gate reads by the actor's ORGANIZATIONAL
    // sub-tree. PLATFORM_ADMIN → all tenants; HR-mandated (TENANT_ADMIN, HRMS_MANAGER) →
    // whole tenant; managerial → transitive org sub-tree; everyone else → self.
    const scope = await resolveOrgReadScope(pool, actor);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    // A caller filtering by an explicit userId they may not read gets an empty page
    // (not another user's data) — mirrors the users-module per-target gate.
    if (query.userId && !(await canReadOrgTarget(pool, actor, query.userId, tenantId ?? null))) {
      return { items: [], total: 0 };
    }
    const page = await repo.listRewardGates(pool, { tenantId, userIdAllowList, query });
    // #124 D3: il cancello (catalogo, stato, periodo) resta leggibile; il
    // payload e lo SCORE per-persona dell'ultimo esito no.
    return {
      ...page,
      items: page.items.map((g) => {
        if (!masksUnderPlatformMandate(actor, "COMPENSATION", g.userId)) return g;
        const masked = maskFields(g, REWARD_GATE_MASKED_FIELDS);
        return g.latestResult
          ? { ...masked, latestResult: maskFields(g.latestResult, REWARD_GATE_RESULT_MASKED_FIELDS) }
          : masked;
      }),
    };
  },

  /** Le curve di payout visibili al chiamante: globali + quelle del proprio tenant. */
  async listPayoutCurves(actor: ActorContext) {
    const tenantId = isPlatform(actor) ? undefined : requireTenant(actor);
    return repo.listPayoutCurves(pool, tenantId);
  },

  async getRewardGateDistribution(actor: ActorContext): Promise<CompensationDistributionResponse> {
    const tenantId = isPlatform(actor) ? undefined : requireTenant(actor);
    return repo.getRewardGateStatusDistribution(pool, tenantId);
  },

  async createRecommendation(
    actor: ActorContext,
    body: CreateCompensationRecommendationBody,
  ): Promise<CompensationRecommendation> {
    // Sanity: target user must belong to actor's tenant (unless PLATFORM_ADMIN).
    const targetUserTenant = await repo.findUserTenantId(pool, body.userId);
    if (!targetUserTenant) throw new NotFoundError("User");
    let tenantId: string;
    if (isPlatform(actor)) {
      tenantId = targetUserTenant;
    } else {
      const myTenant = requireTenant(actor);
      if (targetUserTenant !== myTenant) {
        throw new NotFoundError("User");
      }
      tenantId = myTenant;
    }
    if (body.positionId) {
      const posTenant = await repo.findPositionTenantId(pool, body.positionId);
      if (!posTenant || posTenant !== tenantId) {
        throw new NotFoundError("Position");
      }
    }
    return repo.insertCompensationRecommendation(pool, tenantId, body);
  },

  async createHandoffRecord(
    actor: ActorContext,
    body: CreatePayrollHandoffRecordBody,
  ): Promise<PayrollHandoffRecord> {
    const tenantId = isPlatform(actor)
      ? (actor.tenantId ?? null)
      : requireTenant(actor);
    if (!tenantId) {
      throw new ForbiddenError(
        "PLATFORM_ADMIN must operate within a tenant context for handoff records",
        "TENANT_CONTEXT_REQUIRED",
      );
    }
    return repo.insertPayrollHandoffRecord(pool, tenantId, body);
  },


  // ── A/L7 (#32) reads ────────────────────────────────────────────────────────

  /** Org-gated per-person variable pay (I18), poi mascherato per il mandato
   *  piattaforma (#124 D3): l'importo, il punteggio e il payload (che porta
   *  attainment e curva) spariscono; periodo e soggetto restano. */
  async listVariablePay(actor: ActorContext, query: VariablePayCalculationListQuery) {
    const page = await repo.listVariablePay(pool, { ...(await orgFilter(actor)), query });
    const maschera = await mascheraPaga(actor, page.items.map((c) => c.userId));
    return {
      ...page,
      items: page.items.map((c) =>
        maschera(c.userId) ? maskFields(c, VARIABLE_PAY_MONEY_FIELDS) : c,
      ),
    };
  },

  /**
   * Org-gated per-person compensation recommendations (I18), then field-masked
   * for the platform mandate (#124).
   *
   * The two gates answer different questions and both have to run. The org gate
   * decides WHICH rows the actor may see at all; the mask decides which FIELDS
   * of a row they may read. A technical administrator keeps the first — they
   * must be able to see that a recommendation exists for July — and loses the
   * second, which is Enzo's decision of 2026-08-04.
   *
   * Masking happens HERE and not in the repository because the repository does
   * not know the actor, and not in the route because the route has already
   * handed the object to Zod. This is the last point where the true value is
   * still in hand and the response has not been serialized.
   */
  async listRecommendations(actor: ActorContext, query: CompensationRecommendationListQuery) {
    const page = await repo.listRecommendations(pool, { ...(await orgFilter(actor)), query });
    const maschera = await mascheraPaga(actor, page.items.map((r) => r.userId));
    return {
      ...page,
      items: page.items.map((rec) =>
        maschera(rec.userId) ? maskFields(rec, COMPENSATION_MONEY_FIELDS) : rec,
      ),
    };
  },

  /**
   * #37 (B2) — la valutazione di un calcolo: la curva dice quanto spetterebbe,
   * i cancelli dicono se spetta.
   *
   * È una LETTURA: non riscrive l'importo registrato. Espone il ragionamento
   * accanto al numero già in archivio, così i due si possono confrontare —
   * che è il primo motivo per cui un motore del genere serve.
   *
   * Il dato è COMPENSATION per-persona: passa dallo stesso cancello
   * organizzativo delle altre letture per-persona (I18).
   */
  async evaluateVariablePay(actor: ActorContext, id: string): Promise<Masked<VariablePayEvaluation>> {
    const calc = await repo.findVariablePayCalculationById(pool, id);
    if (!calc) throw new NotFoundError("VariablePayCalculation");
    // #124 D3: al mandato piattaforma resta il RAGIONAMENTO dei cancelli
    // (categoriale, gia' esposto da /distribution) e la curva citata; i numeri
    // — importo registrato, raggiungimento, fattori — no.
    const seal = (r: VariablePayEvaluation): Masked<VariablePayEvaluation> =>
      masksUnderPlatformMandate(actor, "COMPENSATION", calc.userId)
        ? maskFields(r, VARIABLE_PAY_EVAL_MONEY_FIELDS)
        : r;

    // Cancello organizzativo: si riusa la lista già filtrata invece di
    // duplicare la logica di visibilità. Se il calcolo non compare fra quelli
    // visibili all'attore, per lui non esiste.
    const visible = await repo.listVariablePay(pool, {
      ...(await orgFilter(actor)),
      query: { userId: calc.userId, limit: 200, offset: 0 },
    });
    if (!visible.items.some((c) => c.variablePayCalculationId === id)) {
      throw new NotFoundError("VariablePayCalculation");
    }

    const outcomes = await repo.listGateOutcomesForPeriod(
      pool, calc.userId, calc.periodStart, calc.periodEnd,
    );
    const gates: GateOutcome[] = outcomes.map((o) => ({
      gateCode: o.gateCode,
      gateName: o.gateName,
      isBlocking: o.isBlocking,
      status: o.status as GateOutcome["status"],
      overrideReason: o.overrideReason,
    }));
    const aggregate = aggregateGates(gates);

    // La curva e il raggiungimento vivono nel payload del calcolo. Quando non
    // ci sono — è il caso delle righe importate dal sistema precedente — la
    // parte "curva" non si inventa: si dichiara non calcolabile.
    const curveCode = typeof calc.payload["curve"] === "string" ? (calc.payload["curve"] as string) : null;
    const rawAttainment = calc.payload["attainment"];
    const attainment =
      typeof rawAttainment === "number" ? rawAttainment
      : typeof rawAttainment === "string" && rawAttainment.trim() !== "" && Number.isFinite(Number(rawAttainment))
        ? Number(rawAttainment)
        : null;

    const base = {
      variablePayCalculationId: calc.variablePayCalculationId,
      userId: calc.userId,
      periodStart: calc.periodStart,
      periodEnd: calc.periodEnd,
      recordedAmountEur: calc.amountEur,
      gates,
      gateDecision: aggregate.decision,
      gateExplanation: aggregate.explanation,
    };

    if (curveCode === null || attainment === null) {
      return seal({
        ...base,
        attainment, curveCode, curveKind: null, curveFactor: null, curveExplanation: null,
        finalFactor: null,
        notEvaluable: curveCode === null
          ? "Il calcolo non dichiara una curva di erogazione (riga importata dal sistema precedente)"
          : "Il calcolo non dichiara un raggiungimento",
      });
    }

    const curves = await repo.listPayoutCurves(pool, catalogTenant(actor));
    const curve = curves.items.find((c) => c.code === curveCode);
    if (!curve) {
      return seal({
        ...base,
        attainment, curveCode, curveKind: null, curveFactor: null, curveExplanation: null,
        finalFactor: null,
        notEvaluable: `La curva '${curveCode}' citata dal calcolo non esiste nel catalogo`,
      });
    }

    const factor = payoutFactor(
      { code: curve.code, kind: curve.kind as PayoutCurveKind, payload: curve.payload },
      attainment,
    );
    return seal({
      ...base,
      attainment,
      curveCode: curve.code,
      curveKind: curve.kind,
      curveFactor: factor.factor,
      curveExplanation: factor.explanation,
      finalFactor: finalFactor(factor.factor, aggregate.decision),
      notEvaluable: null,
    });
  },

  /** Tenant/OU bonus pools (no person rows) — tenant-scoped only.
   *  #124 D3 / vincolo 5: la massa monetaria di un'unita' e' COMPENSATION
   *  aggregata (soggetto null → il mask morde sul platform actor puro). */
  async listBonusPools(actor: ActorContext, query: BonusPoolListQuery) {
    const page = await repo.listBonusPools(pool, catalogTenant(actor), query);
    if (!masksUnderPlatformMandate(actor, "COMPENSATION", null)) return page;
    return { ...page, items: page.items.map((b) => maskFields(b, BONUS_POOL_MONEY_FIELDS)) };
  },

  /**
   * #53 E4 — catalogo delle fasce retributive del tenant.
   *
   * Le fasce esistevano in tabella e nessuna API le elencava: si vedevano solo di
   * riflesso, risolte per una singola posizione. Chi deve confrontare l'inquadramento
   * di un ruolo con la fascia che gli compete non aveva dove farlo.
   */
  async listCompensationBands(actor: ActorContext, query: CompensationBandListQuery) {
    return repo.listCompensationBands(pool, catalogTenant(actor) ?? null, {
      withValueOnly: query.withValueOnly,
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
      offset: query.offset,
    });
  },

  /** Tenant objective reward-rule catalog — tenant-scoped only. */
  async listObjectiveRewardRules(actor: ActorContext, query: ObjectiveRewardRuleListQuery) {
    return repo.listObjectiveRewardRules(pool, catalogTenant(actor), query);
  },

  /** Position economic weight — tenant-scoped only (no person rows).
   *  #124 D3: sulle posizioni mono-titolare il valore e' un proxy dello
   *  stipendio (punti di job evaluation): mascherato al mandato piattaforma. */
  async listPositionEconomicWeight(actor: ActorContext, query: PositionEconomicWeightListQuery) {
    const page = await repo.listPositionEconomicWeight(pool, catalogTenant(actor), query);
    if (!masksUnderPlatformMandate(actor, "COMPENSATION", null)) return page;
    return { ...page, items: page.items.map((w) => maskFields(w, ECONOMIC_WEIGHT_MONEY_FIELDS)) };
  },

  /** Tenant payroll handoff records (no user column) — tenant-scoped only.
   *  #124 D3: il payload porta total_gross/total_net del cedolino mensile
   *  (misurato) — al mandato piattaforma resta il fatto della consegna. */
  async listPayrollHandoffRecords(actor: ActorContext, query: PayrollHandoffRecordListQuery) {
    const page = await repo.listPayrollHandoffRecords(pool, catalogTenant(actor), query);
    if (!masksUnderPlatformMandate(actor, "COMPENSATION", null)) return page;
    return { ...page, items: page.items.map((h) => maskFields(h, HANDOFF_MONEY_FIELDS)) };
  },
};
