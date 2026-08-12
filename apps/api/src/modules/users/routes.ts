/**
 * apps/api/src/modules/users/routes.ts
 * 8 endpoints under /v1/users with Zod validation, RBAC enforcement,
 * CSRF opt-in on mutations.
 *
 * Per API_IMPLEMENTATION_PLAN §6 + AUTH_SECURITY_PLAN §6.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actorFromReq } from "../../lib/actor.js";

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
import { UserDossierParamSchema, UserDossierSchema } from "@heuresys/shared";
import { usersService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const usersRoutes: FastifyPluginAsyncZod = async (app) => {
  /* --- GET /v1/users (list, scope-filtered) ------------------------ */
  app.get(
    "/",
    {
      config: { orgGate: "service" },
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
      config: { orgGate: "service" },
      preHandler: [requirePermission("user:read")],
      schema: { params: UserIdParamSchema, response: { 200: UserSchema } },
    },
    async (req) => usersService.getById(actorFromReq(req), req.params.id),
  );

  /* --- GET /v1/users/:userId/dossier (#81) --------------------------
     La scheda di una persona raccontata: posizione, contratto, retribuzione,
     presenze, formazione, competenze, valutazioni, obiettivi, carriera.
     Dati SENSIBILI → cancello organizzativo nel service (ADR-0027, I18). */
  app.get(
    "/:userId/dossier",
    {
      config: { orgGate: "service" },
      preHandler: [requirePermission("user:read")],
      schema: { params: UserDossierParamSchema, response: { 200: UserDossierSchema } },
    },
    async (req) => usersService.getDossier(actorFromReq(req), req.params.userId),
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

  /* --- DELETE /v1/users/:id/purge (hard → revoca di creazione) ----- */
  /* Distinta dalla soft di proposito: la cancellazione fisica NON è una
     variante della disattivazione, è il rimedio all'utente creato per errore
     (ADR-0037). Risponde 409 USER_HAS_HISTORY appena esiste una riga di storia
     operativa, elencando quali tabelle la trattengono. */
  app.delete(
    "/:id/purge",
    {
      preHandler: [app.verifyCsrf, requirePermission("user:delete")],
      schema: {
        params: UserIdParamSchema,
        response: { 204: EmptyResponseSchema },
      },
    },
    async (req, reply) => {
      await usersService.purge(actorFromReq(req), req.params.id);
      reply.code(204).send({});
    },
  );

  /* --- GET /v1/users/:id/roles ------------------------------------- */
  app.get(
    "/:id/roles",
    {
      config: { orgGate: "service" },
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
