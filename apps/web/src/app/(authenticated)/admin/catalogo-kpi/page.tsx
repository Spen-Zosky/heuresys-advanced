"use client";

/**
 * /admin/catalogo-kpi — quali KPI misurano un processo del modello e quali un'unità organizzativa,
 * con il loro peso (ondata 5a degli endpoint senza consumatori, 2026-11-18). `PUT` e `DELETE` di
 * `/v1/process-kpi-templates` e `/v1/organization-unit-kpi-templates` esistevano senza schermata.
 * Si entra dalla scheda «Modelli dei KPI» accanto al catalogo dei KPI.
 *
 * Un abbinamento è una riga di configurazione, non una storia: toglierlo lo rimuove, e lo si rimette
 * con lo stesso gesto. Gli elenchi di nomi si leggono interi, pagina dopo pagina (mai tronchi).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { BlueprintProcess, KpiDefinition, OrganizationUnit, OrganizationUnitKpiTemplate, ProcessKpiTemplate } from "@heuresys/shared";
import { PageHeader } from "@/components/intestazione-pagina";
import { StatoCaricamento, StatoErrore } from "@/components/stato-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Legge un elenco intero, a pagine, finché il totale dichiarato dall'API non è raggiunto. */
async function leggiTutto<T>(percorso: string, limite: number): Promise<T[]> {
  const out: T[] = [];
  const sep = percorso.includes("?") ? "&" : "?";
  for (let offset = 0; ; offset += limite) {
    const r = await apiFetch<{ items: T[]; total: number }>(`${percorso}${sep}limit=${limite}&offset=${offset}`);
    out.push(...r.items);
    if (r.items.length === 0 || out.length >= r.total) return out;
  }
}

function useNomi() {
  const kpi = useQuery({ queryKey: ["kpi-definitions", "tutti"], queryFn: () => leggiTutto<KpiDefinition>("/v1/kpi-definitions", 200) });
  const processi = useQuery({ queryKey: ["blueprint-processes", "tutti"], queryFn: () => leggiTutto<BlueprintProcess>("/v1/blueprint-processes", 500) });
  const unita = useQuery({ queryKey: ["organization-units", "tutte"], queryFn: () => leggiTutto<OrganizationUnit>("/v1/organization-units", 200) });
  return {
    kpi: [...(kpi.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "it")),
    processi: [...(processi.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "it")),
    unita: [...(unita.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "it")),
  };
}

