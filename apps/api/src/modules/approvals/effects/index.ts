/**
 * apps/api/src/modules/approvals/effects/index.ts
 * Registers every apply-effect handler (import this module for the registration
 * side-effect) and re-exports the registry accessor. service.ts imports this so the
 * handlers are registered as soon as the approvals module is loaded.
 */
import { registerApplyEffect } from "./registry.js";
import { TENANT_ACTIVATION, applyTenantActivation } from "./tenant-activation.js";
import { TENANT_MATERIALIZATION, applyTenantMaterialization } from "./tenant-materialization.js";

registerApplyEffect(TENANT_ACTIVATION, applyTenantActivation);
registerApplyEffect(TENANT_MATERIALIZATION, applyTenantMaterialization);

export { getApplyEffect, registerApplyEffect } from "./registry.js";
export type { ApplyEffectHandler } from "./registry.js";
