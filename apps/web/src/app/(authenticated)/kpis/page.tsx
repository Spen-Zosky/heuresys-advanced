"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button, Input } from "@heuresys/ui";
import type { KpiDefinition } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { useEnumLabel, type EnumLabelFn } from "@/lib/enum-labels";
import { KpiMetrologyPanel } from "@/components/kpi-metrology-panel";
import { KpiCreator, KpiEditor } from "./_components/kpi-forms";

function buildColumns(
  t: TFunction,
  enumLabel: EnumLabelFn,
  onEdit: (id: string) => void,
): DataColumn<KpiDefinition>[] {
  return [
    { header: t("shared.code"), cell: (k) => <span className="font-mono text-xs">{k.code}</span> },
    { header: t("shared.name"), cell: (k) => <span className="font-medium text-foreground">{k.name}</span> },
    { header: t("kpis.cols.unit"), cell: (k) => <span className="text-xs text-muted-foreground">{k.unit ?? "—"}</span> },
    { header: t("kpis.cols.polarity"), cell: (k) => <span className="text-xs text-muted-foreground">{enumLabel("kpiPolarity", k.polarity)}</span> },
    {
      header: t("shared.scope"),
      cell: (k) => (
        <StatusPill tone={k.isGlobal ? "info" : "neutral"}>
          {k.isGlobal ? t("shared.global") : t("shared.tenant")}
        </StatusPill>
      ),
    },
    {
      header: t("common:table.actions"),
      cell: (k) => (
        <Button type="button" variant="outline" data-testid={`kpi-edit-${k.code}`} onClick={() => onEdit(k.kpiDefinitionId)}>
          {t("kpis.form.edit")}
        </Button>
      ),
    },
  ];
}

export default function KpisCataloguePage() {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  // L'indicatore in lavorazione + il filtro testuale: senza cercare, un KPI
  // appena definito finisce oltre la prima pagina e non si può correggere (#43).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cerca, setCerca] = useState("");
  const columns = useMemo(() => buildColumns(t, enumLabel, setEditingId), [t, enumLabel]);
  // C4 (#42): server-side pagination (was `?limit=200`).
  const kpis = usePaginatedList<KpiDefinition>({
    queryKey: ["kpi-definitions", "list"],
    path: "/v1/kpi-definitions",
    params: { search: cerca.trim() },
  });
  // #196 / E22 — le due specie di indicatori non si sommano in silenzio.
  // Un indicatore puo' essere DI PIATTAFORMA (catalogo comune, confrontabile) o
  // DELL'AZIENDA (E22: quelli di un'azienda sono suoi). Sono cose diverse, e un
  // numero unico ne darebbe una cifra plausibile che le somma: non un errore di
  // calcolo, ma una misura che non dice di che cosa parla. Finche' nessuna azienda
  // e' stata costruita da un fascicolo la seconda specie ha zero esemplari, quindi
  // il caso e' CIECO oggi e va letto sapendolo — non «a posto».
  // Costa una riga: `limit=1`, si legge solo `total`.
  const proprie = useQuery({
    queryKey: ["kpi-definitions", "conteggio-azienda", cerca.trim()],
    queryFn: () =>
      apiFetch<{ total: number }>(
        `/v1/kpi-definitions?isGlobal=false&limit=1${cerca.trim() ? `&search=${encodeURIComponent(cerca.trim())}` : ""}`,
      ),
  });

  return (
    <DataTablePanel<KpiDefinition>
      pageTestId="kpis-page"
      titleTestId="kpis-title"
      countTestId="kpis-count"
      title={t("kpis.title")}
      description={t("kpis.description")}
      count={
        kpis.query.data && proprie.data
          ? t("kpis.count", {
              count: kpis.total,
              piattaforma: kpis.total - proprie.data.total,
              azienda: proprie.data.total,
            })
          : undefined
      }
      isLoading={kpis.query.isLoading}
      isError={kpis.query.isError}
      errorMessage={t("kpis.errorMessage")}
      rows={kpis.rows}
      server={kpis.server}
      rowKey={(k) => k.kpiDefinitionId}
      rowTestId="kpis-row"
      columns={columns}
      emptyTestId="kpis-empty"
      emptyTitle={t("kpis.emptyTitle")}
      emptyDescription={t("kpis.emptyDescription")}
      caption={t("kpis.caption")}
    >
      {/* #31 (S1018): metrology — assessment methods + weighting rules catalogs */}
      <KpiMetrologyPanel />
      <div className="max-w-sm">
        <label htmlFor="kpis-search" className="mb-1 block text-sm font-medium text-foreground">
          {t("kpis.form.search")}
        </label>
        <Input
          id="kpis-search"
          data-testid="kpis-search"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder={t("kpis.form.searchPlaceholder")}
        />
      </div>
      {/* #43: il catalogo si LEGGEVA soltanto; qui si definisce e si corregge. */}
      <KpiCreator />
      {editingId && <KpiEditor kpiId={editingId} onClose={() => setEditingId(null)} />}
    </DataTablePanel>
  );
}
