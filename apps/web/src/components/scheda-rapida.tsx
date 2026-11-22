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
import { MODALE } from "@/lib/modale";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Building2, Briefcase, ChevronRight, User, X } from "lucide-react";
import { daRubrica, sottoalbero, type UnitaBlocco } from "@/lib/organigramma-blocchi";
import { OrganigrammaBlocchi } from "@/components/organigramma/blocchi";
import { useOrganigramma } from "@/components/organigramma/dati";
import { codiceInParole } from "@/lib/enum-labels";
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

type Tr = (chiave: string, parametri?: Record<string, string | number>) => string;

function nomeDi(ix: Indici, p: Passo, t: Tr): string {
  if (p.tipo === "persona") return ix.persone.get(p.id)?.etichetta ?? t("schedaRapida.persona");
  if (p.tipo === "posizione") return ix.posizioni.get(p.id)?.titolo ?? t("schedaRapida.posizione");
  return ix.unita.get(p.id)?.nome ?? t("schedaRapida.unita");
}

const ICONA = { persona: User, posizione: Briefcase, unita: Building2 } as const;
const TIPO = { persona: "schedaRapida.persona", posizione: "schedaRapida.posizione", unita: "schedaRapida.unitaOrganizzativa" } as const;

function Riga({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  const { t } = useTranslation("common");
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{etichetta}</dt>
      <dd className="min-w-0">{children ?? <span className="text-muted-foreground">{t("schedaRapida.nonIndicato")}</span>}</dd>
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
            {v.nota ? <span className="min-w-0 break-words text-right text-xs text-muted-foreground">{v.nota}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Corpo({ passo, ix, blocchi }: { passo: Passo; ix: Indici; blocchi: UnitaBlocco[] }) {
  const enumLabel = useEnumLabel();
  const { t } = useTranslation("common");
  const rif = (tipo: TipoScheda, id: string | null | undefined) =>
    id ? <Riferimento tipo={tipo} id={id}>{nomeDi(ix, { tipo, id }, t)}</Riferimento> : null;

  if (passo.tipo === "persona") {
    const p = ix.persone.get(passo.id);
    if (!p) return <p className="text-sm text-muted-foreground">{t("schedaRapida.personaFuori")}</p>;
    const pos = p.posizioneId ? ix.posizioni.get(p.posizioneId) : undefined;
    const capo = pos?.riportaAId ? ix.posizioni.get(pos.riportaAId) : undefined;
    const colleghi = [...ix.persone.values()].filter((x) => x.unitaId && x.unitaId === p.unitaId && x.id !== p.id);
    return (
      <>
        <dl className="divide-y divide-border">
          <Riga etichetta={t("schedaRapida.posizione")}>{rif("posizione", p.posizioneId)}</Riga>
          <Riga etichetta={t("schedaRapida.unita")}>{rif("unita", p.unitaId)}</Riga>
          <Riga etichetta={t("schedaRapida.riportaA")}>{capo?.titolareId ? rif("persona", capo.titolareId) : capo ? rif("posizione", capo.id) : null}</Riga>
          <Riga etichetta={t("schedaRapida.stato")}>{p.attiva ? t("schedaRapida.attiva") : t("schedaRapida.nonAttiva")}</Riga>
        </dl>
        <Elenco titolo={t("schedaRapida.stessaUnita")} voci={colleghi.slice(0, 50).map((c) => ({ tipo: "persona", id: c.id, nome: c.etichetta, nota: c.posizione }))} />
        <div className="mt-4 text-right">
          <Link href={`/users/${p.id}`} className="text-sm font-medium text-primary hover:underline">{t("schedaRapida.apriScheda")}</Link>
        </div>
      </>
    );
  }

  if (passo.tipo === "posizione") {
    const p = ix.posizioni.get(passo.id);
    if (!p) return <p className="text-sm text-muted-foreground">{t("schedaRapida.posizioneFuori")}</p>;
    const riporti = [...ix.posizioni.values()].filter((x) => x.riportaAId === p.id);
    return (
      <>
        <dl className="divide-y divide-border">
          <Riga etichetta={t("schedaRapida.titolare")}>{p.titolareId ? rif("persona", p.titolareId) : <span className="text-warning">{t("schedaRapida.scoperta")}</span>}</Riga>
          <Riga etichetta={t("schedaRapida.unita")}>{rif("unita", p.unitaId)}</Riga>
          <Riga etichetta={t("schedaRapida.riportaA")}>{rif("posizione", p.riportaAId)}</Riga>
          <Riga etichetta={t("schedaRapida.criticita")}>{p.criticita ? enumLabel("positionCriticality", p.criticita) : null}</Riga>
          <Riga etichetta={t("schedaRapida.codice")}>{p.codice ? <span className="font-mono text-xs text-muted-foreground" data-grezzo>{p.codice}</span> : null}</Riga>
        </dl>
        <Elenco titolo={t("schedaRapida.leRiportano")} voci={riporti.map((r) => ({ tipo: "posizione", id: r.id, nome: r.titolo, nota: r.titolare }))} />
        <div className="mt-4 text-right">
          <Link href={`/positions/${p.id}`} className="text-sm font-medium text-primary hover:underline">{t("schedaRapida.apriPosizione")}</Link>
        </div>
      </>
    );
  }

  return <CorpoUnita id={passo.id} ix={ix} blocchi={blocchi} rif={rif} />;
}

/**
 * La scheda dell'unità, come quella del banco del datastore (`ispeziona.mjs`): la catena sopra,
 * il quadro (tipo, responsabile, da chi dipende, persone, posizioni), la struttura sotto di sé a
 * blocchi con i nomi, le unità figlie, le persone e le posizioni. Ogni nome apre la sua scheda
 * sopra questa; un clic su un riquadro della struttura apre quell'unità.
 */
function CorpoUnita({ id, ix, blocchi, rif }: {
  id: string; ix: Indici; blocchi: UnitaBlocco[];
  rif: (tipo: TipoScheda, id: string | null | undefined) => ReactNode;
}) {
  const { t } = useTranslation("common");
  const enumLabel = useEnumLabel();
  const s = useScheda();
  // Sede, organico previsto e la sua ragione non stanno nella rubrica: vengono dall'organigramma
  // vivo (la stessa richiesta della vista, già in cache quando la scheda si apre da lì).
  const org = useOrganigramma();
  const vivo = org.data?.unita.find((x) => x.id === id);
  const u = ix.unita.get(id);
  if (!u) return <p className="text-sm text-muted-foreground">{t("schedaRapida.unitaFuori")}</p>;
  const figlie = [...ix.unita.values()].filter((x) => x.padreId === u.id && x.attiva);
  const posizioni = [...ix.posizioni.values()].filter((x) => x.unitaId === u.id && x.attiva);
  const scoperte = posizioni.filter((x) => !x.titolareId).length;
  const persone = [...ix.persone.values()].filter((x) => x.unitaId === u.id && x.attiva);
  const catena: Array<{ id: string; nome: string }> = [];
  for (let c = ix.unita.get(u.padreId ?? ""), n = 0; c && n < 20; c = ix.unita.get(c.padreId ?? ""), n++) catena.unshift({ id: c.id, nome: c.nome });
  const sotto = sottoalbero(blocchi, u.id);
  const totali = blocchi.find((b) => b.id === u.id)?.addettiTotali ?? persone.length;
  return (
    <>
      {catena.length ? (
        <p className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {catena.map((c) => (
            <span key={c.id} className="flex items-center gap-1">{rif("unita", c.id)}<ChevronRight className="h-3 w-3" aria-hidden /></span>
          ))}
          <span>{u.nome}</span>
        </p>
      ) : null}
      <dl className="divide-y divide-border">
        <Riga etichetta={t("organigramma.scheda.tipo")}>{u.tipo ? enumLabel("orgUnitType", u.tipo) : null}</Riga>
        <Riga etichetta={t("schedaRapida.responsabile")}>{rif("persona", u.responsabileId)}</Riga>
        <Riga etichetta={t("schedaRapida.faParteDi")}>{u.padreId ? rif("unita", u.padreId) : t("schedaRapida.vertice")}</Riga>
        {vivo?.sedeCodice ? (
          <Riga etichetta={t("organigramma.scheda.sede")}>
            {codiceInParole(vivo.sedeCodice)}{vivo.sedeTipo ? <span className="text-muted-foreground"> — {enumLabel("siteKind", vivo.sedeTipo)}</span> : null}
          </Riga>
        ) : null}
        <Riga etichetta={t("organigramma.scheda.addetti")}>{t("organigramma.scheda.addettiConSotto", { diretti: persone.length, totali })}</Riga>
        {vivo?.organicoPrevisto != null ? (
          <Riga etichetta={t("organigramma.scheda.organicoPrevisto")}>{vivo.organicoPrevisto}</Riga>
        ) : null}
        {vivo?.ragioneOrganico ? (
          <Riga etichetta={t("organigramma.scheda.ragioneOrganico")}>{vivo.ragioneOrganico}</Riga>
        ) : null}
        <Riga etichetta={t("schedaRapida.posizioni")}>{`${posizioni.length}${scoperte ? t("schedaRapida.posizioniScoperte", { count: scoperte }) : ""}`}</Riga>
      </dl>
      {sotto.length > 1 ? (
        <section className="mt-4" data-testid="scheda-struttura">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("organigramma.scheda.struttura", { count: sotto.length })}</h3>
          <OrganigrammaBlocchi unita={sotto} {...(s ? { onApri: (x: string) => s.apri("unita", x) } : {})} nomeFile={`unita_${u.codice ?? u.id}`} ariaLabel={u.nome} altezzaMax="45vh" />
        </section>
      ) : null}
      <Elenco titolo={t("schedaRapida.unitaSotto")} voci={figlie.map((f) => ({ tipo: "unita", id: f.id, nome: f.nome }))} />
      <Elenco titolo={t("organigramma.scheda.persone")} voci={persone.map((p) => ({ tipo: "persona", id: p.id, nome: p.etichetta, nota: p.posizione }))} />
      <Elenco titolo={t("schedaRapida.posizioni")} voci={posizioni.map((x) => ({ tipo: "posizione", id: x.id, nome: x.titolo, nota: x.titolare ?? t("schedaRapida.scopertaMin") }))} />
    </>
  );
}

export function SchedeProvider({ children }: { children: ReactNode }) {
  const [pila, setPila] = useState<Passo[]>([]);
  const rubrica = useRubrica();
  const ix = useMemo(() => indicizza(rubrica.data), [rubrica.data]);
  const blocchi = useMemo(() => daRubrica(rubrica.data), [rubrica.data]);
  const { t } = useTranslation("common");
  const indietro = useCallback(() => setPila((p) => p.slice(0, -1)), []);
  const apri = useCallback((tipo: TipoScheda, id: string) => setPila((p) => [...p, { tipo, id }].slice(-8)), []);
  const valore = useMemo(() => ({ apri }), [apri]);
  const cima = pila[pila.length - 1];
  const Icona = cima ? ICONA[cima.tipo] : User;
  return (
    <Ctx.Provider value={valore}>
      {children}
      <Dialog open={!!cima} onOpenChange={(o) => { if (!o) setPila([]); }}>
        {cima ? (
          <DialogContent
            className={cima.tipo === "unita" ? MODALE.grande : MODALE.media}
            // La scheda ha già «Chiudi» / «Chiudi cascata»: la X di serie sarebbe un secondo pulsante uguale.
            showCloseButton={false}
            data-testid="scheda-rapida"
            // Come nel banco: Esc chiude solo l'ultima scheda della cascata.
            onEscapeKeyDown={(e) => { if (pila.length > 1) { e.preventDefault(); indietro(); } }}
          >
            {pila.length > 1 ? (
              <nav aria-label={t("schedaRapida.percorso")} className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {pila.slice(0, -1).map((p, i) => (
                  <span key={`${p.id}-${i}`} className="flex items-center gap-1">
                    <button type="button" className="hover:text-foreground hover:underline" onClick={() => setPila((x) => x.slice(0, i + 1))}>
                      {nomeDi(ix, p, t)}
                    </button>
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </span>
                ))}
              </nav>
            ) : null}
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary"><Icona className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold leading-tight">{nomeDi(ix, cima, t)}</DialogTitle>
                <DialogDescription className="text-xs">{t(TIPO[cima.tipo])}</DialogDescription>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {pila.length > 1 ? (
                  <button type="button" data-testid="scheda-indietro" className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted" onClick={indietro}>
                    {t("organigramma.scheda.indietro")}
                  </button>
                ) : null}
                <button
                  type="button"
                  data-testid="scheda-chiudi"
                  aria-label={pila.length > 1 ? t("organigramma.scheda.chiudiCascata") : t("organigramma.scheda.chiudi")}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
                  onClick={() => setPila([])}
                >
                  {pila.length > 1 ? t("organigramma.scheda.chiudiCascata") : <X className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="mt-3">
              {rubrica.isLoading ? <p className="text-sm text-muted-foreground">{t("schedaRapida.caricamento")}</p> : <Corpo passo={cima} ix={ix} blocchi={blocchi} />}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </Ctx.Provider>
  );
}
