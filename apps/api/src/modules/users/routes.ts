/**
 * apps/api/src/modules/users/routes.ts
 * 8 endpoints under /v1/users with Zod validation, RBAC enforcement,
 * CSRF opt-in on mutations.
 *
 * Per API_IMPLEMENTATION_PLAN §6 + AUTH_SECURITY_PLAN §6.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  UserSchema,
  UserListQuerySchema,
  UserListResponseSchema,
  CreateUserBodySchema,
  UpdateUserBodySchema,
  UserIdParamSchema,
  RoleGrantSchema,
  RoleGrantListResponseSchema,
  GrantRoleBodySchema,
  GrantIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { usersService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actorFromReq(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return {
    userId: req.user.userId,
    tenantId: req.user.tenantId,
    roles: req.user.roles,
  };
}

export const usersRoutes: FastifyPluginAsyncZod = async (app) => {
  /* --- GET /v1/users (list, scope-filtered) ------------------------ */
  app.get(
    "/",
    {
      preHandler: [requirePermission("user:read")],
      schema: {
        querystring: UserListQuerySchema,
        response: { 200: UserListResponseSchema },
      },
    },
    async (req) => usersService.list(actorFromReq(req), req.query),
  );

  /* --- GET /v1/users/:id ------------------------------------------- */
  app.get(
    "/:id",
    {
      preHandler: [requirePermission("user:read")],
      schema: { params: UserIdParamSchema, response: { 200: UserSchema } },
    },
    async (req) => usersService.getById(actorFromReq(req), req.params.id),
  );

  /* --- POST /v1/users ---------------------------------------------- */
  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("user:create")],
      schema: { body: CreateUserBodySchema, response: { 201: UserSchema } },
    },
    async (req, reply) => {
      const user = await usersService.create(actorFromReq(req), req.body);
      reply.code(201).send(user);
    },
  );

  /* --- PATCH /v1/users/:id ----------------------------------------- */
  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("user:update")],
      schema: {
        params: UserIdParamSchema,
        body: UpdateUserBodySchema,
        response: { 200: UserSchema },
      },
    },
    async (req) =>
      usersService.update(actorFromReq(req), req.params.id, req.body),
  );

  /* --- DELETE /v1/users/:id (soft → DEACTIVATED) ------------------- */
  app.delete(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("user:delete")],
      schema: {
        params: UserIdParamSchema,
        response: { 204: EmptyResponseSchema },
      },
    },
    async (req, reply) => {
      await usersService.deactivate(actorFromReq(req), req.params.id);
      reply.code(204).send({});
    },
  );

  /* --- GET /v1/users/:id/roles ------------------------------------- */
  app.get(
    "/:id/roles",
    {
      preHandler: [requirePermission("user:read")],
      schema: {
        params: UserIdParamSchema,
        response: { 200: RoleGrantListResponseSchema },
      },
    },
    async (req) => ({
      items: await usersService.listRoles(actorFromReq(req), req.params.id),
    }),
  );

  /* --- POST /v1/users/:id/roles ------------------------------------ */
  app.post(
    "/:id/roles",
    {
      preHandler: [app.verifyCsrf, requirePermission("role:assign")],
      schema: {
        params: UserIdParamSchema,
        body: GrantRoleBodySchema,
        response: { 201: RoleGrantSchema },
      },
    },
    async (req, reply) => {
      const grant = await usersService.grantRole(
        actorFromReq(req),
        req.params.id,
        req.body.roleCode,
        req.body.tenantId,
      );
      reply.code(201).send(grant);
    },
  );

  /* --- DELETE /v1/users/:id/roles/:grantId ------------------------- */
  app.delete(
    "/:id/roles/:grantId",
    {
      preHandler: [app.verifyCsrf, requirePermission("role:assign")],
      schema: {
        params: GrantIdParamSchema,
        response: { 204: EmptyResponseSchema },
      },
    },
    async (req, reply) => {
      await usersService.revokeRole(
        actorFromReq(req),
        req.params.id,
        req.params.grantId,
      );
      reply.code(204).send({});
    },
  );
};
