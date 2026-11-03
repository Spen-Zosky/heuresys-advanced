/**
 * FieldGrid shim — re-exports the primitive promoted to @heuresys/ui@0.1.8 (QW de-dup
 * follow-up to QW-E5). Kept as a stable local import path (`@/components/detail-panel`)
 * for existing consumers (positions/tenants/users detail pages). The component body now
 * lives once in ux-design-shared → @heuresys/ui.
 */
export { FieldGrid, type DetailField } from "@heuresys/ui";
