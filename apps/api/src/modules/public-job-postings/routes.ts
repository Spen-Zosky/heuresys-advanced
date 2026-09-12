/**
 * apps/api/src/modules/public-job-postings/routes.ts — /v1/public/job-postings.
 *
 * PUBBLICO: nessuna autenticazione, nessun CSRF (sola lettura), rate-limit per IP come
 * `/platform-stats`. E' la vetrina degli annunci per il prospect (ADR-0026): chi la legge
 * non ha un attore, quindi qui non c'e' ne' `requirePermission` ne' un perimetro — il
 * confine e' nel repository, che restituisce SOLO cio' che e' `PUBLISHED` e `PUBLIC`.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  PublicJobPostingSchema,
  PublicJobPostingListResponseSchema,
  PublicJobPostingIdParamSchema,
} from "@heuresys/shared";
import { NotFoundError } from "../../errors/index.js";
import * as repo from "./repository.js";

export const publicJobPostingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/job-postings",
    {
      config: { rateLimit: { max: 60, timeWindow: 60 * 1000 } },
      schema: { response: { 200: PublicJobPostingListResponseSchema } },
    },
    async () => repo.list(),
  );

  app.get(
    "/job-postings/:id",
    {
      config: { rateLimit: { max: 60, timeWindow: 60 * 1000 } },
      schema: {
        params: PublicJobPostingIdParamSchema,
        response: { 200: PublicJobPostingSchema },
      },
    },
    async (req) => {
      const trovato = await repo.getById(req.params.id);
      // 404 anche per un annuncio che ESISTE ma non e' pubblico: dire «c'e' ma non puoi»
      // confermerebbe l'esistenza di un annuncio interno a chi non deve saperlo.
      if (!trovato) throw new NotFoundError("JobPosting");
      return trovato;
    },
  );
};