function PerProcesso() {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const nomi = useNomi();
  const [scelta, setScelta] = useState({ processId: "", kpiId: "", peso: "1" });
  const righe = useQuery({ queryKey: ["process-kpi-templates"], queryFn: () => leggiTutto<ProcessKpiTemplate>("/v1/process-kpi-templates", 500) });
  const aggiorna = () => void qc.invalidateQueries({ queryKey: ["process-kpi-templates"] });
  const salva = useMutation({
    mutationFn: () => apiFetch("/v1/process-kpi-templates", { method: "PUT", body: { processId: scelta.processId, kpiId: scelta.kpiId, defaultWeight: Number(scelta.peso) } }),
    onSuccess: () => { setScelta({ processId: "", kpiId: "", peso: "1" }); aggiorna(); },
  });
  const togli = useMutation({
    mutationFn: (id: string) => apiFetch(`/v1/process-kpi-templates/${id}`, { method: "DELETE" }),
    onSuccess: aggiorna,
  });
  const nomeKpi = new Map(nomi.kpi.map((k) => [k.kpiDefinitionId, k.name]));
  const nomeProcesso = new Map(nomi.processi.map((p) => [p.blueprintProcessId, p.name]));
  const pesoOk = Number(scelta.peso) >= 0 && Number(scelta.peso) <= 1 && scelta.peso.trim() !== "";
  const elenco = [...(righe.data ?? [])].sort((a, b) =>
    (nomeProcesso.get(a.processId) ?? "").localeCompare(nomeProcesso.get(b.processId) ?? "", "it")
    || (nomeKpi.get(a.kpiId) ?? "").localeCompare(nomeKpi.get(b.kpiId) ?? "", "it"));
  return (
    <Card data-testid="kpi-templates-process">
      <CardHeader><CardTitle as="h2">{t("catalogoKpi.processi.titolo")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {righe.isLoading && <StatoCaricamento />}
        {righe.isError && <StatoErrore errore={righe.error} titolo={t("catalogoKpi.errore")} onRiprova={() => void righe.refetch()} />}
        <p className="text-sm text-muted-foreground" data-testid="kpi-templates-process-count">{t("catalogoKpi.conto", { count: elenco.length })}</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground">
            <th className="py-1">{t("catalogoKpi.processi.processo")}</th><th>{t("catalogoKpi.kpi")}</th><th>{t("catalogoKpi.peso")}</th><th />
          </tr></thead>
          <tbody>
            {elenco.map((r) => (
              <tr key={r.processKpiTemplateId} className="border-t border-border" data-testid="kpi-template-process-row" data-id={r.processKpiTemplateId}>
                <td className="py-1">{nomeProcesso.get(r.processId) ?? "—"}</td>
                <td>{nomeKpi.get(r.kpiId) ?? "—"}</td>
                <td>{fmt.numeroFisso(r.defaultWeight, 2)}</td>
                <td className="text-right">
                  {perms.includes("process_kpi_template:delete") && (
                    <Button type="button" size="sm" variant="ghost" data-testid="kpi-template-process-remove" disabled={togli.isPending}
                      onClick={() => { if (window.confirm(t("catalogoKpi.confermaTogli"))) togli.mutate(r.processKpiTemplateId); }}>
                      {t("catalogoKpi.togli")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {perms.includes("process_kpi_template:update") && (
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
            <label className="text-sm font-medium text-foreground">{t("catalogoKpi.processi.processo")}
              <select className={SELECT_CLASS} value={scelta.processId} onChange={(e) => setScelta({ ...scelta, processId: e.target.value })} data-testid="kpi-template-process-process">
                <option value="">{t("catalogoKpi.scegli")}</option>
                {nomi.processi.map((p) => <option key={p.blueprintProcessId} value={p.blueprintProcessId}>{p.name}</option>)}
              </select></label>
            <label className="text-sm font-medium text-foreground">{t("catalogoKpi.kpi")}
              <select className={SELECT_CLASS} value={scelta.kpiId} onChange={(e) => setScelta({ ...scelta, kpiId: e.target.value })} data-testid="kpi-template-process-kpi">
                <option value="">{t("catalogoKpi.scegli")}</option>
                {nomi.kpi.map((k) => <option key={k.kpiDefinitionId} value={k.kpiDefinitionId}>{k.name}</option>)}
              </select></label>
            <label className="text-sm font-medium text-foreground">{t("catalogoKpi.pesoDa0a1")}
              <Input value={scelta.peso} inputMode="decimal" onChange={(e) => setScelta({ ...scelta, peso: e.target.value })} data-testid="kpi-template-process-weight" /></label>
            <Button type="button" data-testid="kpi-template-process-save" disabled={!scelta.processId || !scelta.kpiId || !pesoOk || salva.isPending} onClick={() => salva.mutate()}>
              {salva.isPending ? t("common:saving") : t("catalogoKpi.registra")}
            </Button>
          </div>
        )}
        {(salva.isError || togli.isError) && <p className="text-sm text-danger" data-testid="kpi-template-process-error">{t("catalogoKpi.erroreScrittura")}</p>}
      </CardContent>
    </Card>
  );
}

function PerUnita() {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const nomi = useNomi();
  const [scelta, setScelta] = useState({ unitId: "", kpiId: "", peso: "1" });
  const righe = useQuery({ queryKey: ["organization-unit-kpi-templates"], queryFn: () => leggiTutto<OrganizationUnitKpiTemplate>("/v1/organization-unit-kpi-templates", 500) });
  const aggiorna = () => void qc.invalidateQueries({ queryKey: ["organization-unit-kpi-templates"] });
  const salva = useMutation({
    mutationFn: () => apiFetch("/v1/organization-unit-kpi-templates", { method: "PUT", body: { unitId: scelta.unitId, kpiId: scelta.kpiId, weight: Number(scelta.peso) } }),
    onSuccess: () => { setScelta({ unitId: "", kpiId: "", peso: "1" }); aggiorna(); },
  });
  const togli = useMutation({
    mutationFn: (id: string) => apiFetch(`/v1/organization-unit-kpi-templates/${id}`, { method: "DELETE" }),
    onSuccess: aggiorna,
  });
  const nomeKpi = new Map(nomi.kpi.map((k) => [k.kpiDefinitionId, k.name]));
  const nomeUnita = new Map(nomi.unita.map((u) => [u.organizationUnitId, u.name]));
  const pesoOk = Number(scelta.peso) >= 0 && Number(scelta.peso) <= 1 && scelta.peso.trim() !== "";
  const elenco = [...(righe.data ?? [])].sort((a, b) =>
    (nomeUnita.get(a.unitId ?? "") ?? "").localeCompare(nomeUnita.get(b.unitId ?? "") ?? "", "it")
    || (nomeKpi.get(a.kpiId) ?? "").localeCompare(nomeKpi.get(b.kpiId) ?? "", "it"));
  return (
    <Card data-testid="kpi-templates-unit">
      <CardHeader><CardTitle as="h2">{t("catalogoKpi.unita.titolo")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {righe.isLoading && <StatoCaricamento />}
        {righe.isError && <StatoErrore errore={righe.error} titolo={t("catalogoKpi.errore")} onRiprova={() => void righe.refetch()} />}
        <p className="text-sm text-muted-foreground" data-testid="kpi-templates-unit-count">{t("catalogoKpi.conto", { count: elenco.length })}</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground">
            <th className="py-1">{t("catalogoKpi.unita.unita")}</th><th>{t("catalogoKpi.kpi")}</th><th>{t("catalogoKpi.peso")}</th><th />
          </tr></thead>
          <tbody>
            {elenco.map((r) => (
              <tr key={r.organizationUnitKpiTemplateId} className="border-t border-border" data-testid="kpi-template-unit-row" data-id={r.organizationUnitKpiTemplateId}>
                <td className="py-1">{r.unitId ? (nomeUnita.get(r.unitId) ?? "—") : t("catalogoKpi.unita.daModello")}</td>
                <td>{nomeKpi.get(r.kpiId) ?? "—"}</td>
                <td>{fmt.numeroFisso(r.weight, 2)}</td>
                <td className="text-right">
                  {perms.includes("organization_unit_kpi_template:delete") && (
                    <Button type="button" size="sm" variant="ghost" data-testid="kpi-template-unit-remove" disabled={togli.isPending}
                      onClick={() => { if (window.confirm(t("catalogoKpi.confermaTogli"))) togli.mutate(r.organizationUnitKpiTemplateId); }}>
                      {t("catalogoKpi.togli")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {perms.includes("organization_unit_kpi_template:update") && (
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
            <label className="text-sm font-medium text-foreground">{t("catalogoKpi.unita.unita")}
              <select className={SELECT_CLASS} value={scelta.unitId} onChange={(e) => setScelta({ ...scelta, unitId: e.target.value })} data-testid="kpi-template-unit-unit">
                <option value="">{t("catalogoKpi.scegli")}</option>
                {nomi.unita.map((u) => <option key={u.organizationUnitId} value={u.organizationUnitId}>{u.name}</option>)}
              </select></label>
            <label className="text-sm font-medium text-foreground">{t("catalogoKpi.kpi")}
              <select className={SELECT_CLASS} value={scelta.kpiId} onChange={(e) => setScelta({ ...scelta, kpiId: e.target.value })} data-testid="kpi-template-unit-kpi">
                <option value="">{t("catalogoKpi.scegli")}</option>
                {nomi.kpi.map((k) => <option key={k.kpiDefinitionId} value={k.kpiDefinitionId}>{k.name}</option>)}
              </select></label>
            <label className="text-sm font-medium text-foreground">{t("catalogoKpi.pesoDa0a1")}
              <Input value={scelta.peso} inputMode="decimal" onChange={(e) => setScelta({ ...scelta, peso: e.target.value })} data-testid="kpi-template-unit-weight" /></label>
            <Button type="button" data-testid="kpi-template-unit-save" disabled={!scelta.unitId || !scelta.kpiId || !pesoOk || salva.isPending} onClick={() => salva.mutate()}>
              {salva.isPending ? t("common:saving") : t("catalogoKpi.registra")}
            </Button>
          </div>
        )}
        {(salva.isError || togli.isError) && <p className="text-sm text-danger" data-testid="kpi-template-unit-error">{t("catalogoKpi.erroreScrittura")}</p>}
      </CardContent>
    </Card>
  );
}

export default function CatalogoKpiPage() {
  const { t } = useTranslation("admin");
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  return (
    <main data-testid="kpi-templates-page" className="mx-auto max-w-6xl space-y-6 px-6 pb-8">
      <PageHeader title={t("catalogoKpi.titolo")} description={t("catalogoKpi.descrizione")} />
      {perms.includes("process_kpi_template:read") && <PerProcesso />}
      {perms.includes("organization_unit_kpi_template:read") && <PerUnita />}
    </main>
  );
}
