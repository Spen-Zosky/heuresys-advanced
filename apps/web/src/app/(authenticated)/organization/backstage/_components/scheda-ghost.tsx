"use client";

/**
 * La scheda a cascata di un'unità del Backstage (l'organizzazione ghost, ADR-0063 D2).
 *
 * Una pila di schede come `scheda-rapida.tsx`: l'unità sopra e le unità sotto aprono la loro scheda
 * sopra la precedente, il filo in alto riporta a qualunque passo, Esc chiude solo l'ultima. Le
 * persone, le posizioni e l'unità reale aprono le schede rapide di tutta l'app (`Riferimento`), che
 * si impilano sopra questa. La finestra è ampia e ridimensionabile (`MODALE.grande`).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bot, ChevronRight, X } from "lucide-react";
import type { GhostDriftItem, GhostUnit } from "@heuresys/shared";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@heuresys/ui";
import { MODALE } from "@/lib/modale";
import { useFormat } from "@/lib/format";
import { useEnumLabel } from "@/lib/enum-labels";
import { Riferimento } from "@/components/scheda-rapida";
import { StatusPill } from "@/components/status-pill";
import type { PosizioneViva, UnitaViva } from "./dati";

export interface DatiBackstage {
  attive: GhostUnit[];
  storia: GhostUnit[];
  deriva: GhostDriftItem[];
  vive: Map<string, UnitaViva>;
  posizioni: PosizioneViva[];
}

const Ctx = createContext<{ apri: (ghostUnitId: string) => void } | null>(null);
export const useSchedaGhost = () => useContext(Ctx);

/** Il nome di un'unità del Backstage che apre la sua scheda. */
export function NomeGhost({ g }: { g: GhostUnit }) {
  const s = useSchedaGhost();
  if (!s) return <>{g.name}</>;
  return (
    <button
      type="button"
      data-riferimento="ghost"
      onClick={(e) => { e.stopPropagation(); s.apri(g.ghostUnitId); }}
      className="cursor-pointer rounded-sm text-left font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {g.name}
    </button>
  );
}

function Riga({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  const { t } = useTranslation("admin");
  return (
    <div className="grid grid-cols-[12rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{etichetta}</dt>
      <dd className="min-w-0">{children ?? <span className="text-muted-foreground">{t("backstage.scheda.nonIndicato")}</span>}</dd>
    </div>
  );
}

function Sezione({ titolo, quanti, children }: { titolo: string; quanti: number; children: ReactNode }) {
  const fmt = useFormat();
  if (quanti === 0) return null;
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titolo} <span className="font-normal">({fmt.numero(quanti)})</span>
      </h3>
      {children}
    </section>
  );
}

