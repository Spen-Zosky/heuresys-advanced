"use client";

/**
 * apps/web/src/app/(authenticated)/tenant-processes/[id]/page.tsx — la scheda del processo (V5).
 *
 * Tutto da `GET /v1/processes/:id/scheda`, la stessa scheda che legge l'agente (V8). Schede
 * orizzontali: descrizione (scopo, responsabile, sottoprocessi, chi fa che cosa), attività, unità e
 * ruoli (RACI con le persone), flusso a corsie, grafo, indicatori e competenze, approvazioni e
 * progetti. Unità, posizioni e persone si aprono nella finestra a cascata (`Riferimento`); un
 * sottoprocesso apre la sua scheda; un'attività apre la sua finestra.
 */
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogTitle } from "@heuresys/ui";
import type { TenantProcessScheda } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useFormat } from "@/lib/format";
import { useEnumLabel } from "@/lib/enum-labels";
import { MODALE } from "@/lib/modale";
import { RIPIEGABILE } from "@/lib/colonne-mobile";
import { PageHeader } from "@/components/intestazione-pagina";
import { OggettoContato } from "@/components/processo/oggetto-contato";
import { ClassificazioneProcesso, useFaccetteProcesso } from "@/components/processo/classificazione-processo";
import { CorrispondenzaApqc } from "@/components/processo/corrispondenza-apqc";
import { SchedePagina } from "@/components/schede-pagina";
import { Riferimento, useScheda } from "@/components/scheda-rapida";
import { StatoCaricamento, StatoErrore } from "@/components/stato-pagina";
import { NomeOppure } from "@/components/senza-nome";
import { DiagrammaFasi, FlussoCorsie, GrafoProcesso, attivitaInOrdine } from "@/components/processo/diagrammi";

type Attivita = TenantProcessScheda["activities"][number];

