"use client";

/**
 * Il fascicolo del cliente si rinomina, si archivia e si collega all'azienda dalla sua scheda, e la
 * ricerca sul web per la versione aperta si avvia e si applica da qui (ondata 4a degli endpoint senza
 * consumatori, 2026-11-18): `PATCH /v1/tenant-blueprints/:id`, `POST …/:id/link-tenant`,
 * `POST …/versions/:n/research` e `POST …/versions/:n/apply-research` esistevano senza un pulsante.
 *
 * Archiviare si disfa (si riattiva). Il collegamento all'azienda si fa una volta: l'API rifiuta il
 * secondo. La ricerca è un lavoro lungo: mostra `LavoroInCorso` dove arriverà l'esito. Applicarla
 * porta le proposte APPROVATE nel modello della versione: la conferma lo dice prima.
 * Comandi solo con `tenant_blueprint:write`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@heuresys/ui";
import type { ApplicaRicercaResponse, CorsaRicerca, DominiRicercabiliResponse, TenantBlueprint, TenantBlueprintDetail, TenantListResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { LavoroInCorso } from "@/components/lavoro-in-corso";

const SELECT_CLASS =
  "rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function usePuoScrivere() {
  return (useCurrentUserPermissions().data?.permissions ?? []).includes("tenant_blueprint:write");
}

/** Nome, stato e azienda del fascicolo. */
export function DatiFascicolo({ fascicolo }: { fascicolo: TenantBlueprintDetail }) {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const puo = usePuoScrivere();
  const [nome, setNome] = useState(fascicolo.name);
  const [azienda, setAzienda] = useState("");
  const aggiorna = () => void qc.invalidateQueries({ queryKey: ["tenant-blueprints"] });
  const salva = useMutation({
    mutationFn: (body: { name?: string; status?: "ACTIVE" | "ARCHIVED" }) =>
      apiFetch<TenantBlueprint>(`/v1/tenant-blueprints/${fascicolo.tenantBlueprintId}`, { method: "PATCH", body }),
    onSuccess: aggiorna,
  });
  const aziende = useQuery({
    queryKey: ["tenants", "per-fascicolo"],
    queryFn: () => apiFetch<TenantListResponse>("/v1/tenants?limit=200"),
    enabled: puo && !fascicolo.tenantId,
  });
  const collega = useMutation({
    mutationFn: () => apiFetch<TenantBlueprint>(`/v1/tenant-blueprints/${fascicolo.tenantBlueprintId}/link-tenant`, {
      method: "POST", body: { tenantId: azienda },
    }),
    onSuccess: aggiorna,
  });
  if (!puo) return null;
  const archiviato = fascicolo.status === "ARCHIVED";
  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="fascicolo-gestione">
      <h2 className="text-base font-semibold text-foreground">{t("gestioneFascicolo.titolo")}</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-foreground">{t("gestioneFascicolo.nome")}
          <Input value={nome} maxLength={255} onChange={(e) => setNome(e.target.value)} data-testid="fascicolo-nome" /></label>
        <Button type="button" size="sm" data-testid="fascicolo-nome-salva" disabled={!nome.trim() || nome.trim() === fascicolo.name || salva.isPending}
          onClick={() => salva.mutate({ name: nome.trim() })}>
          {salva.isPending ? t("common:saving") : t("gestioneFascicolo.salvaNome")}
        </Button>
        <Button type="button" size="sm" variant="outline" data-testid="fascicolo-archivia" disabled={salva.isPending}
          onClick={() => { if (window.confirm(archiviato ? t("gestioneFascicolo.confermaRiattiva") : t("gestioneFascicolo.confermaArchivia"))) salva.mutate({ status: archiviato ? "ACTIVE" : "ARCHIVED" }); }}>
          {archiviato ? t("gestioneFascicolo.riattiva") : t("gestioneFascicolo.archivia")}
        </Button>
      </div>
      {fascicolo.tenantId ? (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="fascicolo-azienda">{t("gestioneFascicolo.aziendaCollegata", { nome: fascicolo.tenantName ?? "" })}</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-3" data-testid="fascicolo-collega">
          <label className="text-sm font-medium text-foreground">{t("gestioneFascicolo.azienda")}
            <select className={`${SELECT_CLASS} block`} value={azienda} onChange={(e) => setAzienda(e.target.value)} data-testid="fascicolo-collega-azienda">
              <option value="">{t("gestioneFascicolo.scegliAzienda")}</option>
              {[...(aziende.data?.items ?? [])].sort((a, b) => a.tenantName.localeCompare(b.tenantName, "it")).map((x) =>
                <option key={x.tenantId} value={x.tenantId}>{x.tenantName}</option>)}
            </select></label>
          <Button type="button" size="sm" data-testid="fascicolo-collega-salva" disabled={!azienda || collega.isPending}
            onClick={() => { if (window.confirm(t("gestioneFascicolo.confermaCollega"))) collega.mutate(); }}>
            {collega.isPending ? t("common:saving") : t("gestioneFascicolo.collega")}
          </Button>
        </div>
      )}
      {(salva.isError || collega.isError) && <p className="mt-2 text-sm text-danger" data-testid="fascicolo-errore">{t("gestioneFascicolo.errore")}</p>}
      {salva.isSuccess && <p className="mt-2 text-sm text-success" role="status">{t("gestioneFascicolo.salvato")}</p>}
    </section>
  );
}