function Corpo({ g, dati }: { g: GhostUnit; dati: DatiBackstage }) {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const enumLabel = useEnumLabel();
  const viva = g.sourceUnitId ? dati.vive.get(g.sourceUnitId) : undefined;
  const sopra = dati.attive.find((x) => x.sourceUnitId && x.sourceUnitId === g.sourceParentId);
  const sotto = dati.attive.filter((x) => g.sourceUnitId && x.sourceParentId === g.sourceUnitId);
  const persone = viva ? [...viva.persone].sort((a, b) => Number(b.responsabile) - Number(a.responsabile) || a.etichetta.localeCompare(b.etichetta, "it")) : [];
  const posizioni = g.sourceUnitId ? dati.posizioni.filter((p) => p.unitaId === g.sourceUnitId) : [];
  const periodi = dati.storia.filter((x) => (g.sourceUnitId ? x.sourceUnitId === g.sourceUnitId : x.ghostUnitId === g.ghostUnitId));
  const deriva = dati.deriva.find((d) => d.sourceUnitId && d.sourceUnitId === g.sourceUnitId);
  const aperta = g.validTo === null;

  return (
    <div data-testid="scheda-ghost-corpo">
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        {g.managerName
          ? t("backstage.scheda.capoAffianca", { unita: g.name, persona: g.managerName })
          : t("backstage.scheda.capoSenzaResponsabile", { unita: g.name })}
      </p>
      <dl className="mt-3 divide-y divide-border">
        <Riga etichetta={t("backstage.scheda.tipo")}>{t(`backstage.tipi.${g.kind}`)}</Riga>
        <Riga etichetta={t("backstage.scheda.livello")}>{t(`backstage.livelli.${g.level}`)}</Riga>
        <Riga etichetta={t("backstage.scheda.unitaReale")}>
          {g.sourceUnitId ? <Riferimento tipo="unita" id={g.sourceUnitId}>{viva?.nome ?? g.name}</Riferimento> : t("backstage.scheda.unitaEliminata")}
          {g.sourceType ? <span className="ml-2 text-xs text-muted-foreground">{enumLabel("orgUnitType", g.sourceType)}</span> : null}
        </Riga>
        <Riga etichetta={t("backstage.scheda.responsabile")}>
          {g.managerUserId && g.managerName ? <Riferimento tipo="persona" id={g.managerUserId}>{g.managerName}</Riferimento> : null}
        </Riga>
        <Riga etichetta={t("backstage.scheda.sopra")}>{sopra ? <NomeGhost g={sopra} /> : g.level === 0 ? t("backstage.scheda.eIlVertice") : null}</Riga>
        <Riga etichetta={t("backstage.scheda.persone")}>
          {viva ? t("backstage.scheda.personeValore", { unita: fmt.numero(viva.persone.length), totali: fmt.numero(viva.addettiTotali) }) : null}
        </Riga>
        <Riga etichetta={t("backstage.scheda.posizioni")}>
          {viva ? t("backstage.scheda.posizioniValore", { count: viva.posizioni, posizioni: fmt.numero(viva.posizioni), scoperte: fmt.numero(viva.scoperte) }) : null}
        </Riga>
        <Riga etichetta={t("backstage.scheda.inVigoreDal")}>{fmt.data(g.validFrom)}</Riga>
        <Riga etichetta={t("backstage.scheda.motivoApertura")}>{t(`backstage.aperture.${g.openedReason}`)}</Riga>
        <Riga etichetta={t("backstage.scheda.stato")}>
          {aperta
            ? deriva ? <StatusPill tone="warning">{t(`backstage.deriva.cambi.${deriva.change}`)}</StatusPill> : <StatusPill tone="success">{t("backstage.stati.allineata")}</StatusPill>
            : <StatusPill tone="neutral">{t("backstage.stati.chiusa", { quando: fmt.data(g.validTo!) })}</StatusPill>}
        </Riga>
      </dl>

      {deriva && deriva.change === "MODIFICATA" ? (
        <Sezione titolo={t("backstage.scheda.cheCosaCambia")} quanti={deriva.changedFields.length}>
          <ul className="space-y-1 text-sm">
            {deriva.changedFields.map((c) => (
              <li key={c}><span className="text-muted-foreground">{t(`backstage.deriva.campi.${c}`)}:</span> {valoreTratto(c, deriva.ghost, t, enumLabel)} → <strong>{valoreTratto(c, deriva.live, t, enumLabel)}</strong></li>
            ))}
          </ul>
        </Sezione>
      ) : null}

      <Sezione titolo={t("backstage.scheda.unitaSotto")} quanti={sotto.length}>
        <ul className="grid gap-1 sm:grid-cols-2">
          {sotto.map((x) => (
            <li key={x.ghostUnitId} className="flex items-baseline justify-between gap-2 text-sm">
              <NomeGhost g={x} />
              <span className="text-xs text-muted-foreground">{t(`backstage.tipi.${x.kind}`)}</span>
            </li>
          ))}
        </ul>
      </Sezione>

      <Sezione titolo={t("backstage.scheda.personeUnita")} quanti={persone.length}>
        <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {persone.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className={p.responsabile ? "font-semibold" : undefined}><Riferimento tipo="persona" id={p.id}>{p.etichetta}</Riferimento></span>
              <span className="min-w-0 text-right text-xs text-muted-foreground">{p.posizione}{p.responsabile ? ` · ${t("backstage.scheda.responsabileBreve")}` : ""}</span>
            </li>
          ))}
        </ul>
      </Sezione>

      <Sezione titolo={t("backstage.scheda.posizioniUnita")} quanti={posizioni.length}>
        <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {posizioni.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-3 text-sm">
              <Riferimento tipo="posizione" id={p.id}>{p.titolo}</Riferimento>
              <span className="text-xs text-muted-foreground">{p.titolare ?? t("backstage.scheda.scoperta")}</span>
            </li>
          ))}
        </ul>
      </Sezione>

      <Sezione titolo={t("backstage.scheda.storia")} quanti={periodi.length}>
        <ol className="space-y-1.5 border-l border-border pl-3 text-sm">
          {periodi.map((p) => (
            <li key={p.ghostUnitId} data-testid="scheda-ghost-periodo">
              <span className="font-medium">{p.name}</span>{" "}
              <span className="text-muted-foreground">
                {p.validTo
                  ? t("backstage.scheda.periodoChiuso", { dal: fmt.data(p.validFrom), al: fmt.data(p.validTo) })
                  : t("backstage.scheda.periodoAperto", { dal: fmt.data(p.validFrom) })}
                {" · "}{t(`backstage.aperture.${p.openedReason}`)}
                {p.closedReason ? ` · ${t(`backstage.chiusure.${p.closedReason}`)}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </Sezione>
    </div>
  );
}

type Tr = (k: string, o?: Record<string, unknown>) => string;

/** Un tratto della deriva scritto in parole: il tipo e il livello con le loro etichette, il padre con il nome. */
export function valoreTratto(
  campo: GhostDriftItem["changedFields"][number],
  tratti: GhostDriftItem["ghost"],
  t: Tr,
  enumLabel: ReturnType<typeof useEnumLabel>,
  nomeUnita?: (id: string) => string | undefined,
): string {
  if (!tratti) return "—";
  switch (campo) {
    case "kind": return t(`backstage.tipi.${tratti.kind}`);
    case "level": return t(`backstage.livelli.${tratti.level}`);
    case "sourceType": return tratti.sourceType ? enumLabel("orgUnitType", tratti.sourceType) : "—";
    case "sourceParentId": return tratti.sourceParentId ? (nomeUnita?.(tratti.sourceParentId) ?? t("backstage.deriva.altraUnita")) : t("backstage.deriva.nessuna");
    case "code": return tratti.code;
    case "name": return tratti.name;
  }
}

export function SchedeGhostProvider({ dati, children }: { dati: DatiBackstage; children: ReactNode }) {
  const { t } = useTranslation("admin");
  const [pila, setPila] = useState<string[]>([]);
  const indice = useMemo(() => new Map([...dati.storia, ...dati.attive].map((g) => [g.ghostUnitId, g])), [dati.attive, dati.storia]);
  const apri = useCallback((id: string) => setPila((p) => [...p, id].slice(-8)), []);
  const indietro = useCallback(() => setPila((p) => p.slice(0, -1)), []);
  const valore = useMemo(() => ({ apri }), [apri]);
  const cima = pila.length ? indice.get(pila[pila.length - 1]!) : undefined;
  return (
    <Ctx.Provider value={valore}>
      {children}
      <Dialog open={!!cima} onOpenChange={(o) => { if (!o) setPila([]); }}>
        {cima ? (
          <DialogContent
            className={MODALE.grande}
            showCloseButton={false}
            data-testid="scheda-ghost"
            onEscapeKeyDown={(e) => { if (pila.length > 1) { e.preventDefault(); indietro(); } }}
          >
            {pila.length > 1 ? (
              <nav aria-label={t("backstage.scheda.percorso")} className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {pila.slice(0, -1).map((id, i) => (
                  <span key={`${id}-${i}`} className="flex items-center gap-1">
                    <button type="button" className="hover:text-foreground hover:underline" onClick={() => setPila((x) => x.slice(0, i + 1))}>
                      {indice.get(id)?.name ?? "—"}
                    </button>
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </span>
                ))}
              </nav>
            ) : null}
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary"><Bot className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold leading-tight">{cima.name}</DialogTitle>
                <DialogDescription className="text-xs">{t("backstage.scheda.sottotitolo", { tipo: t(`backstage.tipi.${cima.kind}`) })}</DialogDescription>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {pila.length > 1 ? (
                  <button type="button" data-testid="scheda-ghost-indietro" className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted" onClick={indietro}>
                    {t("backstage.scheda.indietro")}
                  </button>
                ) : null}
                <button
                  type="button"
                  data-testid="scheda-ghost-chiudi"
                  aria-label={pila.length > 1 ? t("backstage.scheda.chiudiCascata") : t("backstage.scheda.chiudi")}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
                  onClick={() => setPila([])}
                >
                  {pila.length > 1 ? t("backstage.scheda.chiudiCascata") : <X className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="mt-3"><Corpo g={cima} dati={dati} /></div>
          </DialogContent>
        ) : null}
      </Dialog>
    </Ctx.Provider>
  );
}
