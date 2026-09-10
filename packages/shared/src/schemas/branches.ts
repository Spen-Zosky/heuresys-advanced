/**
 * packages/shared/src/schemas/branches.ts
 * B14 (2026-09-10) — le filiali, che esistevano nel database e non nel prodotto.
 *
 * `sys.sys_branches` contiene 6 righe e porta `branch_tenant_id`: è un dato DI CLIENTE, e la
 * lettura è filtrata per cliente (I5 — FK più filtro nel servizio, mai RLS). Non è un dato di
 * persona: codice, indirizzo, città, CAP, orari, zona regolamentare.
 *
 * Sola lettura, e la ragione è dichiarata: il mandato chiede che le filiali abbiano un'API, e
 * il primo bisogno misurato è leggerle — c'è un cruscotto `branch` e un ruolo `BRANCH_MANAGER`
 * che non avevano nulla da chiamare. La scrittura si aggiunge quando un compito la chiede,
 * non prima: un endpoint di scrittura senza un compito è superficie da difendere per niente.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

export const BranchSchema = z.object({
  branchId: z.string().uuid(),
  organizationUnitId: z.string().uuid(),
  code: z.string(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: z.string().nullable(),
  regionCode: z.string().nullable(),
  openingHours: z.record(z.string(), z.unknown()),
  regulatoryZone: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Branch = z.infer<typeof BranchSchema>;

export const BranchListQuerySchema = z.object({
  city: z.string().min(1).max(120).optional(),
  regionCode: z.string().min(1).max(16).optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type BranchListQuery = z.infer<typeof BranchListQuerySchema>;

export const BranchListResponseSchema = z.object({
  items: z.array(BranchSchema),
  total: z.number().int(),
});
export type BranchListResponse = z.infer<typeof BranchListResponseSchema>;

export const BranchIdParamSchema = z.object({ id: z.string().uuid() });
export type BranchIdParam = z.infer<typeof BranchIdParamSchema>;
