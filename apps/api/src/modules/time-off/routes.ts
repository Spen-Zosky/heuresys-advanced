/**
 * apps/api/src/modules/time-off/routes.ts — /v1/time-off/* (A/L8, #33). READ-only.
 * Leave = PERSONAL. Requests + balance-transactions expose person rows → orgGate
 * "service" (resolveOrgReadScope in the service). Accrual rules are tenant policy
 * with no person rows → orgGate "catalog". ESS self views live in the `me` module.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  TimeOffRequestListQuerySchema, TimeOffRequestListResponseSchema,
  LeaveAccrualRuleListQuerySchema, LeaveAccrualRuleListResponseSchema,
  LeaveBalanceTransactionListQuerySchema, LeaveBalanceTransactionListResponseSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { timeOffService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const timeOffRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/requests", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("leave:read")],
    schema: {
      querystring: TimeOffRequestListQuerySchema,
      response: { 200: TimeOffRequestListResponseSchema },
    },
  }, async (req) => timeOffService.listRequests(actor(req), req.query));

  app.get("/accrual-rules", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("leave:read")],
    schema: {
      querystring: LeaveAccrualRuleListQuerySchema,
      response: { 200: LeaveAccrualRuleListResponseSchema },
    },
  }, async (req) => timeOffService.listAccrualRules(actor(req), req.query));

  app.get("/balance-transactions", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("leave:read")],
    schema: {
      querystring: LeaveBalanceTransactionListQuerySchema,
      response: { 200: LeaveBalanceTransactionListResponseSchema },
    },
  }, async (req) => timeOffService.listBalanceTransactions(actor(req), req.query));
};
