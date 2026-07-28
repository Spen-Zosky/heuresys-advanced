/**
 * packages/shared/src/schemas/organization-unit-history.ts
 *
 * La storia di un'unità organizzativa: quando è nata, quando ha cambiato nome,
 * quando si è spostata sotto un altro ramo, quando è stata accorpata o sciolta.
 *
 * È un registro APPEND-ONLY: un evento accaduto non si modifica e non si
 * cancella: si aggiunge l'evento che lo corregge. Per questo il modulo espone
 * lettura e inserimento, non aggiornamento né rimozione.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";

export const ORGANIZATION_UNIT_CHANGE_TYPE_VALUES = [
  "CREATED", "RENAMED", "MOVED", "MERGED", "SPLIT", "DEACTIVATED", "REACTIVATED",
] as const;
export const OrganizationUnitChangeTypeSchema = z.enum(ORGANIZATION_UNIT_CHANGE_TYPE_VALUES);
export type OrganizationUnitChangeType = z.infer<typeof OrganizationUnitChangeTypeSchema>;

export const OrganizationUnitHistorySchema = z.object({
  organizationUnitHistoryId: z.uuid(),
  unitId: z.uuid(),
  tenantId: z.uuid(),
  changeType: OrganizationUnitChangeTypeSchema,
  oldValue: z.record(z.string(), z.unknown()),
  newValue: z.record(z.string(), z.unknown()),
  effectiveAt: z.iso.datetime(),
  actorUserId: z.uuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type OrganizationUnitHistory = z.infer<typeof OrganizationUnitHistorySchema>;

export const OrganizationUnitHistoryListQuerySchema = z.object({
  unitId: z.uuid().optional(),
  changeType: OrganizationUnitChangeTypeSchema.optional(),
  /** Finestra temporale sugli eventi: utile per leggere una riorganizzazione. */
  effectiveFrom: z.iso.date().optional(),
  effectiveTo: z.iso.date().optional(),
  ...paginationFields(200, 50),
});
export type OrganizationUnitHistoryListQuery = z.infer<typeof OrganizationUnitHistoryListQuerySchema>;

export const OrganizationUnitHistoryListResponseSchema = z.object({
  items: z.array(OrganizationUnitHistorySchema),
  total: z.number().int().min(0),
});

export const CreateOrganizationUnitHistoryBodySchema = z.object({
  unitId: z.uuid(),
  changeType: OrganizationUnitChangeTypeSchema,
  oldValue: z.record(z.string(), z.unknown()),
  newValue: z.record(z.string(), z.unknown()),
  effectiveAt: z.iso.datetime().optional(),
  notes: z.string().max(2000).nullable().optional(),
  tenantId: z.uuid().optional(),
});
export type CreateOrganizationUnitHistoryBody = z.infer<typeof CreateOrganizationUnitHistoryBodySchema>;

export const OrganizationUnitHistoryIdParamSchema = z.object({ id: z.uuid() });
