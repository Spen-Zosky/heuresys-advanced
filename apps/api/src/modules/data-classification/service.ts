/**
 * apps/api/src/modules/data-classification/service.ts — #262.
 * Nessuno scope organizzativo: la tabella classifica lo SCHEMA (I23), non un
 * dato di cliente — RBAC (data_classification:read) è l'unico cancello.
 */
import { pool } from "../../db/client.js";
import type { DataClassificationListResponse, DataClassificationTotals } from "@heuresys/shared";
import * as repo from "./repository.js";

export const dataClassificationService = {
  async list(): Promise<DataClassificationListResponse> {
    const items = await repo.listAll(pool);
    const totals: DataClassificationTotals = { nativo: 0, importato: 0, ibrido: 0, infrastruttura: 0 };
    for (const it of items) totals[it.stato]++;
    return { items, totals };
  },
};
