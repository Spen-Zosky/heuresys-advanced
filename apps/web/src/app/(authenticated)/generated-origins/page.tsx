"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { KPIStrip, PageHeader, type KpiCardData } from "@heuresys/ui";
import type {
  GeneratedOrigin,
  GeneratedOriginStatus,
  GeneratedOriginSummaryResponse,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { StatusPill } from "@/components/status-pill";

/**
 * #198 Tenant Builder P3, T7 — IL REGISTRO DELLE RIGHE GENERATE.
 *
 * Risponde a una domanda che prima del registro non aveva risposta: **quali** righe di
 * questa azienda sono nate da una costruzione, e da quale versione di quale fascicolo.
 * Non «quante»: un conteggio non permette di ritrovarle in una tabella dove convivono
 * righe generate e righe vere.
 *
 * PERCHE' E' UNA PAGINA AUTONOMA e non una scheda del fascicolo, come diceva il piano.
 * `tenant_blueprint:read` ce l'ha solo `PLATFORM_ADMIN`; `provenance:read` — il permesso
 * di QUESTI dati — ce l'ha anche `TENANT_ADMIN`. Annidata nel fascicolo, la pagina
 * sarebbe stata irraggiungibile proprio dal ruolo con cui il piano chiede di provarla.
 * Sta quindi accanto a `/provenance`, che ha lo stesso permesso e la stessa domanda.
 *
 * L'isolamento per azienda NON e' qui: e' nel servizio (`tenantFilter` — platform vede
 * tutto, tenant-admin la propria azienda). Una pagina non e' un confine di sicurezza.
 *
 * Lo ZERO di questa pagina e' informativo, non un guasto: finche' nessuna costruzione e'
 * stata applicata in produzione il registro E' vuoto, e dirlo e' la lettura fedele.
 */
const STATI: GeneratedOriginStatus[] = ["GENERATED", "CONFIRMED", "SUPERSEDED"];

function tonoPerStato(s: GeneratedOriginStatus): "success" | "warning" | "info" | "neutral" {
  if (s === "CONFIRMED") return "success";
  if (s === "SUPERSEDED") return "warning";
  if (s === "GENERATED") return "info";
  return "neutral";
}

function colonneRighe(t: TFunction): DataColumn<GeneratedOrigin>[] {
  return [
    {
      header: t("generatedOrigins.cols.targetTable"),
      cell: (r) => <span className="font-mono text-xs">{r.targetTable}</span>,
    },
    {
      header: t("generatedOrigins.cols.targetRecord"),
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground">{r.targetRecordId}</span>
      ),
    },
    {
      header: t("generatedOrigins.cols.status"),
      cell: (r) => <StatusPill tone={tonoPerStato(r.status)}>{r.status}</StatusPill>,
    },
    {
      header: t("generatedOrigins.cols.justification"),
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.justification ?? t("generatedOrigins.noJustification")}
        </span>
      ),
    },
    {
      header: t("generatedOrigins.cols.createdAt"),
      cell: (r) => (
        <span className="tabular-nums text-xs">{r.createdAt.slice(0, 10)}</span>
      ),
    },
  ];
}

