"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { BlueprintActivation, BlueprintProcess } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

function buildColumns(t: TFunction): DataColumn<BlueprintProcess>[] {
  return [
    { header: t("processes.columns.ordinal"), cell: (p) => <span className="text-xs text-muted-foreground">{p.ordinal}</span> },
    // Repertorio interfacce (B3): il nome del processo, non il suo codice (R2, R4); il tipo in parole,
    // con gli stessi termini della pagina del responsabile di processo (R7).
    { header: t("processes.columns.name"), cell: (p) => <span className="font-medium text-foreground" data-testid="process-name">{p.name}</span> },
    {
      header: t("processes.columns.optional"),
      cell: (p) => <StatusPill tone={p.isOptional ? "warning" : "neutral"}>{p.isOptional ? t("processes.optionalYes") : t("processes.optionalNo")}</StatusPill>,
    },
  ];
}

export default function ProcessesPage() {
  const { t } = useTranslation("blueprints");
  // D3-16: i processi sono quelli della variante ATTIVATA dal tenant; senza il filtro la pagina
  // mescolava i processi di tutti i modelli del catalogo (due modelli, numeri d'ordine che ricominciano).
  // Con piu' attivazioni attive (un mandato di piattaforma vede tutti i tenant) non c'e' una variante sola
  // e l'elenco resta intero.
  const attive = useQuery({
    queryKey: ["blueprint-activations", "active"],
    queryFn: () => apiFetch<{ items: BlueprintActivation[]; total: number }>("/v1/blueprint-activations?status=ACTIVE&limit=200"),
  });
  const varianti = new Set((attive.data?.items ?? []).map((a) => a.variantId));
  const variantId = varianti.size === 1 ? [...varianti][0] : "";
  // C4 (#42): server-side pagination (was `?limit=200`).
  const processes = usePaginatedList<BlueprintProcess>({
    queryKey: ["blueprint-processes", "list", variantId],
    path: "/v1/blueprint-processes",
    params: { variantId },
    enabled: !attive.isLoading,
  });

  const columns = useMemo(() => buildColumns(t), [t]);

  return (
    <DataTablePanel<BlueprintProcess>
      pageTestId="processes-page"
      titleTestId="processes-title"
      countTestId="processes-count"
      title={t("processes.title")}
      description={t("processes.description")}
      count={processes.query.data ? t("processes.count", { count: processes.total }) : undefined}
      isLoading={processes.query.isLoading}
      isError={processes.query.isError}
      error={processes.query.error}
      errorMessage={t("processes.error")}
      rows={processes.rows}
      server={processes.server}
      rowKey={(p) => p.blueprintProcessId}
      rowTestId="processes-row"
      columns={columns}
      emptyTestId="processes-empty"
      emptyTitle={t("processes.emptyTitle")}
      emptyDescription={t("processes.emptyDescription")}
      caption={t("processes.caption")}
    />
  );
}
