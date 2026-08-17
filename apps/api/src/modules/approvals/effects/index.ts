/**
 * apps/api/src/modules/approvals/effects/index.ts
 * Registers every apply-effect handler (import this module for the registration
 * side-effect) and re-exports the registry accessor. service.ts imports this so the
 * handlers are registered as soon as the approvals module is loaded.
 */
import { registerApplyEffect } from "./registry.js";
import { TENANT_ACTIVATION, applyTenantActivation } from "./tenant-activation.js";
import { TENANT_MATERIALIZATION, applyTenantMaterialization } from "./tenant-materialization.js";
import {
  TENANT_BLUEPRINT_APPROVAL,
  applyTenantBlueprintApproval,
} from "./tenant-blueprint-approval.js";
import {
  TENANT_BLUEPRINT_APPLICATION,
  applyTenantBlueprintApplication,
} from "./tenant-blueprint-application.js";
import { TIME_OFF_REQUEST, applyTimeOffRequest } from "./time-off-request.js";

registerApplyEffect(TENANT_ACTIVATION, applyTenantActivation);
registerApplyEffect(TENANT_MATERIALIZATION, applyTenantMaterialization);
registerApplyEffect(TENANT_BLUEPRINT_APPROVAL, applyTenantBlueprintApproval);
// #198 T5 — l'atto che applica il fascicolo: APPROVED → APPLIED, costruzione, registro
// dell'origine e proiezione dell'identità, tutto nella stessa transazione.
registerApplyEffect(TENANT_BLUEPRINT_APPLICATION, applyTenantBlueprintApplication);
registerApplyEffect(TIME_OFF_REQUEST, applyTimeOffRequest);

export { getApplyEffect, registerApplyEffect } from "./registry.js";
export type { ApplyEffectHandler } from "./registry.js";