function Tabella({ testId, intestazioni, righe, vuoto }: { testId: string; intestazioni: string[]; righe: ReactNode[][]; vuoto: string }) {
  if (righe.length === 0) return <p className="text-sm text-muted-foreground" data-testid={`${testId}-vuoto`}>{vuoto}</p>;
  return (
    // K18: a 390 px la tabella usciva dallo schermo; sotto md ogni riga si ripiega in una scheda.
    <div className="overflow-x-auto rounded-md border border-border">
      <table className={RIPIEGABILE.tabella} data-testid={testId}>
        <thead className={`${RIPIEGABILE.intestazione} bg-muted/50 text-left text-xs text-muted-foreground`}>
          <tr>{intestazioni.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className={RIPIEGABILE.corpo}>
          {righe.map((r, i) => (
            <tr key={i} className={RIPIEGABILE.riga} data-testid={`${testId}-riga`}>
              {r.map((c, k) => (
                <td key={k} className={RIPIEGABILE.cella}>
                  <span className={RIPIEGABILE.etichetta}>{intestazioni[k]}</span>
                  <span className="min-w-0 break-words">{c}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Campo({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{etichetta}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default function TenantProcessPage() {
  const { t } = useTranslation("blueprints");
  const fmt = useFormat();
  const enumLabel = useEnumLabel();
  const router = useRouter();
  const schede = useScheda();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [aperta, setAperta] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["processes", "scheda", id],
    queryFn: ({ signal }) => apiFetch<TenantProcessScheda>(`/v1/processes/${id}/scheda`, { signal }),
    enabled: Boolean(id),
    staleTime: 60_000,
    retry: 0,
  });
  const s = q.data;
  const att = useMemo(() => (s ? attivitaInOrdine(s) : []), [s]);
  const nomeProcesso = useMemo(
    () => new Map(s ? [[s.process.processId, s.process.name], ...s.subprocesses.map((p) => [p.processId, p.name] as [string, string])] : []),
    [s],
  );
  // ADR-0061 D4: la classificazione per faccette. Chi non ha `bpm_process:read` non vede la scheda.
  const faccette = useFaccetteProcesso(id ?? "");

  if (q.isLoading) return <main className="px-6 pb-8"><StatoCaricamento testId="tenant-process-loading" /></main>;
  if (q.isError || !s) {
    return (
      <main className="px-6 pb-8">
        <StatoErrore errore={q.error} titolo={t("processiDelTenant.scheda.error")} testId="tenant-process-error" onRiprova={() => void q.refetch()} />
      </main>
    );
  }

  const k = (x: string) => t(`processiDelTenant.scheda.colonne.${x}`);
  const p = s.process;
  const unita = (uid: string | null, nome: string | null) => (uid ? <Riferimento tipo="unita" id={uid}>{nome ?? ""}</Riferimento> : (nome ?? t("processiDelTenant.scheda.nessuno")));
  const apriUnita = schede ? (uid: string) => schede.apri("unita", uid) : undefined;
  const apriProcesso = (pid: string) => router.push(`/tenant-processes/${pid}`);
  const attivitaAperta: Attivita | undefined = att.find((a) => a.activityId === aperta);
  const conSotto = s.subprocesses.length > 0;

  // Chi fa che cosa: per ogni unità (o esecutore senza unità), le attività in ordine.
  const perUnita = new Map<string, { uid: string | null; nome: string; attivita: Attivita[] }>();
  for (const a of att) {
    const chiave = a.unitId ?? `x:${a.executorName ?? ""}`;
    const v = perUnita.get(chiave) ?? { uid: a.unitId, nome: a.unitName ?? a.executorName ?? t("processiDelTenant.scheda.senzaUnita"), attivita: [] };
    v.attivita.push(a);
    perUnita.set(chiave, v);
  }

  const descrizione = (
    <div className="space-y-6" data-testid="tenant-process-descrizione">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo etichetta={t("processiDelTenant.scheda.scopo")}>{p.description ?? <span className="text-muted-foreground">{t("processiDelTenant.scheda.senzaScopo")}</span>}</Campo>
          </div>
          <Campo etichetta={t("processiDelTenant.scheda.responsabile")}>
            {p.ownerPositionId ? (
              <span data-testid="tenant-process-owner">
                <Riferimento tipo="posizione" id={p.ownerPositionId}>{p.ownerPositionTitle ?? ""}</Riferimento>
                <span className="block text-xs text-muted-foreground">{p.ownerName ?? t("processiDelTenant.scheda.posizioneScoperta")}</span>
              </span>
            ) : <span className="text-muted-foreground">{t("processiDelTenant.scheda.senzaResponsabile")}</span>}
          </Campo>
          <Campo etichetta={t("processiDelTenant.scheda.sottoprocessi")}>
            {conSotto ? (
              <ul className="space-y-0.5" data-testid="tenant-process-sottoprocessi">
                {s.subprocesses.map((x) => (
                  <li key={x.processId}><Link href={`/tenant-processes/${x.processId}`} className="hover:underline">{x.name}</Link> <span className="text-xs text-muted-foreground">({fmt.numero(x.activityCount)})</span></li>
                ))}
              </ul>
            ) : <span className="text-muted-foreground">{t("processiDelTenant.scheda.nessunSottoprocesso")}</span>}
          </Campo>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle as="h2">{t("processiDelTenant.scheda.chiFaCosa")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("processiDelTenant.scheda.chiFaCosaNota")}</p>
          {perUnita.size === 0 ? <p className="text-sm text-muted-foreground">{t("processiDelTenant.scheda.nessunaAttivita")}</p> : (
            <ul className="space-y-3" data-testid="tenant-process-chi-fa-cosa">
              {[...perUnita.values()].map((u) => (
                <li key={u.uid ?? u.nome}>
                  <p className="text-sm font-semibold">{unita(u.uid, u.nome)}</p>
                  <ol className="ml-4 list-decimal text-sm">
                    {u.attivita.map((a) => <li key={a.activityId}>{a.name}{conSotto && a.processId !== p.processId ? <span className="text-xs text-muted-foreground"> — {nomeProcesso.get(a.processId)}</span> : null}</li>)}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const attivita = (
    <Tabella
      testId="tenant-process-attivita"
      vuoto={t("processiDelTenant.scheda.nessunaAttivita")}
      intestazioni={[k("ordinal"), k("activity"), ...(conSotto ? [k("subprocess")] : []), k("input"), k("output"), k("unit"), k("executor"), k("nature"), k("delivery"), k("hours"), k("apqc")]}
      righe={att.map((a) => [
        <span key="o" className="tabular-nums text-xs text-muted-foreground">{a.ordinal}</span>,
        <button key="n" type="button" className="text-left font-medium hover:underline" onClick={() => setAperta(a.activityId)}>{a.name}</button>,
        ...(conSotto ? [<span key="s" className="text-xs">{nomeProcesso.get(a.processId)}</span>] : []),
        a.input ?? "—",
        a.output ?? "—",
        unita(a.unitId, a.unitName),
        a.executorPositionId ? <Riferimento tipo="posizione" id={a.executorPositionId}>{a.executorName ?? ""}</Riferimento> : (a.executorName ?? "—"),
        enumLabel("processWorkNature", a.workNature),
        enumLabel("processDeliveryModel", a.deliveryModel),
        <span key="h" className="tabular-nums">{a.typicalHoursPerCycle === null ? "—" : fmt.numero(a.typicalHoursPerCycle, 1)}</span>,
        <CorrispondenzaApqc key="apqc" processId={p.processId} attivita={a} canEdit={faccette.data?.canEdit ?? false} />,
      ])}
    />
  );

  const unitaRuoli = (
    <Tabella
      testId="tenant-process-unita"
      vuoto={t("processiDelTenant.scheda.nessunaUnita")}
      intestazioni={[k("unit"), k("participants"), k("role")]}
      righe={s.units.map((u) => [
        unita(u.unitId, u.unitName),
        u.participants.length ? (
          <ul key="p" className="space-y-0.5">{u.participants.map((x) => <li key={x.userId}><Riferimento tipo="persona" id={x.userId}><NomeOppure nome={x.fullName} id={x.userId} /></Riferimento></li>)}</ul>
        ) : "—",
        enumLabel("processUnitRole", u.role),
      ])}
    />
  );

  const indicatori = (
    <div className="space-y-6">
      <Tabella
        testId="tenant-process-kpi"
        vuoto={t("processiDelTenant.scheda.nessunKpi")}
        intestazioni={[k("kpi"), k("kpiUnit"), k("target"), k("weight")]}
        righe={s.kpis.map((x) => [
          <span key="n"><span className="font-medium">{x.name}</span>{x.description ? <span className="block text-xs text-muted-foreground">{x.description}</span> : null}</span>,
          x.unit ? enumLabel("kpiUnit", x.unit) : "—",
          x.defaultTarget === null ? "—" : fmt.numero(x.defaultTarget, 2),
          x.defaultWeight === null ? "—" : fmt.numero(x.defaultWeight, 2),
        ])}
      />
      <Tabella
        testId="tenant-process-competenze"
        vuoto={t("processiDelTenant.scheda.nessunaCompetenza")}
        intestazioni={[k("skill"), k("positions")]}
        righe={s.skills.map((x) => [x.name, <span key="n" className="tabular-nums">{fmt.numero(x.positions)}</span>])}
      />
    </div>
  );

  const collegati = (
    <div className="space-y-4">
      <p className="text-sm" data-testid="tenant-process-approvazioni">{t("processiDelTenant.scheda.approvazioni", { totale: fmt.numero(s.approvals.total), inAttesa: fmt.numero(s.approvals.pending) })}</p>
      <Tabella
        testId="tenant-process-progetti"
        vuoto={t("processiDelTenant.scheda.nessunProgetto")}
        intestazioni={[k("project"), k("status")]}
        righe={s.projects.map((x) => [<Link key="l" href={`/projects/${x.projectId}`} className="hover:underline">{x.name}</Link>, enumLabel("projectStatus", x.status)])}
      />
    </div>
  );

  return (
    <main data-testid="tenant-process-page" className="space-y-4 px-6 pb-8">
      <PageHeader
        title={p.name}
        description={t("processiDelTenant.scheda.riepilogo", { attivita: fmt.numero(att.length), unita: fmt.numero(s.units.length), sottoprocessi: fmt.numero(s.subprocesses.length) })}
        breadcrumbs={
          <span className="flex flex-wrap gap-2">
            <Link href="/tenant-processes" className="hover:underline">{t("processiDelTenant.scheda.indietro")}</Link>
            {p.parentId ? <><span aria-hidden>›</span><Link href={`/tenant-processes/${p.parentId}`} className="hover:underline">{t("processiDelTenant.scheda.sottoprocessoDi", { nome: p.parentName ?? "" })}</Link></> : null}
            {p.modelProcessName ? <span className="text-muted-foreground">· {t("processiDelTenant.scheda.modello", { nome: p.modelProcessName })}</span> : null}
          </span>
        }
      />
      <OggettoContato oggetto="configurazione" />
      <SchedePagina
        schede={[
          { id: "descrizione", titolo: t("processiDelTenant.scheda.tabs.descrizione"), contenuto: descrizione },
          {
            id: "classificazione", titolo: t("processiDelTenant.scheda.tabs.classificazione"), nascosta: !faccette.data,
            contenuto: faccette.data ? <ClassificazioneProcesso processId={p.processId} faccette={faccette.data} /> : null,
          },
          { id: "attivita", titolo: t("processiDelTenant.scheda.tabs.attivita"), conteggio: att.length, contenuto: attivita },
          { id: "unita", titolo: t("processiDelTenant.scheda.tabs.unita"), conteggio: s.units.length, contenuto: unitaRuoli },
          {
            id: "flusso", titolo: t("processiDelTenant.scheda.tabs.flusso"), nascosta: att.length === 0,
            contenuto: (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("processiDelTenant.scheda.flussoNota")}</p>
                <FlussoCorsie scheda={s} senzaUnita={t("processiDelTenant.scheda.senzaUnita")} onApriAttivita={setAperta} {...(apriUnita ? { onApriUnita: apriUnita } : {})}
                  nomeFile={`flusso_${p.code}`} ariaLabel={t("processiDelTenant.scheda.ariaFlusso", { nome: p.name })} testId="tenant-process-flusso" />
              </div>
            ),
          },
          {
            id: "fasi", titolo: t("processiDelTenant.scheda.tabs.fasi"), nascosta: att.length === 0,
            contenuto: (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("processiDelTenant.scheda.fasiNota")}</p>
                <DiagrammaFasi scheda={s} senzaUnita={t("processiDelTenant.scheda.senzaUnita")} senzaAttivita={t("processiDelTenant.scheda.fasiSenzaAttivita")}
                  ruoloUnita={(id) => { const u = s.units.find((x) => x.unitId === id); return u ? enumLabel("processUnitRole", u.role) : null; }}
                  onApriAttivita={setAperta} {...(apriUnita ? { onApriUnita: apriUnita } : {})}
                  nomeFile={`fasi_${p.code}`} ariaLabel={t("processiDelTenant.scheda.ariaFasi", { nome: p.name })} testId="tenant-process-fasi" />
              </div>
            ),
          },
          {
            id: "grafo", titolo: t("processiDelTenant.scheda.tabs.grafo"),
            contenuto: (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("processiDelTenant.scheda.grafoNota")}</p>
                <GrafoProcesso scheda={s} onApriAttivita={setAperta} onApriProcesso={apriProcesso} {...(apriUnita ? { onApriUnita: apriUnita } : {})}
                  nomeFile={`grafo_${p.code}`} ariaLabel={t("processiDelTenant.scheda.ariaGrafo", { nome: p.name })} testId="tenant-process-grafo" />
              </div>
            ),
          },
          { id: "indicatori", titolo: t("processiDelTenant.scheda.tabs.indicatori"), conteggio: s.kpis.length + s.skills.length, contenuto: indicatori },
          { id: "collegati", titolo: t("processiDelTenant.scheda.tabs.collegati"), conteggio: s.projects.length, contenuto: collegati },
        ]}
      />
      <Dialog open={Boolean(attivitaAperta)} onOpenChange={(o) => { if (!o) setAperta(null); }}>
        {attivitaAperta ? (
          <DialogContent className={MODALE.media} data-testid="tenant-process-attivita-finestra">
            <DialogTitle className="text-lg font-bold leading-tight">{attivitaAperta.ordinal}. {attivitaAperta.name}</DialogTitle>
            <DialogDescription className="text-xs">{t("processiDelTenant.scheda.attivita")} · {nomeProcesso.get(attivitaAperta.processId)}</DialogDescription>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo etichetta={k("input")}>{attivitaAperta.input ?? "—"}</Campo>
              <Campo etichetta={k("output")}>{attivitaAperta.output ?? "—"}</Campo>
              <Campo etichetta={k("unit")}>{unita(attivitaAperta.unitId, attivitaAperta.unitName)}</Campo>
              <Campo etichetta={k("executor")}>
                {attivitaAperta.executorPositionId ? <Riferimento tipo="posizione" id={attivitaAperta.executorPositionId}>{attivitaAperta.executorName ?? ""}</Riferimento> : (attivitaAperta.executorName ?? "—")}
                {attivitaAperta.executorKind ? <span className="block text-xs text-muted-foreground">{enumLabel("processExecutorKind", attivitaAperta.executorKind)}</span> : null}
              </Campo>
              <Campo etichetta={k("nature")}>{enumLabel("processWorkNature", attivitaAperta.workNature)}</Campo>
              <Campo etichetta={k("delivery")}>{enumLabel("processDeliveryModel", attivitaAperta.deliveryModel)}</Campo>
              <Campo etichetta={k("hours")}>{attivitaAperta.typicalHoursPerCycle === null ? "—" : fmt.numero(attivitaAperta.typicalHoursPerCycle, 1)}</Campo>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </main>
  );
}
