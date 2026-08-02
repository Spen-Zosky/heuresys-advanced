"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, PageHeader } from "@heuresys/ui";
import type { LeadListResponse, LeadResponse, LeadStatus } from "@heuresys/shared";
import { LeadStatusEnum } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

// #4 GTM W4 — gestione delle richieste di contatto arrivate dal sito pubblico.
// Tutto viene da GET /v1/leads sul database vivo; lo stato si cambia con PATCH
// /v1/leads/:leadId. Nessun dato finto, empty-state reale.
//
// Si modifica SOLO lo stato: nome, azienda, email e messaggio sono ciò che la persona
// ha scritto di sé, e il consenso raccolto vale su quei valori — una superficie che
// potesse riscriverli renderebbe il consenso una dichiarazione su un dato non più
// verificabile. Per questo la riga mostra data e versione del consenso.

const STATUS_TONE: Record<LeadStatus, "info" | "success" | "warning" | "neutral"> = {
  NEW: "warning",
  CONTACTED: "info",
  QUALIFIED: "success",
  CLOSED: "neutral",
};

const STATUSES = LeadStatusEnum.options;

export default function LeadsPage() {
  const { t, i18n } = useTranslation("admin");
  const qc = useQueryClient();
  const [status, setStatus] = useState<LeadStatus | "">("");

  const leads = useQuery({
    queryKey: ["leads", status],
    queryFn: () =>
      apiFetch<LeadListResponse>(`/v1/leads${status ? `?status=${status}` : ""}`),
  });

  const advance = useMutation({
    mutationFn: (v: { leadId: string; status: LeadStatus }) =>
      apiFetch<LeadResponse>(`/v1/leads/${v.leadId}`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }),
    [i18n.language],
  );

  const columns = useMemo<DataColumn<LeadResponse>[]>(
    () => [
      {
        header: t("leads.cols.person"),
        cell: (r) => (
          <span className="flex flex-col leading-tight">
            <span className="font-medium text-foreground">{r.name}</span>
            <span className="text-[11px] text-muted-foreground">{r.email}</span>
          </span>
        ),
      },
      {
        header: t("leads.cols.company"),
        cell: (r) => (
          <span className="flex flex-col leading-tight">
            <span className="text-sm text-foreground">{r.company}</span>
            {r.role ? <span className="text-[11px] text-muted-foreground">{r.role}</span> : null}
          </span>
        ),
      },
      {
        header: t("leads.cols.source"),
        cell: (r) => <span className="text-xs text-muted-foreground">{r.source}</span>,
      },
      {
        header: t("leads.cols.received"),
        cell: (r) => (
          <span className="flex flex-col leading-tight">
            <span className="text-xs text-foreground">{dateFmt.format(new Date(r.createdAt))}</span>
            <span
              className="text-[10px] text-muted-foreground"
              title={t("leads.consentNote", {
                date: dateFmt.format(new Date(r.consentAt)),
                version: r.consentVersion,
              })}
            >
              {r.consentVersion}
            </span>
          </span>
        ),
      },
      {
        header: t("leads.cols.status"),
        cell: (r) => (
          <span className="flex items-center gap-2" data-testid={`lead-status-${r.status}`}>
            <StatusPill tone={STATUS_TONE[r.status]}>{t(`leads.statuses.${r.status}`)}</StatusPill>
            <select
              aria-label={t("leads.filterLabel")}
              data-testid="lead-status-select"
              className="rounded-input border border-border bg-background px-2 py-1 text-xs text-foreground"
              value={r.status}
              disabled={advance.isPending}
              onChange={(e) => advance.mutate({ leadId: r.leadId, status: e.target.value as LeadStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`leads.statuses.${s}`)}
                </option>
              ))}
            </select>
          </span>
        ),
      },
    ],
    [t, dateFmt, advance],
  );

  const data = leads.data;

  return (
    <main data-testid="leads-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="leads-title"
        title={t("leads.title")}
        description={t("leads.description")}
        badges={
          data ? (
            <Badge variant="secondary" data-testid="leads-count">
              {t("leads.count", { count: data.total })}
            </Badge>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        <label htmlFor="lead-filter" className="text-xs text-muted-foreground">
          {t("leads.filterLabel")}
        </label>
        <select
          id="lead-filter"
          data-testid="leads-filter"
          className="rounded-input border border-border bg-background px-2 py-1 text-sm text-foreground"
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus | "")}
        >
          <option value="">{t("leads.filterAll")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`leads.statuses.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {advance.isError ? (
        <p data-testid="leads-update-error" className="text-sm text-destructive">
          {t("leads.updateError")}
        </p>
      ) : null}

      <EntityTable<LeadResponse>
        isLoading={leads.isLoading}
        isError={leads.isError}
        errorMessage={t("leads.errorMessage")}
        rows={data?.items ?? []}
        rowKey={(r) => r.leadId}
        rowTestId="lead-row"
        columns={columns}
        emptyTestId="leads-empty"
        emptyTitle={t("leads.emptyTitle")}
        emptyDescription={t("leads.emptyDescription")}
        caption={t("leads.caption")}
      />
    </main>
  );
}
