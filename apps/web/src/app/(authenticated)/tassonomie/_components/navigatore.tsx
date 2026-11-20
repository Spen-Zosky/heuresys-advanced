"use client";

/**
 * Navigatore dei cataloghi: albero dei codici (settori e professioni) e rete delle competenze.
 * Solo lettura. Ogni voce apre una finestra a cascata: dentro la finestra, ogni voce collegata
 * (genitore, figli, corrispondenze, competenze vicine) apre la sua scheda sopra la precedente, e
 * il filo in alto riporta a qualunque passo.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, Search } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from "@heuresys/ui";
import type {
  ActivityClassification,
  ActivityClassificationMapping,
  OccupationClassification,
  Skill,
  SkillTaxonomyEdge,
} from "@heuresys/shared";
import { MODALE } from "@/lib/modale";
import { useFormat } from "@/lib/format";
import { StatoErrore } from "@/components/stato-pagina";
import { apiFetch } from "@/lib/api/fetch";

interface Codice {
  id: string;
  scheme: string;
  code: string;
  parentCode: string | null;
  name: string;
  description: string | null;
}
type TipoCodice = "attivita" | "professione";

const RISORSA: Record<TipoCodice, string> = {
  attivita: "activity-classifications",
  professione: "occupation-classifications",
};
const SCHEMI: Record<TipoCodice, readonly string[]> = {
  attivita: ["ATECO_2025", "NACE_REV_2_1", "ATECO_2007", "NACE_REV_2"],
  professione: ["ISCO_08", "CP_2021"],
};

function daAttivita(c: ActivityClassification): Codice {
  return { id: c.activityClassificationId, scheme: c.scheme, code: c.code, parentCode: c.parentCode, name: c.name, description: c.description };
}
function daProfessione(c: OccupationClassification): Codice {
  return { id: c.occupationClassificationId, scheme: c.scheme, code: c.code, parentCode: c.parentCode, name: c.name, description: c.description };
}

/** Legge tutte le pagine di uno schema (sono poche migliaia di voci) e le tiene cinque minuti. */
function useCatalogo(tipo: TipoCodice, scheme: string) {
  return useQuery({
    queryKey: ["tassonomie", tipo, scheme],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Codice[]> => {
      const out: Codice[] = [];
      let offset = 0;
      for (;;) {
        const q = new URLSearchParams({ scheme, limit: "500", offset: String(offset) });
        const r = await apiFetch<{ items: Array<ActivityClassification & OccupationClassification>; total: number }>(
          `/v1/${RISORSA[tipo]}?${q.toString()}`,
        );
        out.push(...r.items.map((i) => (tipo === "attivita" ? daAttivita(i) : daProfessione(i))));
        offset += r.items.length;
        if (r.items.length === 0 || out.length >= r.total) break;
      }
      return out;
    },
  });
}

type Passo =
  | { tipo: "codice"; tipoCodice: TipoCodice; scheme: string; codice: Codice }
  | { tipo: "competenza"; competenza: Pick<Skill, "skillId" | "name" | "code" | "description" | "escoUri"> };

function titoloPasso(p: Passo): string {
  return p.tipo === "codice" ? `${p.codice.code} · ${p.codice.name}` : p.competenza.name;
}

