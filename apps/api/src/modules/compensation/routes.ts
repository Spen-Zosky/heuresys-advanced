/**
 * apps/api/src/modules/compensation/routes.ts
 * 4 endpoints under /v1/compensation.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import { z } from "zod";
import {
  CompensationProfileSchema,
  CompensationProfilePositionParamSchema,
  RewardGatesListQuerySchema,
  RewardGatesListResponseSchema,
  CompensationDistributionResponseSchema,
  PayoutCurveListResponseSchema,
  CompensationRecommendationSchema,
  CreateCompensationRecommendationBodySchema,
  PayrollHandoffRecordSchema,
  CreatePayrollHandoffRecordBodySchema,
  VariablePayCalculationListQuerySchema,
  VariablePayCalculationListResponseSchema,
  VariablePayEvaluationSchema,
  CompensationRecommendationListQuerySchema,
  CompensationRecommendationListResponseSchema,
  BonusPoolListQuerySchema,
  BonusPoolListResponseSchema,
  ObjectiveRewardRuleListQuerySchema,
  ObjectiveRewardRuleListResponseSchema,
  PositionEconomicWeightListQuerySchema,
  PositionEconomicWeightListResponseSchema,
  PayrollHandoffRecordListQuerySchema,
  PayrollHandoffRecordListResponseSchema,
  CompensationBandListQuerySchema,
  CompensationBandListResponseSchema,
} from "@heuresys/shared";
import { compensationService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const compensationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/profiles/:positionId", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: { params: CompensationProfilePositionParamSchema, response: { 200: CompensationProfileSchema } },
  }, async (req) => compensationService.getProfileByPosition(actor(req), req.params.positionId));

  // #53 E4 — catalogo delle fasce retributive. Stessa porta delle altre letture
  // compensation: chi vede i profili vede le fasce su cui sono costruiti.
  app.get("/bands", {
    // `catalog` come le altre letture di catalogo del modulo: il listato è per fascia,
    // non per persona — nessuna riga riferita a un individuo esce da qui. La guardia
    // prescrittiva di D-51 rifiuta l'avvio se questa dichiarazione manca, e ha fatto
    // esattamente il suo mestiere quando l'avevo dimenticata.
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: {
      querystring: CompensationBandListQuerySchema,
      response: { 200: CompensationBandListResponseSchema },
    },
  }, async (req) => compensationService.listCompensationBands(actor(req), req.query));

  app.get("/reward-gates", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: { querystring: RewardGatesListQuerySchema, response: { 200: RewardGatesListResponseSchema } },
  }, async (req) => compensationService.listRewardGates(actor(req), req.query));

  app.get("/payout-curves", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: { response: { 200: PayoutCurveListResponseSchema } },
  }, async (req) => compensationService.listPayoutCurves(actor(req)));

  app.get("/distribution", {
    config: { orgGate: "aggregate" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: { response: { 200: CompensationDistributionResponseSchema } },
  }, async (req) => compensationService.getRewardGateDistribution(actor(req)));

  app.post("/recommendations", {
    preHandler: [app.verifyCsrf, requirePermission("compensation_intelligence:update")],
    schema: { body: CreateCompensationRecommendationBodySchema, response: { 201: CompensationRecommendationSchema } },
  }, async (req, reply) => {
    const rec = await compensationService.createRecommendation(actor(req), req.body);
    reply.code(201).send(rec);
  });

  app.post("/handoff-records", {
    preHandler: [app.verifyCsrf, requirePermission("compensation_intelligence:update")],
    schema: { body: CreatePayrollHandoffRecordBodySchema, response: { 201: PayrollHandoffRecordSchema } },
  }, async (req, reply) => {
    const h = await compensationService.createHandoffRecord(actor(req), req.body);
    reply.code(201).send(h);
  });

  // ── A/L7 (#32) reads over six dormant compensation & reward tables ───────────
  // variable-pay & recommendations expose per-person rows → orgGate "service"
  // (resolveOrgReadScope in the service). The rest carry no person rows → "catalog".

  app.get("/variable-pay", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: {
      querystring: VariablePayCalculationListQuerySchema,
      response: { 200: VariablePayCalculationListResponseSchema },
    },
  }, async (req) => compensationService.listVariablePay(actor(req), req.query));

  // #37 (B2) — la valutazione di un singolo calcolo: curva + cancelli.
  app.get("/variable-pay/:id/evaluation", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: {
      params: z.object({ id: z.uuid() }),
      response: { 200: VariablePayEvaluationSchema },
    },
  }, async (req) => compensationService.evaluateVariablePay(actor(req), req.params.id));

  app.get("/recommendations", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: {
      querystring: CompensationRecommendationListQuerySchema,
      response: { 200: CompensationRecommendationListResponseSchema },
    },
  }, async (req) => compensationService.listRecommendations(actor(req), req.query));

  app.get("/bonus-pools", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: {
      querystring: BonusPoolListQuerySchema,
      response: { 200: BonusPoolListResponseSchema },
    },
  }, async (req) => compensationService.listBonusPools(actor(req), req.query));

  app.get("/objective-reward-rules", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: {
      querystring: ObjectiveRewardRuleListQuerySchema,
      response: { 200: ObjectiveRewardRuleListResponseSchema },
    },
  }, async (req) => compensationService.listObjectiveRewardRules(actor(req), req.query));

  app.get("/position-economic-weight", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: {
      querystring: PositionEconomicWeightListQuerySchema,
      response: { 200: PositionEconomicWeightListResponseSchema },
    },
  }, async (req) => compensationService.listPositionEconomicWeight(actor(req), req.query));

  app.get("/handoff-records", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: {
      querystring: PayrollHandoffRecordListQuerySchema,
      response: { 200: PayrollHandoffRecordListResponseSchema },
    },
  }, async (req) => compensationService.listPayrollHandoffRecords(actor(req), req.query));
};
