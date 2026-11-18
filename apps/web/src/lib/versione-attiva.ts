import { useMemo } from "react";
import type { BlueprintActivation } from "@heuresys/shared";

/**
 * Il filtro dei processi del modello in vigore per chi guarda: la variante e la VERSIONE attivate.
 *
 * Il registro dei processi è unico per versione (C4, 000463), quindi filtrare la sola variante
 * somma le versioni. Con più attivazioni attive (un mandato di piattaforma vede tutti i tenant) non
 * c'è una versione sola: il filtro resta vuoto e l'elenco è intero, come prima (D3-16).
 */
export function useVersioneAttiva(attivazioni: readonly BlueprintActivation[] | undefined): { variantId: string; variantVersionId: string } {
  return useMemo(() => {
    const items = attivazioni ?? [];
    const varianti = new Set(items.map((a) => a.variantId));
    const versioni = new Set(items.map((a) => a.variantVersionId).filter((v): v is string => typeof v === "string"));
    const variantId = varianti.size === 1 ? [...varianti][0] ?? "" : "";
    const variantVersionId = variantId && versioni.size === 1 ? [...versioni][0] ?? "" : "";
    return { variantId, variantVersionId };
  }, [attivazioni]);
}
