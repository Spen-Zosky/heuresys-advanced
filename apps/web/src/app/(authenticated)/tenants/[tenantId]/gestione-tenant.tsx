"use client";

/**
 * Il tenant si corregge dalla sua scheda, e la piattaforma vi assegna o ritira chi lo segue
 * (ondata 3 degli endpoint senza consumatori, 2026-11-17): `PATCH /v1/tenants/:id`,
 * `POST /v1/platform-tenant-assignments` e `POST /v1/platform-tenant-assignments/:id/revoke`
 * esistevano e nessuna pagina li chiamava. Ritirare un'assegnazione valorizza `revokedAt`, non
 * cancella la riga. Comandi solo con `tenant:update` e `platform_tenant_assignment:manage`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { IndustryCode, PlatformTenantAssignmentListResponse, Tenant, TenantSizeBand, TenantStatus, User } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";
import { useFormat } from "@/lib/format";
import { PersonPicker } from "@/components/person-picker";
import { cognomeNome } from "@/lib/person-label";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const STATI: readonly TenantStatus[] = ["ACTIVE", "SUSPENDED", "ARCHIVED", "PENDING_ACTIVATION"];
const TAGLIE: readonly TenantSizeBand[] = ["XS", "S", "M", "L", "XL"];

export function ModificaTenant({ tenant, settori }: { tenant: Tenant; settori: IndustryCode[] }) {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const puo = (useCurrentUserPermissions().data?.permissions ?? []).includes("tenant:update");
  const [v, setV] = useState({
    name: tenant.tenantName, legal: tenant.tenantLegalName ?? "", country: tenant.tenantCountryCode ?? "",
    industry: tenant.tenantIndustryCode ?? "", size: tenant.tenantSizeBand ?? "", status: tenant.tenantStatus,
  });
  const salva = useMutation({
    mutationFn: () => apiFetch<Tenant>(`/v1/tenants/${tenant.tenantId}`, {
      method: "PATCH",
      body: {
        tenantName: v.name.trim(), tenantLegalName: v.legal.trim() || null, tenantCountryCode: v.country.trim().toUpperCase() || null,
        ...(v.industry ? { tenantIndustryCode: v.industry } : {}), tenantSizeBand: (v.size || null) as TenantSizeBand | null, tenantStatus: v.status,
      },
    }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tenants"] }),
  });
  if (!puo) return null;
  const cambiaStato = v.status !== tenant.tenantStatus;
  return (
    <Card data-testid="tenant-edit">
      <CardHeader><CardTitle as="h2">{t("tenants.gestione.modifica")}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-sm font-medium text-foreground">{t("tenants.gestione.nome")}
          <Input value={v.name} maxLength={255} onChange={(e) => setV({ ...v, name: e.target.value })} data-testid="tenant-edit-name" /></label>
        <label className="text-sm font-medium text-foreground">{t("tenants.detail.fields.legalName")}
          <Input value={v.legal} maxLength={255} onChange={(e) => setV({ ...v, legal: e.target.value })} data-testid="tenant-edit-legal" /></label>
        <label className="text-sm font-medium text-foreground">{t("tenants.gestione.paese")}
          <Input value={v.country} maxLength={2} onChange={(e) => setV({ ...v, country: e.target.value })} data-testid="tenant-edit-country" /></label>
        <label className="text-sm font-medium text-foreground">{t("tenants.detail.fields.industry")}
          <select className={SELECT_CLASS} value={v.industry} onChange={(e) => setV({ ...v, industry: e.target.value })} data-testid="tenant-edit-industry">
            {settori.map((s) => <option key={s.industryCode} value={s.industryCode}>{s.industryName}</option>)}
          </select></label>
        <label className="text-sm font-medium text-foreground">{t("tenants.detail.fields.sizeBand")}
          <select className={SELECT_CLASS} value={v.size} onChange={(e) => setV({ ...v, size: e.target.value })} data-testid="tenant-edit-size">
            <option value="">{t("tenants.gestione.nonDichiarata")}</option>
            {TAGLIE.map((s) => <option key={s} value={s}>{enumLabel("sizeBand", s)}</option>)}
          </select></label>
        <label className="text-sm font-medium text-foreground">{t("tenants.detail.fields.status")}
          <select className={SELECT_CLASS} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as TenantStatus })} data-testid="tenant-edit-status">
            {STATI.map((s) => <option key={s} value={s}>{enumLabel("tenantStatus", s)}</option>)}
          </select></label>
        <div className="flex items-center gap-3 md:col-span-3">
          <Button type="button" data-testid="tenant-edit-save" disabled={!v.name.trim() || salva.isPending}
            onClick={() => { if (!cambiaStato || window.confirm(t("tenants.gestione.confermaStato", { stato: enumLabel("tenantStatus", v.status) }))) salva.mutate(); }}>
            {salva.isPending ? t("common:saving") : t("tenants.gestione.salva")}
          </Button>
          {salva.isSuccess && <span className="text-sm text-success">{t("tenants.gestione.salvato")}</span>}
          {salva.isError && <span data-testid="tenant-edit-error" className="text-sm text-danger">{t("tenants.gestione.errore")}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function NomePersona({ userId }: { userId: string }) {
  const q = useQuery({ queryKey: ["users", userId], queryFn: () => apiFetch<User>(`/v1/users/${userId}`), staleTime: 300_000 });
  return <span className="font-medium">{q.data ? cognomeNome(q.data) : "…"}</span>;
}

export function AssegnazioniPiattaforma({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const qc = useQueryClient();
  const puo = (useCurrentUserPermissions().data?.permissions ?? []).includes("platform_tenant_assignment:manage");
  const [persone, setPersone] = useState<User[]>([]);
  const chiave = ["platform-tenant-assignments", tenantId];
  const elenco = useQuery({
    queryKey: chiave,
    queryFn: () => apiFetch<PlatformTenantAssignmentListResponse>(`/v1/platform-tenant-assignments?tenantId=${tenantId}&limit=200`),
    enabled: puo,
  });
  const assegna = useMutation({
    mutationFn: () => apiFetch("/v1/platform-tenant-assignments", { method: "POST", body: { userId: persone[0]!.userId, tenantId } }),
    onSuccess: () => { setPersone([]); void qc.invalidateQueries({ queryKey: chiave }); },
  });
  const ritira = useMutation({
    mutationFn: (id: string) => apiFetch(`/v1/platform-tenant-assignments/${id}/revoke`, { method: "POST", body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chiave }),
  });
  if (!puo) return null;
  return (
    <Card data-testid="tenant-platform-assignments">
      <CardHeader><CardTitle as="h2">{t("tenants.gestione.assegnazioni")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("tenants.gestione.assegnazioniSpiega")}</p>
        <ul className="divide-y divide-border rounded-card border border-border text-sm">
          {(elenco.data?.items ?? []).map((a) => (
            <li key={a.assignmentId} data-testid="tenant-platform-assignment-row" className="flex items-center justify-between gap-3 px-4 py-2">
              <span><NomePersona userId={a.userId} /> <span className="text-xs text-muted-foreground">· {t("tenants.gestione.dal", { data: fmt.data(a.assignedAt) })}</span></span>
              <Button type="button" size="sm" variant="outline" data-testid="tenant-platform-assignment-revoke" disabled={ritira.isPending}
                onClick={() => { if (window.confirm(t("tenants.gestione.confermaRitira"))) ritira.mutate(a.assignmentId); }}>
                {t("tenants.gestione.ritira")}
              </Button>
            </li>
          ))}
          {(elenco.data?.items ?? []).length === 0 && <li className="px-4 py-2 text-muted-foreground">{t("tenants.gestione.nessunaAssegnazione")}</li>}
        </ul>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-80"><PersonPicker label={t("tenants.gestione.assegnaPersona")} value={persone} onChange={(x) => setPersone(x.slice(-1))} testId="tenant-platform-assign-person" /></div>
          <Button type="button" data-testid="tenant-platform-assign-submit" disabled={persone.length !== 1 || assegna.isPending} onClick={() => assegna.mutate()}>
            {assegna.isPending ? t("common:saving") : t("tenants.gestione.assegna")}
          </Button>
          {(assegna.isError || ritira.isError) && <span className="text-sm text-danger">{t("tenants.gestione.errore")}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
