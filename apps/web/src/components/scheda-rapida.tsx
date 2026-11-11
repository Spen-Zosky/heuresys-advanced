"use client";

/**
 * apps/web/src/components/scheda-rapida.tsx — la finestra di sintesi a cascata (classe C12 del
 * piano docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Enzo, 2026-11-11: «i dati ispezionabili mostrano l'indice come puntatore ma poi non aprono
 * niente; dati che dovrebbero offrire le catene di informazioni che hanno dietro non sono
 * nemmeno cliccabili; nessun uso di finestre modali che forniscano quadri sintetici a cascata,
 * come nella webapp delle corse del datastore».
 *
 * Ogni persona, posizione e unità organizzativa che compare in una pagina (attraverso la rete di
 * leggibilità o un `Riferimento` esplicito) apre questa finestra. La finestra mostra il quadro
 * essenziale e la catena: per una persona la sua posizione e la sua unità; per una posizione il
 * titolare, a chi riporta, chi le riporta; per un'unità chi la guida, l'unità sopra, le unità
 * sotto, le posizioni. Ogni elemento della catena apre la sua scheda sopra la precedente, e il
 * filo in alto riporta indietro a qualunque passo. I dati vengono dalla rubrica del perimetro
 * (`GET /v1/me/rubrica`): la catena si percorre con qualunque ruolo, senza chiamate che un ruolo
 * non può fare. Il dettaglio completo resta nella pagina, raggiungibile da «Apri la pagina».
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Building2, Briefcase, ChevronRight, User, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@heuresys/ui";
import type { RubricaResponse } from "@heuresys/shared";
import { useRubrica } from "@/lib/leggibile";
import { useEnumLabel } from "@/lib/enum-labels";

export type TipoScheda = "persona" | "posizione" | "unita";
interface Passo { tipo: TipoScheda; id: string }

const Ctx = createContext<{ apri: (tipo: TipoScheda, id: string) => void } | null>(null);

export function useScheda() {
  return useContext(Ctx);
}

/** Un nome che apre la sua scheda. Fuori dal fornitore resta testo. */
export function Riferimento({ tipo, id, children }: { tipo: TipoScheda; id: string; children: ReactNode }) {
  const s = useScheda();
  if (!s) return <>{children}</>;
  return (
    <button
      type="button"
      data-riferimento={tipo}
      onClick={(e) => {
        e.stopPropagation();
        s.apri(tipo, id);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className="cursor-pointer rounded-sm text-left font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {children}
    </button>
  );
}

type Indici = {
  persone: Map<string, RubricaResponse["persone"][number]>;
  posizioni: Map<string, RubricaResponse["posizioni"][number]>;
  unita: Map<string, RubricaResponse["unita"][number]>;
};

function indicizza(r: RubricaResponse | undefined): Indici {
  return {
    persone: new Map((r?.persone ?? []).map((x) => [x.id, x])),
    posizioni: new Map((r?.posizioni ?? []).map((x) => [x.id, x])),
    unita: new Map((r?.unita ?? []).map((x) => [x.id, x])),
  };
}

function nomeDi(ix: Indici, p: Passo): string {
  if (p.tipo === "persona") return ix.persone.get(p.id)?.etichetta ?? "Persona";
  if (p.tipo === "posizione") return ix.posizioni.get(p.id)?.titolo ?? "Posizione";
  return ix.unita.get(p.id)?.nome ?? "Unità";
}

const ICONA = { persona: User, posizione: Briefcase, unita: Building2 } as const;
const TIPO = { persona: "Persona", posizione: "Posizione", unita: "Unità organizzativa" } as const;

function Riga({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{etichetta}</dt>
      <dd className="min-w-0">{children ?? <span className="text-muted-foreground">Non indicato</span>}</dd>
    </div>
  );
}

function Elenco({ titolo, voci }: { titolo: string; voci: Array<{ tipo: TipoScheda; id: string; nome: string; nota?: string | null }> }) {
  if (voci.length === 0) return null;
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titolo} <span className="font-normal">({voci.length})</span>
      </h3>
      <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
        {voci.map((v) => (
          <li key={v.id} className="flex items-baseline justify-between gap-3 text-sm">
            <Riferimento tipo={v.tipo} id={v.id}>{v.nome}</Riferimento>
            {v.nota ? <span className="truncate text-xs text-muted-foreground">{v.nota}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Corpo({ passo, ix }: { passo: Passo; ix: Indici }) {
  const enumLabel = useEnumLabel();
  const rif = (tipo: TipoScheda, id: string | null | undefined) =>
    id ? <Riferimento tipo={tipo} id={id}>{nomeDi(ix, { tipo, id })}</Riferimento> : null;

  if (passo.tipo === "persona") {
    const p = ix.persone.get(passo.id);
    if (!p) return <p className="text-sm text-muted-foreground">Questa persona non è nel tuo perimetro.</p>;
    const pos = p.posizioneId ? ix.posizioni.get(p.posizioneId) : undefined;
    const capo = pos?.riportaAId ? ix.posizioni.get(pos.riportaAId) : undefined;
    const colleghi = [...ix.persone.values()].filter((x) => x.unitaId && x.unitaId === p.unitaId && x.id !== p.id);
    return (
      <>
        <dl className="divide-y divide-border">
          <Riga etichetta="Posizione">{rif("posizione", p.posizioneId)}</Riga>
          <Riga etichetta="Unità">{rif("unita", p.unitaId)}</Riga>
          <Riga etichetta="Riporta a">{capo?.titolareId ? rif("persona", capo.titolareId) : capo ? rif("posizione", capo.id) : null}</Riga>
          <Riga etichetta="Stato">{p.attiva ? "Attiva" : "Non attiva"}</Riga>
        </dl>
        <Elenco titolo="Nella stessa unità" voci={colleghi.slice(0, 50).map((c) => ({ tipo: "persona", id: c.id, nome: c.etichetta, nota: c.posizione }))} />
        <div className="mt-4 text-right">
          <Link href={`/users/${p.id}`} className="text-sm font-medium text-primary hover:underline">Apri la scheda completa →</Link>
        </div>
      </>
    );
  }

  if (passo.tipo === "posizione") {
    const p = ix.posizioni.get(passo.id);
    if (!p) return <p className="text-sm text-muted-foreground">Questa posizione non è nel tuo perimetro.</p>;
    const riporti = [...ix.posizioni.values()].filter((x) => x.riportaAId === p.id);
    return (
      <>
        <dl className="divide-y divide-border">
          <Riga etichetta="Titolare">{p.titolareId ? rif("persona", p.titolareId) : <span className="text-warning">Scoperta</span>}</Riga>
          <Riga etichetta="Unità">{rif("unita", p.unitaId)}</Riga>
          <Riga etichetta="Riporta a">{rif("posizione", p.riportaAId)}</Riga>
          <Riga etichetta="Criticità">{p.criticita ? enumLabel("positionCriticality", p.criticita) : null}</Riga>
          <Riga etichetta="Codice">{p.codice ? <span className="font-mono text-xs text-muted-foreground">{p.codice}</span> : null}</Riga>
        </dl>
        <Elenco titolo="Le riportano" voci={riporti.map((r) => ({ tipo: "posizione", id: r.id, nome: r.titolo, nota: r.titolare }))} />
        <div className="mt-4 text-right">
          <Link href={`/positions/${p.id}`} className="text-sm font-medium text-primary hover:underline">Apri la pagina della posizione →</Link>
        </div>
      </>
    );
  }

  const u = ix.unita.get(passo.id);
  if (!u) return <p className="text-sm text-muted-foreground">Questa unità non è nel tuo perimetro.</p>;
  const figlie = [...ix.unita.values()].filter((x) => x.padreId === u.id);
  const posizioni = [...ix.posizioni.values()].filter((x) => x.unitaId === u.id);
  const scoperte = posizioni.filter((x) => !x.titolareId).length;
  return (
    <>
      <dl className="divide-y divide-border">
        <Riga etichetta="Responsabile">{rif("persona", u.responsabileId)}</Riga>
        <Riga etichetta="Fa parte di">{rif("unita", u.padreId)}</Riga>
        <Riga etichetta="Posizioni">{`${posizioni.length}${scoperte ? `, di cui ${scoperte} scoperte` : ""}`}</Riga>
      </dl>
      <Elenco titolo="Unità sotto" voci={figlie.map((f) => ({ tipo: "unita", id: f.id, nome: f.nome }))} />
      <Elenco titolo="Posizioni" voci={posizioni.map((x) => ({ tipo: "posizione", id: x.id, nome: x.titolo, nota: x.titolare ?? "scoperta" }))} />
    </>
  );
}

export function SchedeProvider({ children }: { children: ReactNode }) {
  const [pila, setPila] = useState<Passo[]>([]);
  const rubrica = useRubrica();
  const ix = useMemo(() => indicizza(rubrica.data), [rubrica.data]);
  const apri = useCallback((tipo: TipoScheda, id: string) => setPila((p) => [...p, { tipo, id }].slice(-8)), []);
  const valore = useMemo(() => ({ apri }), [apri]);
  const cima = pila[pila.length - 1];
  const Icona = cima ? ICONA[cima.tipo] : User;
  return (
    <Ctx.Provider value={valore}>
      {children}
      <Dialog open={!!cima} onOpenChange={(o) => { if (!o) setPila([]); }}>
        {cima ? (
          <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto" data-testid="scheda-rapida">
            {pila.length > 1 ? (
              <nav aria-label="Percorso" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {pila.slice(0, -1).map((p, i) => (
                  <span key={`${p.id}-${i}`} className="flex items-center gap-1">
                    <button type="button" className="hover:text-foreground hover:underline" onClick={() => setPila((x) => x.slice(0, i + 1))}>
                      {nomeDi(ix, p)}
                    </button>
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </span>
                ))}
              </nav>
            ) : null}
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary"><Icona className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold leading-tight">{nomeDi(ix, cima)}</DialogTitle>
                <DialogDescription className="text-xs">{TIPO[cima.tipo]}</DialogDescription>
              </div>
              <button type="button" aria-label="Chiudi" className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setPila([])}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3">
              {rubrica.isLoading ? <p className="text-sm text-muted-foreground">Caricamento…</p> : <Corpo passo={cima} ix={ix} />}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </Ctx.Provider>
  );
}