/** La ricerca sul web per la versione aperta, e l'applicazione delle proposte approvate. */
export function RicercaFascicolo({ base, modificabile }: { base: string; modificabile: boolean }) {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const puo = usePuoScrivere();
  const [dominio, setDominio] = useState("");
  const domini = useQuery({
    queryKey: ["tenant-blueprints", "research-domains"],
    queryFn: () => apiFetch<DominiRicercabiliResponse>("/v1/tenant-blueprints/research-domains"),
    enabled: puo && modificabile,
  });
  const avvia = useMutation({
    mutationFn: () => apiFetch<CorsaRicerca>(`${base}/research`, { method: "POST", body: { dominio } }),
  });
  const applica = useMutation({
    mutationFn: () => apiFetch<ApplicaRicercaResponse>(`${base}/apply-research`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tenant-blueprints"] }),
  });
  if (!puo || !modificabile) return null;
  const corsa = avvia.data;
  const esito = applica.data;
  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="fascicolo-ricerca">
      <h2 className="text-base font-semibold text-foreground">{t("gestioneFascicolo.ricercaTitolo")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("gestioneFascicolo.ricercaSpiega")}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-foreground">{t("gestioneFascicolo.dominio")}
          <select className={`${SELECT_CLASS} block`} value={dominio} onChange={(e) => setDominio(e.target.value)} data-testid="fascicolo-ricerca-dominio">
            <option value="">{t("gestioneFascicolo.scegliDominio")}</option>
            {(domini.data?.items ?? []).map((d) => <option key={d.chiave} value={d.chiave}>{d.etichetta}</option>)}
          </select></label>
        <Button type="button" size="sm" data-testid="fascicolo-ricerca-avvia" disabled={!dominio || avvia.isPending}
          onClick={() => { if (window.confirm(t("gestioneFascicolo.confermaRicerca"))) avvia.mutate(); }}>
          {avvia.isPending ? t("gestioneFascicolo.ricercaInCorso") : t("gestioneFascicolo.avviaRicerca")}
        </Button>
        <Button type="button" size="sm" variant="outline" data-testid="fascicolo-ricerca-applica" disabled={applica.isPending}
          onClick={() => { if (window.confirm(t("gestioneFascicolo.confermaApplica"))) applica.mutate(); }}>
          {applica.isPending ? t("gestioneFascicolo.applicazioneInCorso") : t("gestioneFascicolo.applica")}
        </Button>
      </div>
      <LavoroInCorso attivo={avvia.isPending} titolo={t("gestioneFascicolo.ricercaInCorso")} dettaglio={t("gestioneFascicolo.ricercaDettaglio")} />
      <LavoroInCorso attivo={applica.isPending} titolo={t("gestioneFascicolo.applicazioneInCorso")} dettaglio={t("gestioneFascicolo.applicazioneDettaglio")} />
      {corsa && (
        <p className="mt-3 text-sm text-foreground" role="status" data-testid="fascicolo-ricerca-esito">
          {t("gestioneFascicolo.ricercaEsito", { lette: corsa.pagineLette, proposte: corsa.proposteTotali, passate: corsa.propostePassate, respinte: corsa.proposteRespinte })}
        </p>
      )}
      {esito && (
        <p className="mt-3 text-sm text-foreground" role="status" data-testid="fascicolo-applica-esito">
          {t("gestioneFascicolo.applicaEsito", { proposte: esito.proposteApplicate, fonti: esito.fontiRegistrate, avvisi: esito.avvisi.length })}
        </p>
      )}
      {(avvia.isError || applica.isError) && <p className="mt-2 text-sm text-danger" data-testid="fascicolo-ricerca-errore">{t("gestioneFascicolo.errore")}</p>}
    </section>
  );
}
