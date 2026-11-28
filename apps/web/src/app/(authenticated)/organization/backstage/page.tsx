"use client";

/**
 * /organization/backstage — il Backstage: l'organizzazione ghost del tenant (ADR-0063 D2, voce G1
 * del piano AI-driven). Nel frontend si chiama «Backstage» in tutte le lingue (Enzo, 28/11/2026).
 *
 * Il vertice, le divisioni e le direzioni, derivati dal vivo dall'albero delle unità: per ognuna un
 * Capo agente affiancherà il responsabile reale. Quattro schede: l'albero navigabile (fit, rotella,
 * + −, trascinamento, doppio clic), l'elenco, la storia dei periodi e la deriva rispetto all'albero
 * vivo. Ogni unità apre la sua scheda a cascata (`scheda-ghost.tsx`), e da lì le schede rapide di
 * unità reali, persone e posizioni. La riforma riallinea la storia all'albero e parte solo dopo la
 * conferma della persona.
 *
 * Per ora il Backstage è dei soli ruoli PLATFORM_ADMIN e HRMS_MANAGER (Enzo, 28/11/2026, 000526):
 * la pagina chiede `ghost_unit:read` e il pulsante della riforma `ghost_unit:reform`, come l'API.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Info, RefreshCw, Wrench } from "lucide-react";
import type { GhostDriftItem, GhostRiformaResponse, GhostUnit, TenantListResponse } from "@heuresys/shared";
import { Button, Card, CardContent, Dialog, DialogContent, DialogDescription, DialogTitle } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { useCan, useCurrentUser, useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";
import { useEnumLabel } from "@/lib/enum-labels";
import { MODALE } from "@/lib/modale";
import { PageHeader } from "@/components/intestazione-pagina";
import { SchedePagina } from "@/components/schede-pagina";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { LavoroInCorso } from "@/components/lavoro-in-corso";
import { StatoCaricamento, StatoErrore, StatoNegato, StatoVuoto } from "@/components/stato-pagina";
import { StatusPill } from "@/components/status-pill";
import { Riferimento } from "@/components/scheda-rapida";
import { OrganigrammaBlocchi } from "@/components/organigramma/blocchi";
import { useOrganigramma } from "@/components/organigramma/dati";
import { CHIAVE_GHOST, ghostABlocchi, useDerivaGhost, useGhost, useStoriaGhost, type UnitaViva } from "./_components/dati";
import { NomeGhost, SchedeGhostProvider, useSchedaGhost, valoreTratto, type DatiBackstage } from "./_components/scheda-ghost";
import { GuidaBackstage } from "./_components/guida";

export default function BackstagePage() {
  const { t } = useTranslation("admin");
  const richiesto = useSearchParams().get("tenantId");
  const me = useCurrentUser();
  const elenco = useQuery({
    queryKey: ["tenants", "scelta-organigramma"],
    queryFn: ({ signal }) => apiFetch<TenantListResponse>("/v1/tenants?limit=200", { signal }),
    retry: false,
    staleTime: 300_000,
  });
  const clienti = useMemo(
    () => (elenco.data?.items ?? []).filter((x) => x.tenantStatus === "ACTIVE").sort((a, b) => a.tenantName.localeCompare(b.tenantName, "it")),
    [elenco.data],
  );
  const [scelto, setScelto] = useState("");
  // Come l'organigramma: un mandato di piattaforma parte dal primo cliente, non dalla piattaforma.
  const predefinito = clienti.length > 1 && me.data ? (clienti.find((x) => x.tenantId !== me.data?.tenantId)?.tenantId ?? null) : null;
  const tenantId = richiesto ?? (scelto || predefinito);
  const [guida, setGuida] = useState(false);
  const permessi = useCurrentUserPermissions();
  const puoVedere = useCan("ghost_unit:read");

  return (
    <div data-testid="backstage-page" className="mx-auto max-w-[96rem] space-y-6 px-6 pb-8">
      <PageHeader
        data-testid="backstage-title"
        title={t("backstage.title")}
        badges={
          <button
            type="button"
            onClick={() => setGuida(true)}
            aria-label={t("backstage.guida.apri")}
            title={t("backstage.guida.apri")}
            data-testid="backstage-guida-apri"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Info className="h-5 w-5" aria-hidden />
          </button>
        }
        description={t("backstage.description")}
        breadcrumbs={
          <Link href="/organization/org-chart" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {t("backstage.back")}
          </Link>
        }
      />
      <GuidaBackstage aperta={guida} onChiudi={() => setGuida(false)} />
      {permessi.isLoading ? (
        <StatoCaricamento testId="backstage-permessi" />
      ) : !puoVedere ? (
        <StatoNegato motivo={t("backstage.negato")} testId="backstage-negato" />
      ) : (<>
      {clienti.length > 1 && !richiesto ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("orgChart.cliente")}</span>
          <select value={tenantId ?? ""} onChange={(e) => setScelto(e.target.value)} className="rounded border border-border bg-background px-2 py-1" data-testid="backstage-cliente">
            {clienti.map((x) => <option key={x.tenantId} value={x.tenantId}>{x.tenantName}</option>)}
          </select>
        </label>
      ) : null}
      <Card>
        <CardContent className="pt-6">
          <Backstage tenantId={tenantId} />
        </CardContent>
      </Card>
      </>)}
    </div>
  );
}

function Backstage({ tenantId }: { tenantId: string | null }) {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const qc = useQueryClient();
  const g = useGhost(tenantId);
  const st = useStoriaGhost(tenantId);
  const dr = useDerivaGhost(tenantId);
  const org = useOrganigramma(tenantId);
  const letture = [g, st, dr, org];
  const fatte = letture.filter((q) => !q.isLoading).length;
  const inCorso = letture.some((q) => q.isFetching);

  const vive = useMemo(() => new Map<string, UnitaViva>((org.data?.unita ?? []).map((u) => [u.id, u])), [org.data]);
  const dati: DatiBackstage = useMemo(() => ({
    attive: g.data?.items ?? [],
    storia: st.data?.items ?? [],
    deriva: dr.data?.items ?? [],
    vive,
    posizioni: org.data?.posizioni ?? [],
  }), [g.data, st.data, dr.data, vive, org.data]);

  const aggiorna = () => Promise.all([
    qc.invalidateQueries({ queryKey: CHIAVE_GHOST }),
    qc.invalidateQueries({ queryKey: ["me", "organigramma"] }),
    qc.invalidateQueries({ queryKey: ["me", "rubrica"] }),
  ]);

  if (fatte < letture.length) {
    return (
      <div data-testid="backstage-caricamento">
        <LavoroInCorso
          attivo
          titolo={t("backstage.caricamento.titolo")}
          dettaglio={t("backstage.caricamento.dettaglio", { fatte: fmt.numero(fatte), totale: fmt.numero(letture.length) })}
          valore={fatte}
          massimo={letture.length}
        />
      </div>
    );
  }
  if (g.isError) return <StatoErrore errore={g.error} titolo={t("backstage.errore")} testId="backstage-errore" onRiprova={() => void g.refetch()} />;

  const attive = dati.attive;
  const quanti = (k: GhostUnit["kind"]) => attive.filter((x) => x.kind === k).length;
  const allineata = dr.data?.allineata ?? g.data?.allineata ?? true;

  return (
    <SchedeGhostProvider dati={dati}>
      <div className="space-y-3" data-testid="backstage">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm" data-testid="backstage-riepilogo">
            <span className="font-semibold">{org.data?.cliente ?? ""}</span>{" "}
            <span className="text-muted-foreground">
              — {t("backstage.riepilogo", { unita: fmt.numero(attive.length), divisioni: fmt.numero(quanti("DIVISIONE")), direzioni: fmt.numero(quanti("DIREZIONE")) })}
            </span>
          </p>
          {allineata
            ? <StatusPill tone="success">{t("backstage.stati.formaAllineata")}</StatusPill>
            : <StatusPill tone="warning">{t("backstage.stati.formaDaRiformare", { count: dati.deriva.length })}</StatusPill>}
          {dr.data ? <span className="ml-auto text-xs text-muted-foreground" data-testid="backstage-calcolato">{t("backstage.calcolato", { quando: fmt.dataOra(dr.data.calcolataIl) })}</span> : <span className="ml-auto" />}
          <Button type="button" variant="outline" size="sm" onClick={() => void aggiorna()} disabled={inCorso} data-testid="backstage-aggiorna">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${inCorso ? "animate-spin" : ""}`} />
            {inCorso ? t("backstage.aggiornando") : t("backstage.aggiorna")}
          </Button>
        </div>
        {inCorso ? <div className="h-1 w-full overflow-hidden rounded bg-muted" role="progressbar" aria-label={t("backstage.aggiornando")} aria-valuemin={0} aria-valuemax={letture.length} aria-valuenow={letture.filter((q) => !q.isFetching).length}>
          <div className="h-full bg-primary transition-all" style={{ width: `${(letture.filter((q) => !q.isFetching).length / letture.length) * 100}%` }} />
        </div> : null}
        {attive.length === 0 ? (
          <StatoVuoto titolo={t("backstage.vuoto")} motivo={t("backstage.vuotoMotivo")} testId="backstage-vuoto" />
        ) : (
          <SchedePagina
            schede={[
              { id: "albero", titolo: t("backstage.schede.albero"), contenuto: <Albero dati={dati} /> },
              { id: "elenco", titolo: t("backstage.schede.elenco"), conteggio: attive.length, contenuto: <Elenco dati={dati} /> },
              { id: "storia", titolo: t("backstage.schede.storia"), conteggio: dati.storia.length, contenuto: <Storia dati={dati} isError={st.isError} error={st.error} /> },
              { id: "deriva", titolo: t("backstage.schede.deriva"), conteggio: dati.deriva.length, contenuto: <Deriva dati={dati} tenantId={tenantId} isError={dr.isError} error={dr.error} /> },
            ]}
          />
        )}
      </div>
    </SchedeGhostProvider>
  );
}

function Albero({ dati }: { dati: DatiBackstage }) {
  const { t } = useTranslation("admin");
  const s = useSchedaGhost();
  const blocchi = useMemo(() => ghostABlocchi(dati.attive, dati.vive), [dati.attive, dati.vive]);
  const perSorgente = useMemo(() => new Map(dati.attive.filter((g) => g.sourceUnitId).map((g) => [g.sourceUnitId!, g.ghostUnitId])), [dati.attive]);
  const evidenzia = useMemo(() => new Set(dati.deriva.map((d) => d.sourceUnitId).filter((x): x is string => !!x)), [dati.deriva]);
  return (
    <div className="space-y-2" data-testid="backstage-albero">
      <p className="text-xs text-muted-foreground">{t("backstage.legendaAlbero")}{evidenzia.size ? ` ${t("backstage.legendaDeriva")}` : ""}</p>
      <OrganigrammaBlocchi
        unita={blocchi}
        onApri={(id) => { const gid = perSorgente.get(id); if (gid) s?.apri(gid); }}
        evidenzia={evidenzia}
        nomeFile="backstage"
        ariaLabel={t("backstage.ariaAlbero")}
        altezzaMax="72vh"
        testId="backstage-albero-area"
      />
    </div>
  );
}

function Elenco({ dati }: { dati: DatiBackstage }) {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const derivate = new Map(dati.deriva.map((d) => [d.sourceUnitId, d]));
  const sopraDi = (g: GhostUnit) => dati.attive.find((x) => x.sourceUnitId && x.sourceUnitId === g.sourceParentId);
  const c = (k: string) => t(`backstage.colonne.${k}`);
  const colonne: DataColumn<GhostUnit>[] = [
    { header: c("unita"), cell: (g) => <NomeGhost g={g} /> },
    { header: c("tipo"), cell: (g) => t(`backstage.tipi.${g.kind}`) },
    { header: c("livello"), cell: (g) => t(`backstage.livelli.${g.level}`) },
    { header: c("sopra"), cell: (g) => { const x = sopraDi(g); return x ? <NomeGhost g={x} /> : <span className="text-muted-foreground">—</span>; } },
    { header: c("responsabile"), cell: (g) => (g.managerUserId && g.managerName ? <Riferimento tipo="persona" id={g.managerUserId}>{g.managerName}</Riferimento> : <span className="text-xs text-muted-foreground">{t("backstage.senzaResponsabile")}</span>) },
    { header: c("persone"), align: "right", cell: (g) => { const v = g.sourceUnitId ? dati.vive.get(g.sourceUnitId) : undefined; return <span className="tabular-nums">{v ? fmt.numero(v.addettiTotali) : "—"}</span>; } },
    { header: c("inVigoreDal"), cell: (g) => <span className="tabular-nums">{fmt.data(g.validFrom)}</span> },
    { header: c("codice"), secondaria: true, cell: (g) => g.code },
    {
      header: c("stato"),
      cell: (g) => { const d = derivate.get(g.sourceUnitId); return d ? <StatusPill tone="warning">{t(`backstage.deriva.cambi.${d.change}`)}</StatusPill> : <StatusPill tone="success">{t("backstage.stati.allineata")}</StatusPill>; },
    },
  ];
  return (
    <EntityTable
      isLoading={false}
      isError={false}
      rows={dati.attive}
      rowKey={(g) => g.ghostUnitId}
      rowTestId="backstage-riga"
      columns={colonne}
      caption={t("backstage.elencoCaption", { count: dati.attive.length })}
      originPath="/v1/ghost-units"
      pageSize={50}
    />
  );
}

function Storia({ dati, isError, error }: { dati: DatiBackstage; isError: boolean; error: unknown }) {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const c = (k: string) => t(`backstage.colonne.${k}`);
  const colonne: DataColumn<GhostUnit>[] = [
    { header: c("unita"), cell: (g) => <NomeGhost g={g} /> },
    { header: c("tipo"), cell: (g) => t(`backstage.tipi.${g.kind}`) },
    { header: c("dal"), cell: (g) => <span className="tabular-nums">{fmt.dataOra(g.validFrom)}</span> },
    { header: c("al"), cell: (g) => <span className="tabular-nums">{g.validTo ? fmt.dataOra(g.validTo) : "—"}</span> },
    { header: c("motivoApertura"), cell: (g) => t(`backstage.aperture.${g.openedReason}`) },
    { header: c("motivoChiusura"), cell: (g) => (g.closedReason ? t(`backstage.chiusure.${g.closedReason}`) : "—") },
    { header: c("stato"), cell: (g) => (g.validTo ? <StatusPill tone="neutral">{t("backstage.stati.periodoChiuso")}</StatusPill> : <StatusPill tone="success">{t("backstage.stati.periodoAperto")}</StatusPill>) },
  ];
  return (
    <div className="space-y-2" data-testid="backstage-storia">
      <p className="text-xs text-muted-foreground">{t("backstage.legendaStoria")}</p>
      <EntityTable
        isLoading={false}
        isError={isError}
        error={error}
        rows={dati.storia}
        rowKey={(g) => g.ghostUnitId}
        rowTestId="backstage-storia-riga"
        columns={colonne}
        caption={t("backstage.storiaCaption", { count: dati.storia.length })}
        originPath="/v1/ghost-units/storia"
        pageSize={50}
        emptyTitle={t("backstage.storiaVuota")}
      />
    </div>
  );
}

function Deriva({ dati, tenantId, isError, error }: { dati: DatiBackstage; tenantId: string | null; isError: boolean; error: unknown }) {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const puoRiformare = useCan("ghost_unit:reform");
  const [conferma, setConferma] = useState(false);
  const riforma = useMutation({
    mutationFn: () => apiFetch<GhostRiformaResponse>("/v1/ghost-units/riforma", { method: "POST", body: tenantId ? { tenantId } : {} }),
    onSuccess: async () => {
      setConferma(false);
      await qc.invalidateQueries({ queryKey: CHIAVE_GHOST });
    },
  });
  const nomeUnita = (id: string) => dati.vive.get(id)?.nome;
  const c = (k: string) => t(`backstage.colonne.${k}`);
  const colonne: DataColumn<GhostDriftItem>[] = [
    { header: c("unita"), cell: (d) => { const n = (d.live ?? d.ghost)!.name; return d.sourceUnitId && dati.vive.has(d.sourceUnitId) ? <Riferimento tipo="unita" id={d.sourceUnitId}>{n}</Riferimento> : n; } },
    { header: c("tipo"), cell: (d) => t(`backstage.tipi.${(d.live ?? d.ghost)!.kind}`) },
    {
      header: c("cheCosaCambia"),
      cell: (d) => d.change === "MODIFICATA"
        ? <ul className="space-y-0.5 text-xs">{d.changedFields.map((f) => <li key={f}><span className="text-muted-foreground">{t(`backstage.deriva.campi.${f}`)}:</span> {valoreTratto(f, d.ghost, t, enumLabel, nomeUnita)} → <strong>{valoreTratto(f, d.live, t, enumLabel, nomeUnita)}</strong></li>)}</ul>
        : <span className="text-xs">{t(`backstage.deriva.spiega.${d.change}`)}</span>,
    },
    { header: c("stato"), cell: (d) => <StatusPill tone={d.change === "USCITA" ? "danger" : d.change === "NUOVA" ? "info" : "warning"}>{t(`backstage.deriva.cambi.${d.change}`)}</StatusPill> },
  ];
  const riepilogo = riforma.data;
  return (
    <div className="space-y-3" data-testid="backstage-deriva">
      <p className="text-xs text-muted-foreground">{t("backstage.legendaDerivaScheda")}</p>
      {riepilogo ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" data-testid="backstage-riforma-esito" role="status">
          {t("backstage.riforma.esito", { aperte: fmt.numero(riepilogo.aperte), chiuse: fmt.numero(riepilogo.chiuse), attive: fmt.numero(riepilogo.attive) })}
        </p>
      ) : null}
      {dati.deriva.length === 0 && !isError ? (
        <StatoVuoto titolo={t("backstage.deriva.nessunaTitolo")} motivo={t("backstage.deriva.nessunaMotivo")} testId="backstage-deriva-vuota" />
      ) : (
        <>
          {puoRiformare ? (
            <Button type="button" size="sm" onClick={() => setConferma(true)} disabled={riforma.isPending} data-testid="backstage-riforma">
              <Wrench className="mr-1.5 h-3.5 w-3.5" />{t("backstage.riforma.pulsante")}
            </Button>
          ) : <p className="text-xs text-muted-foreground">{t("backstage.riforma.senzaPermesso")}</p>}
          <EntityTable
            isLoading={false}
            isError={isError}
            error={error}
            rows={dati.deriva}
            rowKey={(d) => `${d.change}-${d.sourceUnitId ?? (d.live ?? d.ghost)!.code}`}
            rowTestId="backstage-deriva-riga"
            columns={colonne}
            caption={t("backstage.derivaCaption", { count: dati.deriva.length })}
            originPath="/v1/ghost-units/deriva"
          />
        </>
      )}
      <Dialog open={conferma} onOpenChange={(o) => { if (!riforma.isPending) setConferma(o); }}>
        <DialogContent className={MODALE.piccola} data-testid="backstage-riforma-conferma">
          <DialogTitle>{t("backstage.riforma.titolo")}</DialogTitle>
          <DialogDescription>{t("backstage.riforma.testo", { count: dati.deriva.length })}</DialogDescription>
          {riforma.isError ? <StatoErrore errore={riforma.error} titolo={t("backstage.riforma.errore")} testId="backstage-riforma-errore" /> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConferma(false)} disabled={riforma.isPending}>{t("backstage.riforma.annulla")}</Button>
            <Button type="button" size="sm" onClick={() => riforma.mutate()} disabled={riforma.isPending} data-testid="backstage-riforma-conferma-si">
              {riforma.isPending ? t("backstage.riforma.inCorso") : t("backstage.riforma.conferma")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
