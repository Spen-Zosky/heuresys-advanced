/**
 * apps/api/src/modules/organigramma/comporre.ts — dalle righe lette all'albero (pura, senza database).
 * Separata da `repository.ts` perché i test e le prove la usano senza aprire il pool.
 */
import type { OrganigrammaResponse, OrganigrammaUnita } from "@heuresys/shared";

export interface RigaUnita {
  id: string; codice: string | null; nome: string; tipo: string | null; relazione: string | null;
  padreId: string | null; responsabileId: string | null; responsabile: string | null;
  /** Sede e organico dal modello (000490): facoltativi, vuoti finché il consolidamento non li porta. */
  sedeCodice?: string | null; sedeTipo?: string | null; organicoPrevisto?: number | null; ragioneOrganico?: string | null;
}
export interface RigaPersona {
  id: string; etichetta: string; posizioneId: string; posizione: string; unitaId: string | null;
  cognome: string | null; nome: string | null;
}
export interface RigaPosizione {
  id: string; titolo: string; unitaId: string | null; riportaAId: string | null;
  titolareId: string | null; titolare: string | null;
}

/** Pura: dalle righe lette all'albero. Esportata per i test. */
export function comporre(
  tenantId: string, cliente: string,
  righeUnita: RigaUnita[], righePersone: RigaPersona[], righePosizioni: RigaPosizione[],
): OrganigrammaResponse {
  const ids = new Set(righeUnita.map((u) => u.id));
  // Un padre fuori dalle unità attive del cliente fa dell'unità una radice: si disegna, non si perde.
  const padreDi = (u: RigaUnita) => (u.padreId && ids.has(u.padreId) && u.padreId !== u.id ? u.padreId : null);
  const figli = new Map<string, string[]>();
  for (const u of righeUnita) {
    const p = padreDi(u);
    if (!p) continue;
    if (!figli.has(p)) figli.set(p, []);
    figli.get(p)!.push(u.id);
  }

  const perUnita = new Map<string, RigaPersona[]>();
  const vistePerUnita = new Map<string, Set<string>>();
  for (const p of righePersone) {
    if (!p.unitaId || !ids.has(p.unitaId)) continue;
    const viste = vistePerUnita.get(p.unitaId) ?? new Set<string>();
    if (viste.has(p.id)) continue; // una persona con due posizioni nella stessa unità compare una volta
    viste.add(p.id);
    vistePerUnita.set(p.unitaId, viste);
    if (!perUnita.has(p.unitaId)) perUnita.set(p.unitaId, []);
    perUnita.get(p.unitaId)!.push(p);
  }

  const posizioniPerUnita = new Map<string, RigaPosizione[]>();
  for (const p of righePosizioni) {
    if (!p.unitaId) continue;
    if (!posizioniPerUnita.has(p.unitaId)) posizioniPerUnita.set(p.unitaId, []);
    posizioniPerUnita.get(p.unitaId)!.push(p);
  }

  // Livello e addetti totali con una visita che non cade nei cicli (il servizio delle unità li
  // rifiuta, ma un dato storico può ancora averne uno: qui si interrompe, non si va in loop).
  const livello = new Map<string, number>();
  const totali = new Map<string, number>();
  const visita = (id: string, l: number, sulCammino: Set<string>): number => {
    if (sulCammino.has(id)) return 0;
    sulCammino.add(id);
    livello.set(id, l);
    let t = vistePerUnita.get(id)?.size ?? 0;
    for (const f of figli.get(id) ?? []) t += visita(f, l + 1, sulCammino);
    sulCammino.delete(id);
    totali.set(id, t);
    return t;
  };
  for (const u of righeUnita) if (!padreDi(u)) visita(u.id, 1, new Set());
  // Unità rimaste fuori (solo dentro un ciclo): radici a sé.
  for (const u of righeUnita) if (!livello.has(u.id)) visita(u.id, 1, new Set());

  const unita: OrganigrammaUnita[] = righeUnita.map((u) => {
    const pers = (perUnita.get(u.id) ?? []).map((p) => ({
      id: p.id, etichetta: p.etichetta, posizioneId: p.posizioneId, posizione: p.posizione,
      responsabile: p.id === u.responsabileId,
    }));
    // Il responsabile per primo, gli altri in ordine di cognome (R1).
    pers.sort((a, b) => Number(b.responsabile) - Number(a.responsabile));
    const pos = posizioniPerUnita.get(u.id) ?? [];
    return {
      id: u.id, codice: u.codice, nome: u.nome, tipo: u.tipo, relazione: u.relazione,
      padreId: padreDi(u), livello: livello.get(u.id) ?? 1, filiale: u.tipo === "BRANCH" || u.sedeTipo === "FILIALE",
      responsabileId: u.responsabileId, responsabile: u.responsabile,
      persone: pers, posizioni: pos.length, scoperte: pos.filter((p) => !p.titolareId).length,
      addettiTotali: totali.get(u.id) ?? pers.length,
      sedeCodice: u.sedeCodice ?? null, sedeTipo: u.sedeTipo ?? null,
      organicoPrevisto: u.organicoPrevisto ?? null, ragioneOrganico: u.ragioneOrganico ?? null,
    };
  });

  const idPosizioni = new Set(righePosizioni.map((p) => p.id));
  return {
    tenantId, cliente, calcolatoIl: new Date().toISOString(), unita,
    posizioni: righePosizioni.map((p) => ({
      id: p.id, titolo: p.titolo, unitaId: p.unitaId,
      riportaAId: p.riportaAId && idPosizioni.has(p.riportaAId) ? p.riportaAId : null,
      titolareId: p.titolareId, titolare: p.titolare,
    })),
    avvisi: {
      posizioniSenzaRiporto: righePosizioni.filter((p) => !p.riportaAId).length,
      riportiFuoriCliente: righePosizioni.filter((p) => p.riportaAId && !idPosizioni.has(p.riportaAId)).length,
      unitaSenzaResponsabile: righeUnita.filter((u) => !u.responsabileId).length,
    },
  };
}
