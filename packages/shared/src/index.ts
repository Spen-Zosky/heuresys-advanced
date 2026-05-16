/**
 * packages/shared/src/index.ts
 * Barrel export — keep this list curated. Internal modules can be imported
 * via the subpath exports (e.g. `@heuresys/shared/schemas/auth`) when you
 * need tree-shaking or a smaller surface.
 */

export * from "./schemas/role-codes.js";
export * from "./schemas/auth.js";
export * from "./schemas/tenants.js";
