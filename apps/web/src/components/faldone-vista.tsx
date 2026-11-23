"use client";

/**
 * apps/web/src/components/faldone-vista.tsx — la pagina individuale del Faldone dell'Utente.
 *
 * Enzo, 18/11/2026: «FALDONE DELL'UTENTE = pagina individuale AtoZ basata sulla mega API». La
 * pagina non sceglie che cosa mostrare: mostra tutto ciò che `/v1/faldone` (o `/v1/me/faldone`)
 * restituisce, capitolo per capitolo, e dice che cosa chi guarda non può vedere. Un {omissis} e un
 * vuoto sono due cose diverse e restano due cose diverse anche qui: il campo trattenuto si legge
 * «non visibile», la sezione chiusa dice il suo motivo, e i numeri in testa contano anche ciò che
 * non si apre.
 *
 * Ogni sezione con righe si apre su richiesta (`/sezioni/:id`, a pagine da 100): il faldone di una
 * persona supera le duemila voci di catalogo, e caricarle tutte all'apertura costerebbe secondi.
 *
 * Classe K01 del controllo forense del 23/11/2026: ogni testo della pagina viene dai file di lingua
 * (`ess.faldone.vista.*`), i titoli, i capitoli e i motivi arrivano dall'API nella lingua chiesta
 * (`?lingua=`), e le intestazioni delle colonne si dicono nella lingua della pagina.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { FALDONE_OMISSIS, type FaldoneIndice, type FaldoneRighe, type FaldoneSezione } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { chiediConferma } from "@/lib/api/step-up";
import { PageHeader } from "@/components/intestazione-pagina";
import { SchedePagina } from "@/components/schede-pagina";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { MaskedCell } from "@/components/masked-cell";
import { useFormat, type Formati } from "@/lib/format";
import { intestazione, type LinguaIntestazione } from "@/lib/faldone-parole";

const PAGINA = 100;
/** Le colonne che stanno in tabella; le altre si leggono nella scheda della riga (C12). */
const COLONNE_IN_TABELLA = 6;

/** La lingua della pagina, nella forma che l'API e le intestazioni capiscono. */
function linguaDi(lingua: string | undefined): LinguaIntestazione {
  return (lingua ?? "it").startsWith("en") ? "en" : "it";
}

function classe(t: TFunction, c: string): string {
  return t(`faldone.vista.classi.${c}`, { defaultValue: c });
}

function valore(v: unknown, tipo: string, fmt: Formati, t: TFunction): ReactNode {
  if (v === FALDONE_OMISSIS) return <MaskedCell />;
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? t("faldone.vista.si") : t("faldone.vista.no");
  if (typeof v === "number") return fmt.numero(v, 2);
  if (typeof v === "string") {
    if (tipo === "date") return fmt.data(v);
    if (tipo.startsWith("timestamp")) return fmt.dataOra(v);
    if (/^(numeric|integer|bigint|smallint|real|double)/.test(tipo) && v.trim() !== "" && !Number.isNaN(Number(v))) return fmt.numero(v, 2);
    return v.length > 160 ? `${v.slice(0, 160)}…` : v;
  }
  const json = JSON.stringify(v);
  return json.length > 160 ? `${json.slice(0, 160)}…` : json;
}

type Riga = { i: number; r: Record<string, unknown>; e: Record<string, string> };

