"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { attachCrossHair } from "@/lib/table-cursor";

/**
 * Data table with optional cross-hair affordance.
 * Spec: docs/13_best_practices_for_modern_saas_ui.md § "Table cross-hair pattern".
 *
 * When enableCrossHair=true, attaches mouseenter/leave handlers on every
 * <th> and <td> to highlight column + cell intersection. Row hover is
 * handled by global CSS rule on tbody tr:hover.
 *
 * For tables in @heuresys/ui consider data-table.tsx (TanStack) instead;
 * this component is for the brand bundle showcase / raw HTML scenarios.
 */

export type DataTableWithCrossHairProps = Readonly<{
  caption?: ReactNode;
  enableCrossHair?: boolean;
  children: ReactNode;
  className?: string;
}>;

export function DataTableWithCrossHair({
  caption,
  enableCrossHair = true,
  children,
  className,
}: DataTableWithCrossHairProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (!enableCrossHair || !tableRef.current) return;
    const unbind = attachCrossHair(tableRef.current);
    return unbind;
  }, [enableCrossHair]);

  return (
    <div className="overflow-x-auto">
      <table ref={tableRef} className={`w-full text-sm ${className ?? ""}`.trim()}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}
