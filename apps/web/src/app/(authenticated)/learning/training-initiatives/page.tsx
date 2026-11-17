"use client";

import { useMemo, useState } from "react";
import { Button } from "@heuresys/ui";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { TrainingInitiative } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { EnumStatusBadge } from "@/components/enum-badge";
import { useFormat, type Formati } from "@/lib/format";
import { ModificaIniziativa, NuovaIniziativa, usePuoModificareIniziative } from "./iniziative-forms";

function buildColumns(t: TFunction, fmt: Formati, onModifica: ((ti: TrainingInitiative) => void) | null): DataColumn<TrainingInitiative>[] {
  const colonne: DataColumn<TrainingInitiative>[] = [
    {
      header: t("training.cols.cohort"),
      cell: (ti) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{ti.cohortName ?? t("training.cohortNd")}</span>
        </div>
      ),
    },
    { header: t("training.cols.start"), cell: (ti) => <span className="text-xs text-muted-foreground">{fmt.data(ti.startDate)}</span> },
    { header: t("training.cols.end"), cell: (ti) => <span className="text-xs text-muted-foreground">{fmt.data(ti.endDate)}</span> },
    { header: t("training.cols.seats"), cell: (ti) => <span className="text-xs text-muted-foreground">{ti.capacity ?? "—"}</span> },
    // Repertorio interfacce (B5), R3: lo stato chiude la riga; il codice dell'iniziativa non va a video (R4).
    { header: t("training.cols.status"), cell: (ti) => <EnumStatusBadge domain="trainingInitiativeStatus" value={ti.status} /> },
  ];
  if (onModifica) {
    colonne.push({ header: "", cell: (ti) => (
      <Button type="button" size="sm" variant="outline" data-testid="training-edit-open" onClick={() => onModifica(ti)}>{t("training.form.modificaBreve")}</Button>
    ) });
  }
  return colonne;
}

export default function TrainingInitiativesPage() {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const puoModificare = usePuoModificareIniziative();
  const [inModifica, setInModifica] = useState<TrainingInitiative | null>(null);
  const columns = useMemo(() => buildColumns(t, fmt, puoModificare ? setInModifica : null), [t, fmt, puoModificare]);
  // C4 (#42): server-side pagination (was `?limit=200`).
  const inits = usePaginatedList<TrainingInitiative>({
    queryKey: ["training-initiatives", "list"],
    path: "/v1/training-initiatives",
  });

  return (
    <DataTablePanel<TrainingInitiative>
      pageTestId="training-page"
      titleTestId="training-title"
      countTestId="training-count"
      title={t("training.title")}
      description={t("training.description")}
      count={inits.query.data ? t("training.count", { count: inits.total }) : undefined}
      isLoading={inits.query.isLoading}
      isError={inits.query.isError}
      error={inits.query.error}
      errorMessage={t("training.errorMessage")}
      rows={inits.rows}
      server={inits.server}
      rowKey={(ti) => ti.trainingInitiativeId}
      rowTestId="training-row"
      columns={columns}
      emptyTestId="training-empty"
      emptyTitle={t("training.emptyTitle")}
      emptyDescription={t("training.emptyDescription")}
      caption={t("training.caption")}
    >
      <NuovaIniziativa />
      {inModifica && <ModificaIniziativa key={inModifica.trainingInitiativeId} iniziativa={inModifica} onChiudi={() => setInModifica(null)} />}
    </DataTablePanel>
  );
}
