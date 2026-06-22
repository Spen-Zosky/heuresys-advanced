/**
 * apps/api/src/modules/public-stats/routes.ts — /v1/public.
 * GET /platform-stats = PUBLIC (no auth, no CSRF), per-IP rate-limited,
 * aggregate-only (no PII). Feeds the GTM investor one-pager's live metric tiles.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { PlatformStatsResponseSchema } from "@heuresys/shared";
import { publicStatsService } from "./service.js";

export const publicStatsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/platform-stats",
    {
      config: { rateLimit: { max: 30, timeWindow: 60 * 1000 } },
      schema: { response: { 200: PlatformStatsResponseSchema } },
    },
    async () => publicStatsService.get(),
  );
};
