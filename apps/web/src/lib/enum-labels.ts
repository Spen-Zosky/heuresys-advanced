/**
 * apps/web/src/lib/enum-labels.ts — the enum label layer (census F4 S1026,
 * worklist P2 cluster 1: "layer label per gli enum di stato").
 *
 * Every status/kind/type enum the API returns is a SCREAMING_SNAKE (or
 * lowercase) machine code; rendering it raw leaks the wire format to the user
 * ("ON_TRACK", "MODERATE_GAP", "READY_NOW"...). This hook resolves a code to
 * its human label via the `common:enums.<domain>.<VALUE>` i18n map (IT/EN),
 * falling back to the raw code when a value is unmapped — same graceful
 * pattern as the F4-04 role-badge fix (shell:roles.*).
 *
 * Domains mirror the Zod enums in @heuresys/shared (and, for free-string
 * fields, the DISTINCT values measured live on the DB — S1026). Add new
 * values to BOTH locale files (pnpm i18n:check enforces parity).
 */

import { useTranslation } from "react-i18next";

export type EnumLabelFn = (domain: string, value: string | null | undefined) => string;

export function useEnumLabel(): EnumLabelFn {
  const { t } = useTranslation("common");
  return (domain, value) => {
    if (value === null || value === undefined || value === "") return "—";
    return t(`enums.${domain}.${value}`, { defaultValue: value });
  };
}