export default function GeneratedOriginsPage() {
  const { t } = useTranslation("admin");
  const [stato, setStato] = useState<GeneratedOriginStatus | "">("");

  const sommario = useQuery({
    queryKey: ["generated-origins", "summary"],
    queryFn: () => apiFetch<GeneratedOriginSummaryResponse>("/v1/generated-origins/summary"),
  });

  const righe = usePaginatedList<GeneratedOrigin>({
    queryKey: ["generated-origins", "list"],
    path: "/v1/generated-origins",
    params: { status: stato || undefined },
  });

  const colonne = useMemo(() => colonneRighe(t), [t]);

  const kpis: KpiCardData[] = useMemo(() => {
    const s = sommario.data?.totals;
    if (!s) return [];
    return [
      { label: t("generatedOrigins.kpi.total"), value: s.total.toLocaleString() },
      { label: t("generatedOrigins.kpi.generated"), value: s.generated.toLocaleString(), iconTone: "info" },
      { label: t("generatedOrigins.kpi.confirmed"), value: s.confirmed.toLocaleString(), iconTone: "success" },
      {
        label: t("generatedOrigins.kpi.superseded"),
        value: s.superseded.toLocaleString(),
        iconTone: s.superseded > 0 ? "warning" : "success",
      },
      {
        label: t("generatedOrigins.kpi.tables"),
        value: (sommario.data?.byTable.length ?? 0).toLocaleString(),
      },
    ];
  }, [sommario.data, t]);

  const colonneSommario: DataColumn<GeneratedOriginSummaryResponse["byTable"][number]>[] = useMemo(
    () => [
      {
        header: t("generatedOrigins.cols.targetTable"),
        cell: (r) => <span className="font-mono text-xs">{r.targetTable}</span>,
      },
      {
        header: t("generatedOrigins.cols.total"),
        align: "right",
        cell: (r) => <span className="tabular-nums">{r.total.toLocaleString()}</span>,
      },
      { header: "GENERATED", align: "right", cell: (r) => <span className="tabular-nums">{r.generated.toLocaleString()}</span> },
      { header: "CONFIRMED", align: "right", cell: (r) => <span className="tabular-nums">{r.confirmed.toLocaleString()}</span> },
      { header: "SUPERSEDED", align: "right", cell: (r) => <span className="tabular-nums">{r.superseded.toLocaleString()}</span> },
    ],
    [t],
  );

  const vuotoDelTutto =
    !sommario.isLoading && !sommario.isError && (sommario.data?.totals.total ?? 0) === 0;

  return (
    <main data-testid="generated-origins-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="generated-origins-title"
        title={t("generatedOrigins.title")}
        description={t("generatedOrigins.description")}
      />

      {/* Uno zero qui non e' un errore ed e' scritto che non lo e': finche' nessuna
          costruzione e' stata applicata, il registro e' legittimamente vuoto. Senza
          questa riga un elenco vuoto si legge «qualcosa non ha funzionato». */}
      {vuotoDelTutto ? (
        <p
          data-testid="generated-origins-nothing-yet"
          className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
        >
          {t("generatedOrigins.nothingYet")}
        </p>
      ) : null}

      {kpis.length > 0 ? <KPIStrip items={kpis} /> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("generatedOrigins.byTable")}</h2>
        <EntityTable<GeneratedOriginSummaryResponse["byTable"][number]>
          isLoading={sommario.isLoading}
          isError={sommario.isError}
          errorMessage={t("generatedOrigins.error")}
          rows={sommario.data?.byTable ?? []}
          rowKey={(r) => r.targetTable}
          rowTestId="generated-origins-summary-row"
          columns={colonneSommario}
          emptyTitle={t("generatedOrigins.empty")}
          caption={t("generatedOrigins.byTable")}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t("generatedOrigins.records")}</h2>
          <select
            data-testid="generated-origins-status-filter"
            aria-label={t("generatedOrigins.cols.status")}
            className="rounded-control border border-border bg-card px-2 py-1 text-sm text-muted-foreground"
            value={stato}
            onChange={(e) => setStato(e.target.value as GeneratedOriginStatus | "")}
          >
            <option value="">{t("generatedOrigins.allStatuses")}</option>
            {STATI.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <EntityTable<GeneratedOrigin>
          isLoading={righe.query.isLoading}
          isError={righe.query.isError}
          errorMessage={t("generatedOrigins.error")}
          rows={righe.rows}
          server={righe.server}
          rowKey={(r) => r.generatedRecordOriginId}
          rowTestId="generated-origins-row"
          columns={colonne}
          emptyTitle={t("generatedOrigins.empty")}
          caption={t("generatedOrigins.records")}
        />
      </section>
    </main>
  );
}
