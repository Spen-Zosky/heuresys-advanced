/**
 * apps/web/src/components/organigramma/dati.ts — i dati dell'organigramma vivo.
 *
 * In un file a sé perché li usano sia la vista (`vista.tsx`) sia la scheda dell'unità a cascata
 * (`scheda-rapida.tsx`, per sede e organico previsto, che la rubrica non porta): la vista importa
 * la scheda, quindi la scheda non può importare la vista.
 */
import { useQuery } from "@tanstack/react-query";
import type { OrganigrammaResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import type { UnitaBlocco } from "@/lib/organigramma-blocchi";

export function useOrganigramma(tenantId?: string | null, abilitato = true) {
  return useQuery({
    queryKey: ["me", "organigramma", tenantId ?? null],
    queryFn: ({ signal }) =>
      apiFetch<OrganigrammaResponse>(`/v1/me/organigramma${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`, { signal }),
    staleTime: 60_000,
    enabled: abilitato,
  });
}

export function aBlocchi(r: OrganigrammaResponse | undefined): UnitaBlocco[] {
  return (r?.unita ?? []).map((u) => ({
    id: u.id, nome: u.nome, padreId: u.padreId, filiale: u.filiale, addettiTotali: u.addettiTotali,
    persone: u.persone.map((p) => ({ etichetta: p.etichetta, responsabile: p.responsabile })),
    sede: u.sedeCodice, organicoPrevisto: u.organicoPrevisto,
  }));
}
