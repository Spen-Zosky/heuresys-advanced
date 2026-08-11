"use client";

/**
 * apps/web/src/components/masked-cell.tsx — la cella che dice di essere vuota
 * apposta (#124 D6, ADR-0032).
 *
 * PERCHE' ESISTE. Il contratto sceglie l'ASSENZA invece di un segnaposto: un
 * importo sostituito da `0` o da `null` e' una bugia, perche' chi guarda non puo'
 * distinguere «non ti e' permesso vederlo» da «non c'e' niente». Il campo e'
 * quindi assente e il suo nome viaggia in `masked` (`lib/scope/mask.ts`).
 * Se l'interfaccia rendesse quel campo come «—» rimetterebbe in piedi
 * esattamente l'ambiguita' che il contratto ha tolto: la scritta e' la seconda
 * meta' del meccanismo, non un abbellimento.
 *
 * DOVE VIVE. In `apps/web/src/components/` e non in `@heuresys/ui`: dipende dal
 * contratto `masked` degli schemi Zod di `@heuresys/shared`, quindi e'
 * heuresys-advanced-specific per la regola del CLAUDE.md. Nasce qui perche'
 * serviva a quattro pagine — prima viveva dentro `compensation-intelligence`.
 *
 * NON e' un cancello: se un valore arriva al client, il mask e' gia' fallito a
 * monte e la correzione va fatta nell'API, mai qui.
 */

import { useTranslation } from "react-i18next";

export function MaskedCell({ className = "" }: { className?: string }) {
  const { t } = useTranslation("common");
  return (
    <span className={`text-xs italic text-muted-foreground ${className}`.trim()}>
      {t("masked")}
    </span>
  );
}

/** true se il contratto dichiara `campo` fra quelli trattenuti per questo attore. */
export function isMasked(row: { masked?: string[] } | null | undefined, campo: string): boolean {
  return row?.masked?.includes(campo) ?? false;
}
