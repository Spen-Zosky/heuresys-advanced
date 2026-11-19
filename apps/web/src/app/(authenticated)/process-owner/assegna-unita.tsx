"use client";

/**
 * Chi risponde di un processo: assegnare un'unità con il suo ruolo RACI e toglierla
 * (`POST/DELETE /v1/organization-unit-processes`, ondata 3 degli endpoint senza consumatori,
 * 2026-11-17). Le unità vengono dall'elenco vivo, letto per intero a pagine da 200 (R5: niente
 * elenco troncato in silenzio). I comandi compaiono solo con `organization_unit_processes:*`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const RUOLI = ["OWNER", "CONTRIBUTOR", "CONSULTED", "INFORMED"] as const;

interface Unita { organizationUnitId: string; name: string }

async function tutteLeUnita(): Promise<Unita[]> {
  const out: Unita[] = [];
  for (let offset = 0; ; offset += 200) {
    const p = await apiFetch<{ items: Unita[]; total: number }>(`/v1/organization-units?limit=200&offset=${offset}`);
    out.push(...p.items);
    if (p.items.length === 0 || out.length >= p.total) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export function usePermessiRaci() {
  const p = useCurrentUserPermissions().data?.permissions ?? [];
  return { crea: p.includes("organization_unit_processes:create"), togli: p.includes("organization_unit_processes:delete") };
}

export function AssegnaUnitaAlProcesso({ processId, giaAssegnate }: { processId: string; giaAssegnate: string[] }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [unita, setUnita] = useState("");
  const [ruolo, setRuolo] = useState<(typeof RUOLI)[number]>("CONTRIBUTOR");
  const elenco = useQuery({ queryKey: ["organization-units", "tutte"], queryFn: tutteLeUnita, staleTime: 60_000 });
  const visibili = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return (elenco.data ?? []).filter((u) => !giaAssegnate.includes(u.organizationUnitId) && (!f || u.name.toLowerCase().includes(f)));
  }, [elenco.data, filtro, giaAssegnate]);
  const assegna = useMutation({
    mutationFn: () => apiFetch("/v1/organization-unit-processes", { method: "POST", body: { ouId: unita, processId, role: ruolo } }),
    onSuccess: () => { setUnita(""); void qc.invalidateQueries({ queryKey: ["org-unit-processes", "by-process", processId] }); },
  });
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-card p-4" data-testid="raci-assign">
      <label className="w-56 text-sm font-medium text-foreground">{t("processOwner.raci.assegna.filtro")}
        <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} data-testid="raci-assign-filter" /></label>
      <label className="w-72 text-sm font-medium text-foreground">{t("processOwner.raci.assegna.unita")}
        <select className={SELECT_CLASS} value={unita} onChange={(e) => setUnita(e.target.value)} data-testid="raci-assign-unit">
          <option value="">{elenco.isLoading ? t("common:loading") : t("processOwner.raci.assegna.scegli", { count: visibili.length })}</option>
          {visibili.map((u) => <option key={u.organizationUnitId} value={u.organizationUnitId}>{u.name}</option>)}
        </select></label>
      <label className="w-48 text-sm font-medium text-foreground">{t("processOwner.raci.cols.role")}
        <select className={SELECT_CLASS} value={ruolo} onChange={(e) => setRuolo(e.target.value as (typeof RUOLI)[number])} data-testid="raci-assign-role">
          {RUOLI.map((r) => <option key={r} value={r}>{t(`processOwner.raci.roles.${r}`)}</option>)}
        </select></label>
      <Button type="button" data-testid="raci-assign-submit" disabled={!unita || assegna.isPending} onClick={() => assegna.mutate()}>
        {assegna.isPending ? t("common:saving") : t("processOwner.raci.assegna.invia")}
      </Button>
      {assegna.isError && (
        <span className="text-sm text-danger">
          {isApiError(assegna.error) && assegna.error.status === 409 ? t("processOwner.raci.assegna.giaPresente") : t("processOwner.raci.assegna.errore")}
        </span>
      )}
    </div>
  );
}

export function TogliUnitaDalProcesso({ id, processId }: { id: string; processId: string }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const togli = useMutation({
    mutationFn: () => apiFetch(`/v1/organization-unit-processes/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["org-unit-processes", "by-process", processId] }),
  });
  return (
    <Button type="button" size="sm" variant="outline" data-testid="raci-remove" disabled={togli.isPending}
      onClick={() => { if (window.confirm(t("processOwner.raci.assegna.confermaTogli"))) togli.mutate(); }}>
      {t("processOwner.raci.assegna.togli")}
    </Button>
  );
}
