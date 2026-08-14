"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Button } from "@heuresys/ui";
import type { Tenant, CreateTenantBodyInput, IndustryCode } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";

// #45 C3 — creazione e archiviazione delle aziende clienti dall'interfaccia.
// Le API esistevano da MVP-1 e nessuna pagina le chiamava: aprire un'azienda voleva dire
// passare dal database. Stesso cancello doppio di C1 (#44): i comandi si nascondono a chi
// non ha il permesso, ma l'autorità resta il service — nascondere un pulsante non è una
// protezione, è cortesia verso chi non potrebbe usarlo.

export default function TenantsListPage() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canCreate = perms.data?.permissions.includes("tenant:create") ?? false;
  const canArchive = perms.data?.permissions.includes("tenant:delete") ?? false;

  const [form, setForm] = useState({
    tenantCode: "",
    tenantName: "",
    tenantLegalName: "",
    tenantCountryCode: "",
    tenantIndustryCode: "",
  });
  const [notice, setNotice] = useState<string | null>(null);

  // D-83: il settore è obbligatorio nel database (mig 000305, I21) e il suo dominio è
  // il catalogo `sys_industry_codes`. La tendina lo legge dall'API — nessun elenco
  // scritto a mano qui, o il giorno che il catalogo cambia questa pagina mentirebbe.
  const industries = useQuery({
    queryKey: ["tenants", "industry-codes"],
    queryFn: () => apiFetch<{ items: IndustryCode[] }>("/v1/tenants/industry-codes"),
    enabled: canCreate,
  });

  const create = useMutation({
    mutationFn: (body: CreateTenantBodyInput) => apiFetch<Tenant>("/v1/tenants", { method: "POST", body }),
    onSuccess: () => {
      setNotice(t("tenants.editing.created"));
      setForm({
        tenantCode: "",
        tenantName: "",
        tenantLegalName: "",
        tenantCountryCode: "",
        tenantIndustryCode: "",
      });
      void qc.invalidateQueries({ queryKey: ["tenants"] });
    },
  });

  const archive = useMutation({
    mutationFn: (tenantId: string) => apiFetch(`/v1/tenants/${tenantId}`, { method: "DELETE" }),
    onSuccess: () => {
      setNotice(t("tenants.editing.archived"));
      void qc.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
  // C4 (#42): server-side pagination (was `?limit=200`).
  const tenants = usePaginatedList<Tenant>({ queryKey: ["tenants", "list"], path: "/v1/tenants" });

  const columns = useMemo<DataColumn<Tenant>[]>(
    () => [
      {
        header: t("tenants.columns.name"),
        cell: (row) => (
          <div className="flex flex-col">
            <Link
              href={`/tenants/${row.tenantId}`}
              data-testid="tenant-link"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {row.tenantName ?? t("tenants.fallbackName")}
            </Link>
            <span className="font-mono text-xs text-muted-foreground">{row.tenantCode}</span>
          </div>
        ),
      },
      {
        header: t("tenants.columns.country"),
        cell: (row) => <span className="text-xs text-muted-foreground">{row.tenantCountryCode ?? t("tenants.dash")}</span>,
      },
      {
        header: t("tenants.columns.size"),
        cell: (row) => <span className="text-xs text-muted-foreground">{row.tenantSizeBand ?? t("tenants.dash")}</span>,
      },
      { header: t("tenants.columns.status"), cell: (row) => <StatusBadge value={row.tenantStatus} /> },
      ...(canArchive
        ? [
            {
              header: "",
              cell: (row: Tenant) =>
                row.tenantStatus === "ARCHIVED" ? null : (
                  <Button
                    variant="ghost"
                    data-testid="tenant-archive"
                    disabled={archive.isPending}
                    onClick={() => {
                      // Conferma esplicita: archiviare un'azienda la toglie dall'operatività,
                      // e un clic per sbaglio su una riga sbagliata non deve poterlo fare.
                      if (window.confirm(t("tenants.editing.archiveConfirm", { name: row.tenantName ?? row.tenantCode }))) {
                        archive.mutate(row.tenantId);
                      }
                    }}
                  >
                    {t("tenants.editing.archiveAction")}
                  </Button>
                ),
            } as DataColumn<Tenant>,
          ]
        : []),
    ],
    [t, canArchive, archive],
  );

  return (
    <div className="space-y-6">
      {canCreate ? (
        <section
          data-testid="tenant-create-panel"
          className="mx-auto max-w-7xl rounded-card border border-border bg-card px-6 py-4 shadow-card"
        >
          <h2 className="text-base font-semibold text-foreground">{t("tenants.editing.createTitle")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("tenants.editing.createHint")}</p>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setNotice(null);
              // Niente `as CreateTenantBody`: era il cast a nascondere che questo body
              // non rispettava più il contratto (D-83). Il tipo deve poter protestare —
              // ed è il tipo d'INGRESSO, quello che un client scrive davvero: `tenantStatus`
              // e `tenantMetadata` hanno un default, non li compila chi apre l'azienda.
              const body: CreateTenantBodyInput = {
                tenantCode: form.tenantCode.trim(),
                tenantName: form.tenantName.trim(),
                tenantIndustryCode: form.tenantIndustryCode,
                ...(form.tenantLegalName.trim() ? { tenantLegalName: form.tenantLegalName.trim() } : {}),
                ...(form.tenantCountryCode.trim() ? { tenantCountryCode: form.tenantCountryCode.trim().toUpperCase() } : {}),
              };
              create.mutate(body);
            }}
          >
            {([
              ["tenantCode", t("tenants.editing.codeLabel"), true],
              ["tenantName", t("tenants.editing.nameLabel"), true],
              ["tenantLegalName", t("tenants.editing.legalNameLabel"), false],
              ["tenantCountryCode", t("tenants.editing.countryLabel"), false],
            ] as const).map(([campo, etichetta, obbligatorio]) => (
              <label key={campo} className="flex flex-col gap-1 text-xs text-muted-foreground">
                {etichetta}
                <input
                  data-testid={`tenant-field-${campo}`}
                  required={obbligatorio}
                  value={form[campo]}
                  onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
                  className="rounded-input border border-border bg-background px-2 py-1 text-sm text-foreground"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("tenants.editing.industryLabel")}
              <select
                data-testid="tenant-field-tenantIndustryCode"
                required
                value={form.tenantIndustryCode}
                onChange={(e) => setForm((f) => ({ ...f, tenantIndustryCode: e.target.value }))}
                className="rounded-input border border-border bg-background px-2 py-1 text-sm text-foreground"
              >
                <option value="">{t("tenants.editing.industryPlaceholder")}</option>
                {(industries.data?.items ?? []).map((i) => (
                  <option key={i.industryCode} value={i.industryCode}>
                    {i.industryName}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" data-testid="tenant-create-submit" disabled={create.isPending}>
              {create.isPending ? t("tenants.editing.creating") : t("tenants.editing.submit")}
            </Button>
          </form>
          {create.isError ? (
            <p data-testid="tenant-create-error" className="mt-2 text-sm text-danger">
              {t("tenants.editing.createError")}
            </p>
          ) : null}
          {archive.isError ? (
            <p data-testid="tenant-archive-error" className="mt-2 text-sm text-danger">
              {t("tenants.editing.archiveError")}
            </p>
          ) : null}
          {notice ? (
            <p data-testid="tenant-notice" className="mt-2 text-sm text-success" role="status">
              {notice}
            </p>
          ) : null}
        </section>
      ) : null}

      <DataTablePanel<Tenant>
      pageTestId="tenants-page"
      titleTestId="tenants-title"
      countTestId="tenants-count"
      title={t("tenants.title")}
      description={t("tenants.description")}
      count={tenants.query.data ? t("tenants.count", { count: tenants.total }) : undefined}
      isLoading={tenants.query.isLoading}
      isError={tenants.query.isError}
      errorTestId="tenants-error"
      errorMessage={t("tenants.errorMessage")}
      rows={tenants.rows}
      server={tenants.server}
      rowKey={(row) => row.tenantId}
      rowTestId="tenants-row"
      columns={columns}
      emptyTestId="tenants-empty"
      emptyTitle={t("tenants.emptyTitle")}
      emptyDescription={t("tenants.emptyDescription")}
      caption={t("tenants.caption")}
      />
    </div>
  );
}
