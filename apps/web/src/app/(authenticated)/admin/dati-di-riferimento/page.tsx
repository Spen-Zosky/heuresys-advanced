"use client";

/**
 * /admin/dati-di-riferimento — l'aggiornamento delle tassonomie ufficiali dalle loro fonti
 * pubblicate (ESCO, ATECO 2025, gerarchia delle competenze ESCO), ondata 5a degli endpoint senza
 * consumatori (2026-11-19). `POST /v1/reference-sync/runs` esisteva senza schermata: si poteva
 * lanciare solo dal timer settimanale o a mano.
 *
 * Un aggiornamento inserisce e aggiorna, non cancella mai; se la fonte non è cambiata dall'ultima
 * volta il giro si ferma subito («invariata»). La corsa è sincrona e può durare minuti: il riquadro
 * di lavoro in corso resta finché l'API risponde.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { ReferenceSyncRunListResponse, ReferenceSyncSourceKey, ReferenceSyncSourceListResponse, ReferenceSyncTriggerResponse } from "@heuresys/shared";
import { PageHeader } from "@/components/intestazione-pagina";
import { LavoroInCorso } from "@/components/lavoro-in-corso";
import { StatoCaricamento, StatoErrore, StatoNegato, StatoVuoto } from "@/components/stato-pagina";
import { StatusPill } from "@/components/status-pill";
import { apiFetch } from "@/lib/api/fetch";
import { testoPerLaPersona } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";
import { useFormat } from "@/lib/format";

export default function DatiDiRiferimentoPage() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const fmt = useFormat();
  const qc = useQueryClient();
  const permessi = useCurrentUserPermissions();
  const perms = permessi.data?.permissions ?? [];
  const puoLeggere = perms.includes("reference_sync:read");
  const puoLanciare = perms.includes("reference_sync:trigger");
  const fonti = useQuery({ queryKey: ["reference-sync", "sources"], queryFn: () => apiFetch<ReferenceSyncSourceListResponse>("/v1/reference-sync/sources"), enabled: puoLeggere });
  const corse = useQuery({ queryKey: ["reference-sync", "runs"], queryFn: () => apiFetch<ReferenceSyncRunListResponse>("/v1/reference-sync/runs"), enabled: puoLeggere });
  const [esito, setEsito] = useState<ReferenceSyncTriggerResponse | null>(null);
  const lancia = useMutation({
    mutationFn: (source: ReferenceSyncSourceKey) => apiFetch<ReferenceSyncTriggerResponse>("/v1/reference-sync/runs", { method: "POST", body: { source } }),
    onMutate: () => setEsito(null),
    onSuccess: (r) => { setEsito(r); void qc.invalidateQueries({ queryKey: ["reference-sync"] }); },
  });
  // L'API manda l'etichetta tecnica in inglese: il nome per la persona è nel dizionario, per chiave di fonte (l'etichetta resta per le fonti nuove).
  const etichettaFonte = (chiave: string, tecnica: string): string => t(`datiRiferimento.nomiFonti.${chiave}`, { defaultValue: tecnica });
  const nomeFonte = new Map((fonti.data?.items ?? []).map((f) => [f.key as string, etichettaFonte(f.key, f.label)]));
  const tono = (s: string) => (s === "COMPLETED" ? "success" : s === "FAILED" ? "danger" : s === "RUNNING" ? "info" : "neutral") as "success" | "danger" | "info" | "neutral";

  // Il lavoro sulle fonti ufficiali è del custode dei dati e della piattaforma (reference_sync:read):
  // a chi non ha quel mandato la pagina lo dice, senza chiamate che tornerebbero 403.
  if (permessi.isLoading) return <main className="mx-auto max-w-6xl px-6 pb-8"><StatoCaricamento /></main>;
  if (!puoLeggere) {
    return (
      <main data-testid="dati-riferimento-page" className="mx-auto max-w-6xl space-y-6 px-6 pb-8">
        <PageHeader title={t("datiRiferimento.titolo")} description={t("datiRiferimento.descrizione")} />
        <StatoNegato motivo={t("datiRiferimento.negato")} />
      </main>
    );
  }
  return (
    <main data-testid="dati-riferimento-page" className="mx-auto max-w-6xl space-y-6 px-6 pb-8">
      <PageHeader title={t("datiRiferimento.titolo")} description={t("datiRiferimento.descrizione")} />

      <Card data-testid="dati-riferimento-fonti">
        <CardHeader><CardTitle as="h2">{t("datiRiferimento.fonti")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {fonti.isLoading && <StatoCaricamento />}
          {fonti.isError && <StatoErrore errore={fonti.error} titolo={t("datiRiferimento.errore")} onRiprova={() => void fonti.refetch()} />}
          {fonti.data && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground">
                <th className="py-1">{t("datiRiferimento.fonte")}</th><th>{t("datiRiferimento.ultimoSuccesso")}</th><th>{t("datiRiferimento.ultimaCorsa")}</th><th><span className="sr-only">{t("common:table.actions")}</span></th>
              </tr></thead>
              <tbody>
                {fonti.data.items.map((f) => (
                  <tr key={f.key} className="border-t border-border" data-testid="dati-riferimento-fonte" data-source={f.key}>
                    <td className="py-1">{nomeFonte.get(f.key) ?? f.label}</td>
                    <td>{f.watermark?.lastSucceededAt ? fmt.dataOra(f.watermark.lastSucceededAt) : t("datiRiferimento.mai")}</td>
                    <td>{f.lastRun ? <StatusPill tone={tono(f.lastRun.status)}>{enumLabel("referenceSyncRunStatus", f.lastRun.status)}</StatusPill> : "—"}</td>
                    <td className="text-right">
                      {puoLanciare && (
                        <Button type="button" size="sm" data-testid="dati-riferimento-lancia" disabled={lancia.isPending}
                          onClick={() => { if (window.confirm(t("datiRiferimento.conferma", { fonte: nomeFonte.get(f.key) ?? f.label }))) lancia.mutate(f.key); }}>
                          {lancia.isPending && lancia.variables === f.key ? t("datiRiferimento.inCorso") : t("datiRiferimento.aggiorna")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <LavoroInCorso
            attivo={lancia.isPending}
            titolo={t("datiRiferimento.lavoro", { fonte: nomeFonte.get(lancia.variables ?? "") ?? "" })}
            dettaglio={t("datiRiferimento.lavoroDettaglio")}
          />
          {esito && (
            <p className="text-sm text-success" role="status" data-testid="dati-riferimento-esito">
              {esito.skipped
                ? t("datiRiferimento.invariata", { fonte: nomeFonte.get(esito.source) ?? esito.source })
                : t("datiRiferimento.fatto", { fonte: nomeFonte.get(esito.source) ?? esito.source, totale: fmt.numero(esito.total), inserite: fmt.numero(esito.inserted), aggiornate: fmt.numero(esito.updated) })}
            </p>
          )}
          {lancia.isError && <p className="text-sm text-danger" role="alert" data-testid="dati-riferimento-errore">{testoPerLaPersona(lancia.error) ?? t("datiRiferimento.erroreCorsa")}</p>}
        </CardContent>
      </Card>

      <Card data-testid="dati-riferimento-corse">
        <CardHeader><CardTitle as="h2">{t("datiRiferimento.storico")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {corse.isLoading && <StatoCaricamento />}
          {corse.isError && <StatoErrore errore={corse.error} titolo={t("datiRiferimento.errore")} onRiprova={() => void corse.refetch()} />}
          {corse.data && (
            <>
              <p className="text-sm text-muted-foreground" data-testid="dati-riferimento-corse-count">{t("datiRiferimento.contoCorse", { count: corse.data.total })}</p>
              {corse.data.items.length === 0 ? <StatoVuoto /> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="py-1">{t("datiRiferimento.fonte")}</th><th>{t("datiRiferimento.inizio")}</th><th>{t("datiRiferimento.fine")}</th>
                    <th>{t("datiRiferimento.voci")}</th><th>{t("datiRiferimento.inseriteAggiornate")}</th><th>{t("datiRiferimento.stato")}</th>
                  </tr></thead>
                  <tbody>
                    {corse.data.items.map((r) => (
                      <tr key={r.runId} className="border-t border-border" data-testid="dati-riferimento-corsa">
                        <td className="py-1">{nomeFonte.get(r.source) ?? r.source}</td>
                        <td>{fmt.dataOra(r.startedAt)}</td>
                        <td>{r.finishedAt ? fmt.dataOra(r.finishedAt) : "—"}</td>
                        <td>{fmt.numero(r.total)}</td>
                        <td>{fmt.numero(r.inserted)} / {fmt.numero(r.updated)}</td>
                        <td><StatusPill tone={tono(r.status)}>{enumLabel("referenceSyncRunStatus", r.status)}</StatusPill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
