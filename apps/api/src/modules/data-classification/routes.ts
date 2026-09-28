/**
 * apps/api/src/modules/data-classification/routes.ts — /v1/data-classification (#262).
 * READ-only registro I23/ADR-0041: la direzione del dato per ogni tabella
 * sys.sys_* di dato cliente (nativo/importato/ibrido/infrastruttura). Il
 * cancello è data_classification:read (DATA_STEWARD, mig 000453) — nessun
 * filtro di tenant: la tabella classifica lo schema, non un dato di cliente.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { DataClassificationListResponseSchema } from "@heuresys/shared";
import { dataClassificationService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const dataClassificationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("data_classification:read")],
      schema: { response: { 200: DataClassificationListResponseSchema } },
    },
    async () => dataClassificationService.list(),
  );
};