/** Il filo e la scheda corrente della cascata. */
function FinestraCascata({ pila, setPila }: { pila: Passo[]; setPila: (p: Passo[]) => void }) {
  const { t } = useTranslation("hr");
  const corrente = pila[pila.length - 1];
  const apri = (p: Passo) => setPila([...pila, p]);
  return (
    <Dialog open={pila.length > 0} onOpenChange={(o) => { if (!o) setPila([]); }}>
      <DialogContent className={MODALE.grande} data-testid="tassonomie-finestra">
        {corrente ? (
          <>
            <nav aria-label={t("tassonomie.filo")} className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {pila.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="h-3 w-3" aria-hidden /> : null}
                  {i === pila.length - 1 ? (
                    <span className="font-medium text-foreground">{titoloPasso(p)}</span>
                  ) : (
                    <button type="button" className="underline-offset-2 hover:underline" onClick={() => setPila(pila.slice(0, i + 1))}>
                      {titoloPasso(p)}
                    </button>
                  )}
                </span>
              ))}
            </nav>
            <DialogTitle>{titoloPasso(corrente)}</DialogTitle>
            <DialogDescription className="sr-only">{t("tassonomie.descrizioneFinestra")}</DialogDescription>
            {corrente.tipo === "codice" ? (
              <SchedaCodice passo={corrente} apri={apri} />
            ) : (
              <SchedaCompetenza competenza={corrente.competenza} apri={apri} />
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Elenco({ voci, vuoto }: { voci: Array<{ chiave: string; testo: string; nota?: string; onClick: () => void }>; vuoto: string }) {
  if (voci.length === 0) return <p className="text-sm text-muted-foreground">{vuoto}</p>;
  return (
    <ul className="divide-y rounded-md border">
      {voci.map((v) => (
        <li key={v.chiave}>
          <button type="button" onClick={v.onClick} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60">
            <span>{v.testo}</span>
            {v.nota ? <span className="shrink-0 text-xs text-muted-foreground">{v.nota}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{titolo}</h3>
      {children}
    </section>
  );
}

function SchedaCodice({ passo, apri }: { passo: Extract<Passo, { tipo: "codice" }>; apri: (p: Passo) => void }) {
  const { t } = useTranslation("hr");
  const cat = useCatalogo(passo.tipoCodice, passo.scheme);
  const tutti = useMemo(() => cat.data ?? [], [cat.data]);
  const { codice } = passo;
  const apriCodice = (c: Codice) => apri({ tipo: "codice", tipoCodice: passo.tipoCodice, scheme: c.scheme, codice: c });
  const percorso = useMemo(() => {
    const per = new Map(tutti.map((c) => [c.code, c]));
    const out: Codice[] = [];
    let p = codice.parentCode ? per.get(codice.parentCode) : undefined;
    while (p && out.length < 12) {
      out.unshift(p);
      p = p.parentCode ? per.get(p.parentCode) : undefined;
    }
    return out;
  }, [tutti, codice]);
  const figli = tutti.filter((c) => c.parentCode === codice.code);

  // Corrispondenze fra schemi (ATECO ↔ NACE): solo per i settori.
  const ponti = useQuery({
    queryKey: ["tassonomie", "ponti", codice.id],
    enabled: passo.tipoCodice === "attivita",
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        apiFetch<{ items: ActivityClassificationMapping[] }>(`/v1/activity-classification-mappings?sourceId=${codice.id}&limit=100`),
        apiFetch<{ items: ActivityClassificationMapping[] }>(`/v1/activity-classification-mappings?targetId=${codice.id}&limit=100`),
      ]);
      const altri = new Map<string, ActivityClassificationMapping>();
      for (const m of [...a.items, ...b.items]) altri.set(m.sourceId === codice.id ? m.targetId : m.sourceId, m);
      const voci = await Promise.all(
        [...altri.entries()].map(async ([id, m]) => ({
          m,
          c: daAttivita(await apiFetch<ActivityClassification>(`/v1/activity-classifications/${id}`)),
        })),
      );
      return voci;
    },
  });

  return (
    <div className="space-y-4">
      {codice.description ? <p className="text-sm">{codice.description}</p> : null}
      <p className="text-xs text-muted-foreground">{t("tassonomie.catalogo", { catalogo: t(`tassonomie.schemi.${codice.scheme}`, { defaultValue: codice.scheme }) })}</p>
      <Sezione titolo={t("tassonomie.percorso")}>
        <Elenco
          vuoto={t("tassonomie.inCima")}
          voci={percorso.map((c) => ({ chiave: c.id, testo: `${c.code} · ${c.name}`, onClick: () => apriCodice(c) }))}
        />
      </Sezione>
      <Sezione titolo={t("tassonomie.figli", { n: figli.length })}>
        <Elenco
          vuoto={t("tassonomie.nessunFiglio")}
          voci={figli.map((c) => ({ chiave: c.id, testo: `${c.code} · ${c.name}`, onClick: () => apriCodice(c) }))}
        />
      </Sezione>
      {passo.tipoCodice === "attivita" ? (
        <Sezione titolo={t("tassonomie.corrispondenze")}>
          {ponti.isError ? (
            <StatoErrore errore={ponti.error} titolo={t("tassonomie.errore")} onRiprova={() => ponti.refetch()} />
          ) : (
            <Elenco
              vuoto={ponti.isLoading ? t("tassonomie.caricamento") : t("tassonomie.nessunaCorrispondenza")}
              voci={(ponti.data ?? []).map(({ m, c }) => ({
                chiave: c.id,
                testo: `${c.code} · ${c.name}`,
                nota: `${t(`tassonomie.schemi.${c.scheme}`, { defaultValue: c.scheme })} · ${t(`tassonomie.tipoLegame.${m.kind}`, { defaultValue: m.kind })}`,
                onClick: () => apri({ tipo: "codice", tipoCodice: "attivita", scheme: c.scheme, codice: c }),
              }))}
            />
          )}
        </Sezione>
      ) : null}
    </div>
  );
}

function SchedaCompetenza({ competenza, apri }: { competenza: Extract<Passo, { tipo: "competenza" }>["competenza"]; apri: (p: Passo) => void }) {
  const { t } = useTranslation("hr");
  const legami = useQuery({
    queryKey: ["tassonomie", "archi", competenza.skillId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [su, giu] = await Promise.all([
        apiFetch<{ items: SkillTaxonomyEdge[] }>(`/v1/skill-taxonomy-edges?childSkillId=${competenza.skillId}&limit=200`),
        apiFetch<{ items: SkillTaxonomyEdge[] }>(`/v1/skill-taxonomy-edges?parentSkillId=${competenza.skillId}&limit=200`),
      ]);
      return { su: su.items, giu: giu.items };
    },
  });
  const voce = (id: string, nome: string | null | undefined, tipo: string) => ({
    chiave: `${id}-${tipo}`,
    testo: nome ?? t("tassonomie.senzaNome"),
    nota: t(`tassonomie.tipoArco.${tipo}`, { defaultValue: tipo }),
    onClick: () =>
      apri({ tipo: "competenza", competenza: { skillId: id, name: nome ?? t("tassonomie.senzaNome"), code: "", description: null, escoUri: null } }),
  });
  return (
    <div className="space-y-4">
      {competenza.description ? <p className="text-sm">{competenza.description}</p> : null}
      {competenza.escoUri ? <p className="break-all text-xs text-muted-foreground">{competenza.escoUri}</p> : null}
      {legami.isError ? (
        <StatoErrore errore={legami.error} titolo={t("tassonomie.errore")} onRiprova={() => legami.refetch()} />
      ) : (
        <>
          <Sezione titolo={t("tassonomie.sopra")}>
            <Elenco vuoto={legami.isLoading ? t("tassonomie.caricamento") : t("tassonomie.nessunLegame")} voci={(legami.data?.su ?? []).map((e) => voce(e.parentSkillId, e.parentSkillName, e.kind))} />
          </Sezione>
          <Sezione titolo={t("tassonomie.sotto")}>
            <Elenco vuoto={legami.isLoading ? t("tassonomie.caricamento") : t("tassonomie.nessunLegame")} voci={(legami.data?.giu ?? []).map((e) => voce(e.childSkillId, e.childSkillName, e.kind))} />
          </Sezione>
        </>
      )}
    </div>
  );
}

/** Albero di un catalogo di codici: si scende un livello alla volta, oppure si cerca. */
export function NavigatoreCodici({ tipo }: { tipo: TipoCodice }) {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const [scheme, setScheme] = useState<string>(SCHEMI[tipo][0] ?? "");
  const [livello, setLivello] = useState<string | null>(null); // codice del nodo di cui si vedono i figli
  const [cerca, setCerca] = useState("");
  const [pila, setPila] = useState<Passo[]>([]);
  const cat = useCatalogo(tipo, scheme);
  const tutti = useMemo(() => cat.data ?? [], [cat.data]);

  const per = useMemo(() => new Map(tutti.map((c) => [c.code, c])), [tutti]);
  const figliDi = useMemo(() => {
    const m = new Map<string | null, Codice[]>();
    for (const c of tutti) {
      const k = c.parentCode && per.has(c.parentCode) ? c.parentCode : null;
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  }, [tutti, per]);
  const filo = useMemo(() => {
    const out: Codice[] = [];
    let p = livello ? per.get(livello) : undefined;
    while (p && out.length < 12) {
      out.unshift(p);
      p = p.parentCode ? per.get(p.parentCode) : undefined;
    }
    return out;
  }, [livello, per]);

  const q = cerca.trim().toLowerCase();
  const visibili = q.length >= 2
    ? tutti.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)).slice(0, 100)
    : figliDi.get(livello) ?? [];
  const scheda = (c: Codice) => setPila([{ tipo: "codice", tipoCodice: tipo, scheme, codice: c }]);

  return (
    <div className="space-y-3" data-testid={`tassonomie-${tipo}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1">
          {SCHEMI[tipo].map((s) => (
            <Button key={s} role="tab" aria-selected={s === scheme} size="sm" variant={s === scheme ? "default" : "outline"}
              onClick={() => { setScheme(s); setLivello(null); setCerca(""); }}>
              {t(`tassonomie.schemi.${s}`, { defaultValue: s })}
            </Button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder={t("tassonomie.cerca")} className="pl-8" aria-label={t("tassonomie.cerca")} />
        </div>
      </div>

      {cat.isError ? (
        <StatoErrore errore={cat.error} titolo={t("tassonomie.errore")} onRiprova={() => cat.refetch()} />
      ) : cat.isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">{t("tassonomie.caricamento")}</p>
      ) : tutti.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("tassonomie.catalogoVuoto")}</p>
      ) : (
        <>
          {q.length < 2 ? (
            <nav aria-label={t("tassonomie.filo")} className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <button type="button" className="underline-offset-2 hover:underline" onClick={() => setLivello(null)}>{t("tassonomie.radice")}</button>
              {filo.map((c) => (
                <span key={c.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" aria-hidden />
                  <button type="button" className="underline-offset-2 hover:underline" onClick={() => setLivello(c.code)}>{c.code} · {c.name}</button>
                </span>
              ))}
            </nav>
          ) : (
            <p className="text-xs text-muted-foreground">{t("tassonomie.risultati", { n: fmt.numero(visibili.length) })}</p>
          )}
          <ul className="divide-y rounded-md border">
            {visibili.map((c) => {
              const n = figliDi.get(c.code)?.length ?? 0;
              return (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <button type="button" className="flex-1 text-left hover:underline" onClick={() => scheda(c)}>
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{c.code}</span>{c.name}
                  </button>
                  {n > 0 && q.length < 2 ? (
                    <Button size="sm" variant="outline" onClick={() => setLivello(c.code)}>
                      {t("tassonomie.scendi", { n: fmt.numero(n) })}
                    </Button>
                  ) : null}
                </li>
              );
            })}
            {visibili.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">{t("tassonomie.nessunRisultato")}</li> : null}
          </ul>
        </>
      )}
      <FinestraCascata pila={pila} setPila={setPila} />
    </div>
  );
}

/** Competenze: ricerca per nome, poi la rete dei legami, a cascata. */
export function NavigatoreCompetenze() {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const [cerca, setCerca] = useState("");
  const [cercato, setCercato] = useState("");
  const [pila, setPila] = useState<Passo[]>([]);
  const r = useQuery({
    queryKey: ["tassonomie", "competenze", cercato],
    enabled: cercato.length >= 2,
    staleTime: 60_000,
    queryFn: () => apiFetch<{ items: Skill[]; total: number }>(`/v1/skills?${new URLSearchParams({ search: cercato, limit: "50" }).toString()}`),
  });
  return (
    <div className="space-y-3" data-testid="tassonomie-competenze">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setCercato(cerca.trim()); }}>
        <Input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder={t("tassonomie.cercaCompetenza")} aria-label={t("tassonomie.cercaCompetenza")} />
        <Button type="submit" disabled={cerca.trim().length < 2}>{t("tassonomie.cercaBottone")}</Button>
      </form>
      {cercato.length < 2 ? (
        <p className="text-sm text-muted-foreground">{t("tassonomie.scriviCompetenza")}</p>
      ) : r.isError ? (
        <StatoErrore errore={r.error} titolo={t("tassonomie.errore")} onRiprova={() => r.refetch()} />
      ) : r.isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">{t("tassonomie.caricamento")}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t("tassonomie.trovate", { n: fmt.numero(r.data?.total ?? 0) })}</p>
          <Elenco
            vuoto={t("tassonomie.nessunRisultato")}
            voci={(r.data?.items ?? []).map((s) => ({ chiave: s.skillId, testo: s.name, onClick: () => setPila([{ tipo: "competenza", competenza: s }]) }))}
          />
        </>
      )}
      <FinestraCascata pila={pila} setPila={setPila} />
    </div>
  );
}
