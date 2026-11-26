/** L'esito per categoria, profilo e totale; il campione per la correzione a mano. */
export interface Riga {
  id: string;
  categoria: string;
  profilo: string;
  domanda: string;
  alle: string;
  impronta: string;
  risposta: string;
  strumenti: string[];
  conferme: string[];
  conversazione: string;
  durataMs: number;
  guasto?: string;
  giusta: boolean;
  motivo: string;
}

export function riassunto(righe: Riga[]): { quota: number; testo: string } {
  const tabella = (chiave: "categoria" | "profilo") => {
    const m = new Map<string, [number, number]>();
    for (const r of righe) {
      const x = m.get(r[chiave]) ?? [0, 0];
      m.set(r[chiave], [x[0] + (r.giusta ? 1 : 0), x[1] + 1]);
    }
    return [...m].sort().map(([k, [g, t]]) => `  ${k.padEnd(24)} ${String(g).padStart(3)}/${String(t).padEnd(3)} ${Math.round((100 * g) / t)}%`).join("\n");
  };
  const giuste = righe.filter((r) => r.giusta).length;
  const quota = righe.length ? giuste / righe.length : 0;
  return {
    quota,
    testo: `PER CATEGORIA\n${tabella("categoria")}\nPER PROFILO\n${tabella("profilo")}\nTOTALE ${giuste}/${righe.length} (${(100 * quota).toFixed(1)}%), guasti ${righe.filter((r) => r.guasto).length}`,
  };
}
