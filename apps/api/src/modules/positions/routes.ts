/**
 * apps/api/src/modules/positions/routes.ts
 * 15 endpoints under /v1/positions: core CRUD + PIP read + skill sub-CRUD
 * + KPI sub-resource read. RBAC + CSRF on mutations.
 *
 * Per API_IMPLEMENTATION_PLAN §6.3.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actorFromReq } from "../../lib/actor.js";

import {
  PositionSchema,
  PositionListQuerySchema,
  PositionListResponseSchema,
  CreatePositionBodySchema,
  UpdatePositionBodySchema,
  PositionIdParamSchema,
  PositionIntelligenceProfileSchema,
  PositionSkillRequirementSchema,
  PositionSkillListResponseSchema,
  AddPositionSkillBodySchema,
  PositionSkillIdParamSchema,
  PositionKpiListResponseSchema,
  PositionLearningRequirementListResponseSchema,
  PositionLearningModuleListResponseSchema,
  PositionKpiRequirementSchema,
  AddPositionKpiBodySchema,
  UpdatePositionKpiBodySchema,
  PositionKpiIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { positionsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const positionsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("position:read")],
      schema: { querystring: PositionListQuerySchema, response: { 200: PositionListResponseSchema } },
    },
    async (req) => positionsService.list(actorFromReq(req), req.query),
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("position:read")],
      schema: { params: PositionIdParamSchema, response: { 200: PositionSchema } },
    },
    async (req) => positionsService.getById(actorFromReq(req), req.params.id),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("position:create")],
      schema: { body: CreatePositionBodySchema, response: { 201: PositionSchema } },
    },
    async (req, reply) => {
      const created = await positionsService.create(actorFromReq(req), req.body);
      reply.code(201).send(created);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("position:update")],
      schema: {
        params: PositionIdParamSchema,
        body: UpdatePositionBodySchema,
        response: { 200: PositionSchema },
      },
    },
    async (req) =>
      positionsService.update(actorFromReq(req), req.params.id, req.body),
  );

  app.delete(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("position:delete")],
      schema: { params: PositionIdParamSchema, response: { 204: EmptyResponseSchema } },
    },
    async (req, reply) => {
      await positionsService.softDelete(actorFromReq(req), req.params.id);
      reply.code(204).send({});
    },
  );

  /* --- PIP (ADR-0008 view) ----------------------------------------- */
  app.get(
    "/:id/intelligence-profile",
    {
      preHandler: [requirePermission("position:read")],
      schema: {
        params: PositionIdParamSchema,
        response: { 200: PositionIntelligenceProfileSchema },
      },
    },
    async (req) => positionsService.getIntelligenceProfile(actorFromReq(req), req.params.id),
  );

  /* --- skills sub-resource ----------------------------------------- */
  app.get(
    "/:id/skills",
    {
      preHandler: [requirePermission("position:read")],
      schema: {
        params: PositionIdParamSchema,
        response: { 200: PositionSkillListResponseSchema },
      },
    },
    async (req) => ({
      items: await positionsService.listSkills(actorFromReq(req), req.params.id),
    }),
  );

  app.post(
    "/:id/skills",
    {
      preHandler: [app.verifyCsrf, requirePermission("position:update")],
      schema: {
        params: PositionIdParamSchema,
        body: AddPositionSkillBodySchema,
        response: { 201: PositionSkillRequirementSchema },
      },
    },
    async (req, reply) => {
      const created = await positionsService.addSkill(
        actorFromReq(req),
        req.params.id,
        req.body,
      );
      reply.code(201).send(created);
    },
  );

  app.delete(
    "/:id/skills/:skillId",
    {
      preHandler: [app.verifyCsrf, requirePermission("position:update")],
      schema: {
        params: PositionSkillIdParamSchema,
        response: { 204: EmptyResponseSchema },
      },
    },
    async (req, reply) => {
      await positionsService.removeSkill(
        actorFromReq(req),
        req.params.id,
        req.params.skillId,
      );
      reply.code(204).send({});
    },
  );

  /* --- learning bridge (#25 A/L5: read-only) ------------------------ */
  app.get(
    "/:id/learning-requirements",
    {
      preHandler: [requirePermission("position:read")],
      schema: {
        params: PositionIdParamSchema,
        response: { 200: PositionLearningRequirementListResponseSchema },
      },
    },
    async (req) => ({
      items: await positionsService.listLearningRequirements(actorFromReq(req), req.params.id),
    }),
  );

  app.get(
    "/:id/learning-modules",
    {
      preHandler: [requirePermission("position:read")],
      schema: {
        params: PositionIdParamSchema,
        response: { 200: PositionLearningModuleListResponseSchema },
      },
    },
    async (req) => ({
      items: await positionsService.listLearningModules(actorFromReq(req), req.params.id),
    }),
  );

  /* --- KPI sub-resource (WI-D2: read + ranked write) --------------- */
  app.get(
    "/:id/kpis",
    {
      preHandler: [requirePermission("position:read")],
      schema: {
        params: PositionIdParamSchema,
        response: { 200: PositionKpiListResponseSchema },
      },
    },
    async (req) => ({
      items: await positionsService.listKpis(actorFromReq(req), req.params.id),
    }),
  );

  app.post(
    "/:id/kpis",
    {
      preHandler: [app.verifyCsrf, requirePermission("position:update")],
      schema: {
        params: PositionIdParamSchema,
        body: AddPositionKpiBodySchema,
        response: { 201: PositionKpiRequirementSchema },
      },
    },
    async (req, reply) => {
      const created = await positionsService.addKpi(actorFromReq(req), req.params.id, req.body);
      reply.code(201).send(created);
    },
  );

  app.patch(
    "/:id/kpis/:kpiId",
    {
      preHandler: [app.verifyCsrf, requirePermission("position:update")],
      schema: {
        params: PositionKpiIdParamSchema,
        body: UpdatePositionKpiBodySchema,
        response: { 200: PositionKpiRequirementSchema },
      },
    },
    async (req) =>
      positionsService.updateKpi(actorFromReq(req), req.params.id, req.params.kpiId, req.body),
  );

  app.delete(
    "/:id/kpis/:kpiId",
    {
      preHandler: [app.verifyCsrf, requirePermission("position:update")],
      schema: {
        params: PositionKpiIdParamSchema,
        response: { 204: EmptyResponseSchema },
      },
    },
    async (req, reply) => {
      await positionsService.removeKpi(actorFromReq(req), req.params.id, req.params.kpiId);
      reply.code(204).send({});
    },
  );
};