/** Le righe di una sezione, a pagine, aperte su richiesta. */
function RigheSezione({ base, sezione }: { base: string; sezione: FaldoneSezione }) {
  const fmt = useFormat();
  const { t, i18n } = useTranslation("ess");
  const lingua = linguaDi(i18n.language);
  const [pagine, setPagine] = useState(1);
  const q = useQuery({
    queryKey: ["faldone", base, sezione.id, pagine, lingua],
    queryFn: async () => {
      const blocchi: FaldoneRighe[] = [];
      for (let p = 0; p < pagine; p += 1) {
        blocchi.push(await apiFetch<FaldoneRighe>(
          `${base}/sezioni/${encodeURIComponent(sezione.id)}?limit=${PAGINA}&offset=${p * PAGINA}&lingua=${lingua}`,
        ));
      }
      return blocchi;
    },
  });
  const ultimo = q.data?.[q.data.length - 1];
  const righe = useMemo<Riga[]>(() => {
    const out: Riga[] = [];
    for (const b of q.data ?? []) b.righe.forEach((r, k) => out.push({ i: out.length, r, e: b.etichette[k] ?? {} }));
    return out;
  }, [q.data]);
  const colonne = useMemo<DataColumn<Riga>[]>(() => {
    const cs = ultimo?.colonne ?? [];
    // Un identificativo grezzo non è un dato da leggere: va nella scheda, a meno che abbia un'etichetta.
    const conEtichetta = new Set(righe.flatMap((x) => Object.keys(x.e)));
    const leggibili = cs.filter((c) => c.tipo !== "uuid" || conEtichetta.has(c.nome));
    const ordinate = [...leggibili, ...cs.filter((c) => !leggibili.includes(c))];
    return ordinate.map((c, j) => ({
      header: intestazione(c.nome, sezione.tabella, lingua),
      secondaria: j >= COLONNE_IN_TABELLA || !leggibili.includes(c),
      cell: (x: Riga) => (x.e[c.nome] ? x.e[c.nome] : valore(x.r[c.nome], c.tipo, fmt, t)),
    }));
  }, [ultimo, righe, sezione.tabella, fmt, lingua, t]);

  if (q.isLoading) return <StatoCaricamento etichetta={t("faldone.vista.caricamentoRighe")} />;
  if (q.isError) return <StatoErrore errore={q.error} />;
  return (
    <div className="flex flex-col gap-2">
      <EntityTable<Riga>
        isLoading={false}
        isError={false}
        rows={righe}
        rowKey={(x) => String(x.i)}
        rowTestId="faldone-riga"
        columns={colonne}
        pageSize={25}
        originPath={`${base}/sezioni/${sezione.id}`}
        emptyTitle={t("faldone.vista.nessunaRiga")}
      />
      {ultimo ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("faldone.vista.righeDi", { n: fmt.numero(righe.length), totale: fmt.numero(ultimo.totale) })}</span>
          {ultimo.prossimo !== null ? (
            <Button type="button" size="sm" variant="outline" data-testid="faldone-altre" onClick={() => setPagine((n) => n + 1)}>
              {t("faldone.vista.mostraAltre")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SchedaSezione({ base, sezione }: { base: string; sezione: FaldoneSezione }) {
  const fmt = useFormat();
  const { t, i18n } = useTranslation("ess");
  const lingua = linguaDi(i18n.language);
  const [aperta, setAperta] = useState(false);
  const chiusa = sezione.visibilita === "omissis";
  return (
    <Card data-testid="faldone-sezione" data-sezione={sezione.id} data-visibilita={sezione.visibilita}>
      <CardHeader className="pb-2">
        <CardTitle as="h2" className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>
            {sezione.titolo}
            <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">{fmt.numero(sezione.righe)}</span>
          </span>
          <span className="flex flex-wrap items-center gap-2 text-xs font-normal text-muted-foreground">
            <span>{classe(t, sezione.classe)}</span>
            <span>·</span>
            <span>{sezione.legame === "soggetto" ? t("faldone.vista.legameSoggetto") : t("faldone.vista.legameRelazione")}</span>
            <span>·</span>
            <span data-testid="faldone-visibilita">{t(`faldone.vista.visibilita.${sezione.visibilita}`)}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        {sezione.motivoOmissis ? (
          <p className="text-xs text-muted-foreground" data-testid="faldone-motivo">
            {t("faldone.vista.motivo", { motivo: sezione.motivoOmissis })}
            {sezione.campiOmessi.length > 0 && !chiusa
              ? ` (${sezione.campiOmessi.map((c) => intestazione(c, sezione.tabella, lingua)).join(", ")})`
              : ""}
          </p>
        ) : null}
        {sezione.righe === 0 ? (
          <StatoVuoto titolo={t("faldone.vista.nessunDato")} compatto />
        ) : aperta ? (
          <RigheSezione base={base} sezione={sezione} />
        ) : (
          <div>
            <Button type="button" size="sm" variant="outline" data-testid="faldone-apri" onClick={() => setAperta(true)}>
              {chiusa ? t("faldone.vista.mostraStruttura") : t("faldone.vista.mostraRighe")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * `base` è `/v1/me/faldone` (il proprio) o `/v1/faldone/<userId>` (un'altra persona).
 * `indietro` è il collegamento sopra il titolo.
 */
export function FaldoneVista({ base, indietro }: { base: string; indietro?: ReactNode }) {
  const fmt = useFormat();
  const { t, i18n } = useTranslation("ess");
  const lingua = linguaDi(i18n.language);
  const q = useQuery({
    queryKey: ["faldone", base, "indice", lingua],
    queryFn: () => apiFetch<FaldoneIndice>(`${base}?lingua=${lingua}`),
  });
  const [soloConDati, setSoloConDati] = useState(true);

  if (q.isLoading) return <StatoCaricamento etichetta={t("faldone.vista.caricamento")} testId="faldone-caricamento" />;
  if (q.isError || !q.data) return <StatoErrore errore={q.error} testId="faldone-errore" />;
  const d = q.data;

  // Il capitolo si raccoglie per identificativo, uguale in ogni lingua: `?scheda=` resta lo stesso.
  const capitoli = new Map<string, { titolo: string; sezioni: FaldoneSezione[] }>();
  for (const s of d.sezioni) {
    if (soloConDati && s.righe === 0) continue;
    const c = capitoli.get(s.capitoloId) ?? { titolo: s.capitolo, sezioni: [] };
    c.sezioni.push(s);
    capitoli.set(s.capitoloId, c);
  }
  const schede = [...capitoli.entries()]
    .sort((a, b) => a[1].titolo.localeCompare(b[1].titolo, lingua))
    .map(([id, { titolo, sezioni }]) => ({
      id,
      titolo,
      conteggio: sezioni.reduce((n, s) => n + s.righe, 0),
      contenuto: (
        <div className="flex flex-col gap-3">
          {sezioni
            .sort((a, b) => b.righe - a.righe || a.titolo.localeCompare(b.titolo, lingua))
            .map((s) => <SchedaSezione key={s.id} base={base} sezione={s} />)}
        </div>
      ),
    }));

  return (
    <div className="flex flex-col gap-3" data-testid="faldone-pagina">
      <PageHeader
        title={t("faldone.vista.titolo", { nome: d.persona.nome })}
        breadcrumbs={indietro}
        description={t("faldone.vista.descrizione")}
      />
      {d.confermaRichiesta.length > 0 ? (
        <div role="status" data-testid="faldone-conferma"
          className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-muted/40 px-4 py-3 text-sm">
          <span>{t("faldone.vista.conferma", {
            classi: d.confermaRichiesta.map((c) => classe(t, c).toLowerCase()).join(t("faldone.vista.congiunzione")),
          })}</span>
          <Button type="button" size="sm" data-testid="faldone-conferma-azione"
            onClick={() => { void chiediConferma().then((ok) => { if (ok) void q.refetch(); }); }}>
            {t("faldone.vista.confermaAzione")}
          </Button>
        </div>
      ) : null}
      <Card data-testid="faldone-totali">
        <CardContent className="grid grid-cols-2 gap-3 pt-6 text-sm sm:grid-cols-5">
          <Totale etichetta={t("faldone.vista.totaleRighe")} valore={fmt.numero(d.totali.righe)} testId="faldone-totale-righe" />
          <Totale etichetta={t("faldone.vista.totaleSezioniConDati")}
            valore={t("faldone.vista.diTotale", { n: fmt.numero(d.totali.sezioniConDati), totale: fmt.numero(d.totali.sezioni) })} />
          <Totale etichetta={t("faldone.vista.totaleVoci")} valore={fmt.numero(d.totali.campiCatalogo)} />
          <Totale etichetta={t("faldone.vista.totaleOmissis")} valore={fmt.numero(d.totali.sezioniConOmissis)} />
          <Totale etichetta={t("faldone.vista.generatoIl")} valore={fmt.dataOra(d.generatoIl)} />
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={soloConDati} data-testid="faldone-solo-con-dati"
            onChange={(e) => setSoloConDati(e.target.checked)} />
          {t("faldone.vista.soloConDati")}
        </label>
        <span className="ml-auto">
          <Button type="button" size="sm" variant="outline" data-testid="faldone-aggiorna" onClick={() => void q.refetch()}>
            {t("faldone.vista.aggiorna")}
          </Button>
        </span>
      </div>
      {schede.length === 0 ? <StatoVuoto titolo={t("faldone.vista.nessunDatoPersona")} /> : <SchedePagina schede={schede} />}
    </div>
  );
}

function Totale({ etichetta, valore: v, testId }: { etichetta: string; valore: string; testId?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{etichetta}</span>
      <span className="font-semibold tabular-nums" data-testid={testId}>{v}</span>
    </div>
  );
}
