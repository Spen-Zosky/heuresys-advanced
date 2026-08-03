"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button, Input } from "@heuresys/ui";
import type { LearningModule } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { LearningModuleCreator, LearningModuleEditor } from "./_components/learning-forms";
import { LearningPathsPanel } from "./_components/learning-paths";

function buildColumns(t: TFunction, onEdit: (id: string) => void): DataColumn<LearningModule>[] {
  return [
    { header: t("shared.code"), cell: (m) => <span className="font-mono text-xs">{m.code}</span> },
    { header: t("shared.name"), cell: (m) => <span className="font-medium text-foreground">{m.title}</span> },
    {
      header: t("learning.cols.duration"),
      cell: (m) => <span className="text-xs text-muted-foreground">{m.durationMinutes ?? "—"}</span>,
    },
    {
      header: t("shared.scope"),
      cell: (m) => (
        <StatusPill tone={m.isGlobal ? "info" : "neutral"}>
          {m.isGlobal ? t("shared.global") : t("shared.tenant")}
        </StatusPill>
      ),
    },
    {
      header: t("common:table.actions"),
      cell: (m) => (
        <Button type="button" variant="outline" data-testid={`learning-edit-${m.code}`} onClick={() => onEdit(m.learningModuleId)}>
          {t("learning.form.edit")}
        </Button>
      ),
    },
  ];
}

export default function LearningCataloguePage() {
  const { t } = useTranslation("hr");
  // Il modulo in lavorazione + il filtro testuale: senza cercare, un corso
  // appena inserito finisce oltre la prima pagina e non si puo' correggere (#43).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cerca, setCerca] = useState("");
  const columns = useMemo(() => buildColumns(t, setEditingId), [t]);
  // C4 (#42): server-side pagination (was `?limit=200`).
  const modules = usePaginatedList<LearningModule>({
    queryKey: ["learning-modules", "list"],
    path: "/v1/learning-modules",
    params: { search: cerca.trim() },
  });

  return (
    <DataTablePanel<LearningModule>
      pageTestId="learning-page"
      titleTestId="learning-title"
      countTestId="learning-count"
      title={t("learning.title")}
      description={t("learning.description")}
      count={modules.query.data ? t("learning.count", { count: modules.total }) : undefined}
      isLoading={modules.query.isLoading}
      isError={modules.query.isError}
      errorMessage={t("learning.errorMessage")}
      rows={modules.rows}
      server={modules.server}
      rowKey={(m) => m.learningModuleId}
      rowTestId="learning-row"
      columns={columns}
      emptyTestId="learning-empty"
      emptyTitle={t("learning.emptyTitle")}
      emptyDescription={t("learning.emptyDescription")}
      caption={t("learning.caption")}
    >
      <div className="max-w-sm">
        <label htmlFor="learning-search" className="mb-1 block text-sm font-medium text-foreground">
          {t("learning.form.search")}
        </label>
        <Input
          id="learning-search"
          data-testid="learning-search"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder={t("learning.form.searchPlaceholder")}
        />
      </div>
      {/* #43: il catalogo si LEGGEVA soltanto; qui si inserisce e si corregge. */}
      <LearningModuleCreator />
      {editingId && <LearningModuleEditor moduleId={editingId} onClose={() => setEditingId(null)} />}
      {/* I percorsi compongono i moduli in una sequenza che porta a un
          risultato: stanno sotto il catalogo che li alimenta (#43). */}
      <LearningPathsPanel />
    </DataTablePanel>
  );
}
