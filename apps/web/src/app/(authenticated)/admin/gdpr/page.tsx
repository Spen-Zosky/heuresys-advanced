"use client";

/**
 * /admin/gdpr — i diritti sui dati personali dalla parte di chi li amministra (ondata 3 degli
 * endpoint senza consumatori, 2026-11-17). Il modulo `/v1/gdpr/*` aveva mappa dei dati, registro
 * delle richieste, esportazione e cancellazione di una persona e la corsa di conservazione, e
 * nessuna pagina. Si entra dalla scheda «Dati personali» accanto al Registro di provenienza.
 *
 * ⚠ Cancellazione e conservazione NON si disfano. Per questo la pagina fa sempre prima la PROVA
 * (`dryRun: true`, che conta le righe senza toccarle) e solo dopo, con la conferma scritta del nome
 * dell'operazione, quella vera. Ogni corsa resta nel registro delle richieste.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { GdprDataMapResponse, GdprErasureReport, GdprRequest, GdprRetentionReport, User } from "@heuresys/shared";

interface GdprRequestListResponse { items: GdprRequest[]; total: number }
import { PageHeader } from "@/components/intestazione-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";
import { PersonPicker } from "@/components/person-picker";
import { LavoroInCorso } from "@/components/lavoro-in-corso";
import { raggruppaMappa } from "@/lib/gdpr-mappa";

function righeTotali(tabelle: Record<string, { affectedRows: number }>): number {
  return Object.values(tabelle).reduce((s, x) => s + x.affectedRows, 0);
}

function Persona() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const [persone, setPersone] = useState<User[]>([]);
  const [prova, setProva] = useState<GdprErasureReport | null>(null);
  const [conferma, setConferma] = useState("");
  const id = persone[0]?.userId;
  const esporta = useMutation({
    mutationFn: () => apiFetch<unknown>(`/v1/gdpr/users/${id}/export`, { method: "POST", body: {} }),
    onSuccess: (dati) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `dati-personali-${id}.json`; a.click(); URL.revokeObjectURL(url);
      void qc.invalidateQueries({ queryKey: ["gdpr", "requests"] });
    },
  });
  const cancella = useMutation({
    mutationFn: (dryRun: boolean) => apiFetch<GdprErasureReport>(`/v1/gdpr/users/${id}/erasure`, { method: "POST", body: { dryRun } }),
    onSuccess: (r) => { setProva(r); setConferma(""); void qc.invalidateQueries({ queryKey: ["gdpr", "requests"] }); },
  });
  const parola = t("gdpr.parolaCancella");
  return (
    <Card data-testid="gdpr-subject">
      <CardHeader><CardTitle as="h2">{t("gdpr.persona")}</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <PersonPicker label={t("gdpr.scegliPersona")} value={persone} onChange={(x) => { setPersone(x.slice(-1)); setProva(null); }} testId="gdpr-subject-person" />
        {id && (
          <div className="flex flex-wrap gap-3">
            {perms.includes("gdpr:export") && (
              <Button type="button" variant="outline" data-testid="gdpr-export" disabled={esporta.isPending} onClick={() => esporta.mutate()}>
                {esporta.isPending ? t("gdpr.esportando") : t("gdpr.esporta")}
              </Button>
            )}
            {perms.includes("gdpr:erase") && (
              <Button type="button" variant="outline" data-testid="gdpr-erasure-dry" disabled={cancella.isPending} onClick={() => cancella.mutate(true)}>
                {t("gdpr.provaCancellazione")}
              </Button>
            )}
          </div>
        )}
        <LavoroInCorso attivo={esporta.isPending || cancella.isPending} titolo={t("gdpr.lavoro")} dettaglio={cancella.isPending ? t("gdpr.lavoroCancella") : t("gdpr.lavoroEsporta")} />
        {(esporta.isError || cancella.isError) && <p className="text-danger">{t("gdpr.errore")}</p>}
        {prova && (
          <div data-testid="gdpr-erasure-report" className="space-y-2 rounded-card border border-border p-3">
            <p className="font-medium">{prova.dryRun ? t("gdpr.esitoProva", { count: righeTotali(prova.tables) }) : t("gdpr.esitoVero", { count: righeTotali(prova.tables) })}</p>
            <ul className="text-xs text-muted-foreground">
              {Object.entries(prova.tables).filter(([, v]) => v.affectedRows > 0).map(([tab, v]) => (
                <li key={tab}>{tab}: {v.affectedRows} · {t(`gdpr.strategie.${v.strategy}`)}</li>
              ))}
            </ul>
            {prova.dryRun && (
              <div className="flex flex-wrap items-end gap-3 border-t border-border pt-2">
                <label className="text-sm font-medium text-foreground">{t("gdpr.confermaScrivi", { parola })}
                  <Input value={conferma} onChange={(e) => setConferma(e.target.value)} data-testid="gdpr-erasure-confirm" /></label>
                <Button type="button" data-testid="gdpr-erasure-run" disabled={conferma.trim() !== parola || cancella.isPending} onClick={() => cancella.mutate(false)}>
                  {t("gdpr.cancellaDavvero")}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Conservazione() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const [prova, setProva] = useState<GdprRetentionReport | null>(null);
  const [conferma, setConferma] = useState("");
  const corsa = useMutation({
    mutationFn: (dryRun: boolean) => apiFetch<GdprRetentionReport>("/v1/gdpr/retention/run", { method: "POST", body: { dryRun } }),
    onSuccess: (r) => { setProva(r); setConferma(""); void qc.invalidateQueries({ queryKey: ["gdpr", "requests"] }); },
  });
  const parola = t("gdpr.parolaConserva");
  return (
    <Card data-testid="gdpr-retention">
      <CardHeader><CardTitle as="h2">{t("gdpr.conservazione")}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">{t("gdpr.conservazioneSpiega")}</p>
        <Button type="button" variant="outline" data-testid="gdpr-retention-dry" disabled={corsa.isPending} onClick={() => corsa.mutate(true)}>{t("gdpr.provaConservazione")}</Button>
        <LavoroInCorso attivo={corsa.isPending} titolo={t("gdpr.lavoro")} dettaglio={t("gdpr.lavoroConserva")} />
        {corsa.isError && <p className="text-danger">{t("gdpr.errore")}</p>}
        {prova && (
          <div data-testid="gdpr-retention-report" className="space-y-2 rounded-card border border-border p-3">
            <p className="font-medium">{prova.dryRun ? t("gdpr.esitoProvaConserva", { count: righeTotali(prova.tables) }) : t("gdpr.esitoVeroConserva", { count: righeTotali(prova.tables) })}</p>
            <ul className="text-xs text-muted-foreground">
              {Object.entries(prova.tables).filter(([, v]) => v.affectedRows > 0).map(([tab, v]) => (
                <li key={tab}>{tab}: {v.affectedRows} · {t("gdpr.giorni", { count: v.retentionDays })}</li>
              ))}
            </ul>
            {prova.dryRun && righeTotali(prova.tables) > 0 && (
              <div className="flex flex-wrap items-end gap-3 border-t border-border pt-2">
                <label className="text-sm font-medium text-foreground">{t("gdpr.confermaScrivi", { parola })}
                  <Input value={conferma} onChange={(e) => setConferma(e.target.value)} data-testid="gdpr-retention-confirm" /></label>
                <Button type="button" data-testid="gdpr-retention-run" disabled={conferma.trim() !== parola || corsa.isPending} onClick={() => corsa.mutate(false)}>
                  {t("gdpr.applicaDavvero")}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GdprAdminPage() {
  const { t, i18n } = useTranslation("admin");
  const fmt = useFormat();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  // I titoli delle tabelle arrivano dall'API nella lingua della pagina (giro forense K34).
  const lingua = i18n.language?.startsWith("en") ? "en" : "it";
  const mappa = useQuery({ queryKey: ["gdpr", "data-map", lingua], queryFn: () => apiFetch<GdprDataMapResponse>(`/v1/gdpr/data-map?lingua=${lingua}`), enabled: perms.includes("gdpr:read") });
  const [nomiTecnici, setNomiTecnici] = useState(false);
  const gruppi = raggruppaMappa(mappa.data?.items ?? [], t, (k) => i18n.exists(k, { ns: "admin" }), lingua);
  const richieste = useQuery({ queryKey: ["gdpr", "requests"], queryFn: () => apiFetch<GdprRequestListResponse>("/v1/gdpr/requests?limit=50"), enabled: perms.includes("gdpr:read") });
  return (
    <div data-testid="gdpr-admin-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader title={t("gdpr.titolo")} description={t("gdpr.descrizione")} />
      {(perms.includes("gdpr:export") || perms.includes("gdpr:erase")) && <Persona />}
      {perms.includes("gdpr:retention") && <Conservazione />}
      <Card data-testid="gdpr-requests">
        <CardHeader><CardTitle as="h2">{t("gdpr.registro", { mostrati: richieste.data?.items.length ?? 0, totale: richieste.data?.total ?? 0 })}</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border rounded-card border border-border text-sm">
            {(richieste.data?.items ?? []).map((r) => (
              <li key={r.gdprRequestId} data-testid="gdpr-request-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                <span>{t(`gdpr.tipi.${r.type}`)} <span className="text-xs text-muted-foreground">· {fmt.dataOra(r.createdAt)}</span></span>
                <Badge variant={r.status === "COMPLETED" ? "success" : "secondary"}>{t(`gdpr.statiRichiesta.${r.status}`)}</Badge>
              </li>
            ))}
            {(richieste.data?.items ?? []).length === 0 && <li className="px-4 py-2 text-muted-foreground">{richieste.isLoading ? t("common:loading") : t("gdpr.nessunaRichiesta")}</li>}
          </ul>
        </CardContent>
      </Card>
      <Card data-testid="gdpr-data-map">
        <CardHeader><CardTitle as="h2">{t("gdpr.mappa", { count: mappa.data?.items.length ?? 0 })}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Giro forense K34: per classe di dato e con il titolo della tabella. Il nome fisico
              serve a chi verifica il registro, e si mostra a richiesta, non come prima cosa. */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">{t("gdpr.mappaSpiega")}</p>
            <Button variant="outline" size="sm" data-testid="gdpr-map-technical" aria-pressed={nomiTecnici} onClick={() => setNomiTecnici((x) => !x)}>
              {nomiTecnici ? t("gdpr.nascondiNomiTecnici") : t("gdpr.mostraNomiTecnici")}
            </Button>
          </div>
          {gruppi.map((g) => (
            <section key={g.classe} data-testid="gdpr-map-group" data-classe={g.classe} className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t(`gdpr.classi.${g.classe}`)} <span className="font-normal text-muted-foreground">· {fmt.numero(g.voci.length)}</span></h3>
              <ul className="divide-y divide-border rounded-card border border-border text-sm">
                {g.voci.map((m) => (
                  <li key={`${m.tableSchema}.${m.tableName}.${m.subjectFkColumn}`} data-testid="gdpr-map-row" className="flex flex-wrap justify-between gap-3 px-4 py-2">
                    <span className="min-w-0 break-words">
                      <span className="text-foreground">{m.titolo}</span>
                      <span className="text-muted-foreground"> · {t(`gdpr.riferimento.${m.referenceKind}`)}</span>
                      {m.ripetuta > 1 ? <span className="block text-xs text-muted-foreground">{t("gdpr.piuColonne", { count: m.ripetuta })}</span> : null}
                      {nomiTecnici ? <span className="block break-all font-mono text-xs text-muted-foreground" data-testid="gdpr-map-physical">{m.tableSchema}.{m.tableName} · {m.subjectFkColumn}</span> : null}
                    </span>
                    <span>{t(`gdpr.strategie.${m.erasureStrategy}`)}{m.retentionDays ? ` · ${t("gdpr.giorni", { count: m.retentionDays })}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
