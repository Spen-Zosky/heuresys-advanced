"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { SchedePagina } from "@/components/schede-pagina";
import type { MfaPolicy, ListMfaPoliciesResponse, ListMfaExemptionsResponse, MfaExemption } from "@heuresys/shared";
import { useFormat } from "@/lib/format";
import { apiFetch } from "../../../../lib/api/fetch";
import { useCurrentUserPermissions } from "../../../../lib/api/auth";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";

/** The 8 canonical roles (config/constants.ts ROLE_CODES — validated server-side). */
const ROLE_CODES = [
  "PLATFORM_ADMIN",
  "TENANT_ADMIN",
  "BLUEPRINT_MANAGER",
  "HRMS_MANAGER",
  "PROCESS_OWNER",
  "MANAGER",
  "USER",
  "READ_ONLY",
] as const;

interface TenantItem {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
}

interface PolicyRowProps {
  tenantId: string;
  tenantLabel: string;
  policy: MfaPolicy | null;
  canManage: boolean;
}

function PolicyRow({ tenantId, tenantLabel, policy, canManage }: PolicyRowProps) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(policy?.enabled ?? false);
  // null roleCodes = ALL roles in scope (server contract).
  const [allRoles, setAllRoles] = useState(policy ? policy.roleCodes === null : true);
  const [selected, setSelected] = useState<Set<string>>(new Set(policy?.roleCodes ?? []));
  const [feedback, setFeedback] = useState<"ok" | "err" | null>(null);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<MfaPolicy>(`/v1/mfa-policy/${tenantId}`, {
        method: "PUT",
        body: {
          enabled,
          roleCodes: allRoles ? null : [...selected],
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mfa-policy"] });
      setFeedback("ok");
    },
    onError: () => setFeedback("err"),
  });

  const toggleRole = (code: string) => {
    setFeedback(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const saveDisabled = save.isPending || (!allRoles && selected.size === 0);

  return (
    <li
      className="space-y-3 px-4 py-4"
      data-testid="mfa-policy-row"
      data-tenant-id={tenantId}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground" data-testid="mfa-policy-tenant">
            {tenantLabel}
          </span>
          <Badge
            variant={policy?.enabled ? "success" : "secondary"}
            data-testid="mfa-policy-status"
          >
            {policy?.enabled ? t("mfaPolicy.enabled") : t("mfaPolicy.disabled")}
          </Badge>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={enabled ? "secondary" : "outline"}
              data-testid="mfa-policy-toggle"
              onClick={() => {
                setFeedback(null);
                setEnabled((v) => !v);
              }}
            >
              {enabled ? t("mfaPolicy.toggleOff") : t("mfaPolicy.toggleOn")}
            </Button>
            <Button
              type="button"
              data-testid="mfa-policy-save"
              disabled={saveDisabled}
              onClick={() => save.mutate()}
            >
              {save.isPending ? t("mfaPolicy.saving") : t("mfaPolicy.save")}
            </Button>
          </div>
        )}
      </div>

      {canManage && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("mfaPolicy.rolesHint")}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant={allRoles ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs"
              data-testid="mfa-policy-all-roles"
              onClick={() => {
                setFeedback(null);
                setAllRoles((v) => !v);
              }}
            >
              {t("mfaPolicy.allRoles")}
            </Button>
            {!allRoles &&
              ROLE_CODES.map((code) => (
                <Button
                  key={code}
                  type="button"
                  variant={selected.has(code) ? "secondary" : "ghost"}
                  className="h-7 px-2 font-mono text-xs"
                  data-testid={`mfa-policy-role-${code}`}
                  onClick={() => toggleRole(code)}
                >
                  {code}
                </Button>
              ))}
          </div>
        </div>
      )}

      {!canManage && policy && policy.roleCodes !== null && (
        <p className="font-mono text-xs text-muted-foreground" data-testid="mfa-policy-roles-ro">
          {policy.roleCodes.join(", ")}
        </p>
      )}

      {feedback === "ok" && (
        <p className="text-xs text-success" data-testid="mfa-policy-saved">
          {t("mfaPolicy.saved")}
        </p>
      )}
      {feedback === "err" && (
        <p className="text-xs text-danger" data-testid="mfa-policy-error">
          {t("mfaPolicy.errorSave")}
        </p>
      )}
    </li>
  );
}

/**
 * ADR-0050 D3, parte visibile (S-14): chi è esentato dal secondo fattore, perché, da chi e
 * fino a quando. Una scaduta vale come assente (il login la ignora); spegnerla la chiude.
 * Accendere o rinnovare un'esenzione resta un atto con autore, fuori da questa pagina.
 */
function ExemptionsCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation("admin");
  const f = useFormat();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mfa-policy", "exemptions"],
    queryFn: () => apiFetch<ListMfaExemptionsResponse>("/v1/mfa-policy/exemptions"),
  });
  const spegni = useMutation({
    mutationFn: (id: string) =>
      apiFetch<MfaExemption>(`/v1/mfa-policy/exemptions/${id}/disable`, { method: "POST", body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["mfa-policy", "exemptions"] }),
  });
  const variante = (s: MfaExemption["state"]) =>
    s === "ACTIVE" ? "default" : s === "EXPIRED" ? "destructive" : "secondary";

  return (
    <Card data-testid="mfa-exemptions-card">
      <CardHeader>
        <CardTitle>{t("mfaPolicy.exemptions.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("mfaPolicy.exemptions.description")}</p>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? (
          <div className="p-6"><StatoCaricamento /></div>
        ) : q.isError ? (
          <div className="p-6">
            <StatoErrore errore={q.error} testId="mfa-exemptions-error" onRiprova={() => void q.refetch()} />
          </div>
        ) : (q.data?.items.length ?? 0) === 0 ? (
          <div className="p-6"><StatoVuoto titolo={t("mfaPolicy.exemptions.empty")} testId="mfa-exemptions-empty" /></div>
        ) : (
          <ul className="divide-y divide-border" data-testid="mfa-exemptions-list">
            {q.data!.items.map((e) => (
              <li key={e.exemptionId} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4" data-testid="mfa-exemption-row">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.userDisplayName ?? e.userEmail}</span>
                    <Badge variant={variante(e.state)} data-testid="mfa-exemption-state">
                      {t(`mfaPolicy.exemptions.state.${e.state}`)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.userEmail}</p>
                  <p className="text-sm">{e.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("mfaPolicy.exemptions.expires", { date: e.expiresAt ? f.dataOra(e.expiresAt) : "—" })}
                    {" · "}
                    {e.authorDisplayName
                      ? t("mfaPolicy.exemptions.author", { name: e.authorDisplayName })
                      : t("mfaPolicy.exemptions.noAuthor")}
                  </p>
                </div>
                {canManage && e.state !== "DISABLED" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="mfa-exemption-disable"
                    disabled={spegni.isPending}
                    onClick={() => spegni.mutate(e.exemptionId)}
                  >
                    {t("mfaPolicy.exemptions.disable")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {spegni.isError && (
          <p role="alert" className="px-6 pb-4 text-sm text-danger">{spegni.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminMfaPolicyPage() {
  const { t } = useTranslation("admin");
  const perms = useCurrentUserPermissions();
  const canManage = new Set(perms.data?.permissions ?? []).has("mfa_policy:manage");

  const policies = useQuery({
    queryKey: ["mfa-policy", "list"],
    queryFn: () => apiFetch<ListMfaPoliciesResponse>("/v1/mfa-policy/"),
  });

  // Tenant names: PLATFORM_ADMIN gets the full list; a TENANT_ADMIN may get a
  // scoped list or a 403 — in that case rows fall back to the policy items.
  const tenants = useQuery({
    queryKey: ["mfa-policy", "tenants"],
    queryFn: () =>
      apiFetch<{ items: TenantItem[]; total: number }>("/v1/tenants?limit=200"),
    retry: false,
  });

  const policyByTenant = new Map<string, MfaPolicy>(
    (policies.data?.items ?? []).map((p) => [p.tenantId, p]),
  );
  const rows: Array<{ tenantId: string; label: string }> = tenants.data
    ? tenants.data.items.map((tn) => ({
        tenantId: tn.tenantId,
        label: tn.tenantName,
      }))
    : (policies.data?.items ?? []).map((p) => ({ tenantId: p.tenantId, label: p.tenantId }));

  const enabledCount = (policies.data?.items ?? []).filter((p) => p.enabled).length;

  return (
    <main data-testid="admin-mfa-policy-page" className="mx-auto max-w-4xl space-y-6 px-6 pb-8">
      <PageHeader
        title={t("mfaPolicy.title")}
        description={t("mfaPolicy.description")}
        badges={
          <Badge variant="secondary" data-testid="mfa-policy-count">
            {t("mfaPolicy.count", { enabled: enabledCount, total: rows.length })}
          </Badge>
        }
      />

      {/* C5: regole per azienda ed esenzioni in due schede */}
      <SchedePagina
        schede={[
          { id: "regole", titolo: t("mfaPolicy.tabs.rules"), contenuto: (
      <Card>
        <CardHeader>
          <CardTitle>{t("mfaPolicy.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {policies.isLoading ? (
            <div className="p-6">
              <StatoCaricamento />
            </div>
          ) : policies.isError ? (
            <div className="p-6">
              <StatoErrore
                errore={policies.error}
                motivoNegato={t("mfaPolicy.accessDeniedDesc")}
                testId="mfa-policy-access-error"
                onRiprova={() => void policies.refetch()}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <StatoVuoto titolo={t("mfaPolicy.empty")} testId="mfa-policy-empty" />
            </div>
          ) : (
            <ul className="divide-y divide-border" data-testid="mfa-policy-list">
              {rows.map((r) => (
                <PolicyRow
                  key={r.tenantId}
                  tenantId={r.tenantId}
                  tenantLabel={r.label}
                  policy={policyByTenant.get(r.tenantId) ?? null}
                  canManage={canManage}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
          ) },
          { id: "esenzioni", titolo: t("mfaPolicy.tabs.exemptions"), contenuto: <ExemptionsCard canManage={canManage} /> },
        ]}
      />
    </main>
  );
}
