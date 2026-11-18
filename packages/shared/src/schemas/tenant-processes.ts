/**
 * packages/shared/src/schemas/tenant-processes.ts — i processi del tenant e il loro responsabile.
 *
 * ADR-0060, piano `docs/piani/PIANO_applet-assistente_20261118.md`, voce P3: prima di questa rotta
 * il responsabile di un processo (`sys.sys_tenant_processes.tenant_process_owner_position_id`) si
 * scriveva solo da script. È l'azione che il caso guida delle applet («processi senza un
 * responsabile in carica») chiede. L'annullamento è la stessa rotta con il valore precedente, che
 * la risposta restituisce.
 */
import { z } from "zod";

export const TenantProcessIdParamSchema = z.object({ id: z.uuid() });
export type TenantProcessIdParam = z.infer<typeof TenantProcessIdParamSchema>;

export const TenantProcessSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  ownerPositionId: z.uuid().nullable(),
  ownerPositionTitle: z.string().nullable(),
  /** Vero se la posizione responsabile ha almeno un titolare con assegnazione `ACTIVE`. */
  ownerCovered: z.boolean(),
});
export type TenantProcess = z.infer<typeof TenantProcessSchema>;

export const UpdateTenantProcessOwnerBodySchema = z.object({
  /** La posizione che risponde del processo, dello stesso tenant; `null` la toglie. */
  ownerPositionId: z.uuid().nullable(),
});
export type UpdateTenantProcessOwnerBody = z.infer<typeof UpdateTenantProcessOwnerBodySchema>;

export const UpdateTenantProcessOwnerResponseSchema = z.object({
  process: TenantProcessSchema,
  /** Il valore di prima: rimandarlo alla stessa rotta annulla la modifica. */
  previousOwnerPositionId: z.uuid().nullable(),
});
export type UpdateTenantProcessOwnerResponse = z.infer<typeof UpdateTenantProcessOwnerResponseSchema>;
