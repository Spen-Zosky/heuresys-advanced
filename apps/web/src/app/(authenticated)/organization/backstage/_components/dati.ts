/**
 * I dati della pagina dell'organizzazione ghost (ADR-0063 D2, voce G1 del piano AI-driven).
 *
 * Quattro letture vive, nessun dato scritto qui: le unità ghost aperte (`GET /v1/ghost-units`), la
 * loro storia (`/storia`), la deriva rispetto all'albero vivo (`/deriva`) e l'organigramma vivo
 * (`GET /v1/me/organigramma`), da cui vengono le persone, le posizioni e gli addetti di ogni unità
 * reale che un'unità ghost affianca.
 */
import { useQuery } from "@tanstack/react-query";
import type { GhostDriftResponse, GhostUnit, GhostUnitsHistoryResponse, GhostUnitsResponse, OrganigrammaResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import type { UnitaBlocco } from "@/lib/organigramma-blocchi";

const conTenant = (percorso: string, tenantId: string | null) =>
  tenantId ? `${percorso}?tenantId=${encodeURIComponent(tenantId)}` : percorso;

export const CHIAVE_GHOST = ["ghost-units"] as const;

export function useGhost(tenantId: string | null) {
  return useQuery({
    queryKey: [...CHIAVE_GHOST, "attive", tenantId],
    queryFn: ({ signal }) => apiFetch<GhostUnitsResponse>(conTenant("/v1/ghost-units", tenantId), { signal }),
    staleTime: 30_000,
  });
}

export function useStoriaGhost(tenantId: string | null) {
  return useQuery({
    queryKey: [...CHIAVE_GHOST, "storia", tenantId],
    queryFn: ({ signal }) => apiFetch<GhostUnitsHistoryResponse>(conTenant("/v1/ghost-units/storia", tenantId), { signal }),
    staleTime: 30_000,
  });
}

export function useDerivaGhost(tenantId: string | null) {
  return useQuery({
    queryKey: [...CHIAVE_GHOST, "deriva", tenantId],
    queryFn: ({ signal }) => apiFetch<GhostDriftResponse>(conTenant("/v1/ghost-units/deriva", tenantId), { signal }),
    staleTime: 30_000,
  });
}

export type UnitaViva = OrganigrammaResponse["unita"][number];
export type PosizioneViva = OrganigrammaResponse["posizioni"][number];

/** L'albero ghost come blocchi: le persone di ogni riquadro sono quelle dell'unità reale, il responsabile per primo. */
export function ghostABlocchi(unita: GhostUnit[], vive: Map<string, UnitaViva>): UnitaBlocco[] {
  const ids = new Set(unita.map((g) => g.sourceUnitId).filter(Boolean));
  return unita
    .filter((g) => g.sourceUnitId)
    .map((g) => {
      const v = vive.get(g.sourceUnitId!);
      const persone = v
        ? [...v.persone].sort((a, b) => Number(b.responsabile) - Number(a.responsabile)).map((p) => ({ etichetta: p.etichetta, responsabile: p.responsabile }))
        : g.managerName ? [{ etichetta: g.managerName, responsabile: true }] : [];
      return {
        id: g.sourceUnitId!,
        nome: g.name,
        padreId: g.sourceParentId && ids.has(g.sourceParentId) ? g.sourceParentId : null,
        filiale: false,
        persone,
        addettiTotali: v?.addettiTotali ?? persone.length,
        tipo: g.sourceType,
      };
    });
}
