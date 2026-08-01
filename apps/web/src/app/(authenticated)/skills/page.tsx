"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button, Input } from "@heuresys/ui";
import type { Skill } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { SemanticSearchPanel } from "@/components/semantic-search-panel";
import { StatusPill } from "@/components/status-pill";
import { SkillCreator, SkillEditor } from "./_components/skill-forms";

function buildColumns(t: TFunction, onEdit: (id: string) => void): DataColumn<Skill>[] {
  return [
    { header: t("shared.code"), cell: (s) => <span className="font-mono text-xs">{s.code}</span> },
    { header: t("shared.name"), cell: (s) => <span className="font-medium text-foreground">{s.name}</span> },
    {
      header: t("shared.scope"),
      cell: (s) => (
        <StatusPill tone={s.isGlobal ? "info" : "neutral"}>
          {s.isGlobal ? t("shared.global") : t("shared.tenant")}
        </StatusPill>
      ),
    },
    {
      header: t("common:actions"),
      cell: (s) => (
        <Button type="button" variant="outline" data-testid={`skill-edit-${s.code}`} onClick={() => onEdit(s.skillId)}>
          {t("skills.form.edit")}
        </Button>
      ),
    },
  ];
}

export default function SkillsCataloguePage() {
  const { t } = useTranslation("hr");
  // La competenza in lavorazione: il catalogo (~14k voci) resta l'indice, il
  // pannello di modifica si apre sopra di esso (#43).
  const [editingId, setEditingId] = useState<string | null>(null);
  // ~14.000 competenze impaginate lato server: senza un filtro testuale, una
  // voce appena creata (o una da correggere) e' irraggiungibile per modificarla.
  // Il filtro lo applica il SERVER — l'API lo offre gia' (#43).
  const [cerca, setCerca] = useState("");
  const columns = useMemo(() => buildColumns(t, setEditingId), [t]);
  // C4 (#42): server-side pagination. The catalogue holds ~14k rows — the legacy
  // `?limit=200` silently truncated it to the first page's worth.
  const skills = usePaginatedList<Skill>({
    queryKey: ["skills", "list"],
    path: "/v1/skills",
    params: { search: cerca.trim() },
  });

  return (
    <DataTablePanel<Skill>
      pageTestId="skills-page"
      titleTestId="skills-title"
      countTestId="skills-count"
      title={t("skills.title")}
      description={t("skills.description")}
      count={skills.query.data ? t("skills.count", { count: skills.total }) : undefined}
      isLoading={skills.query.isLoading}
      isError={skills.query.isError}
      errorMessage={t("skills.errorMessage")}
      rows={skills.rows}
      server={skills.server}
      rowKey={(s) => s.skillId}
      rowTestId="skills-row"
      columns={columns}
      emptyTestId="skills-empty"
      emptyTitle={t("skills.emptyTitle")}
      emptyDescription={t("skills.emptyDescription")}
      caption={t("skills.caption")}
    >
      {/* #40 (S1018): semantic catalog search — live pgvector + query-time Voyage embedding */}
      <SemanticSearchPanel />
      <div className="max-w-sm">
        <label htmlFor="skills-search" className="mb-1 block text-sm font-medium text-foreground">
          {t("skills.form.search")}
        </label>
        <Input
          id="skills-search"
          data-testid="skills-search"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder={t("skills.form.searchPlaceholder")}
        />
      </div>
      {/* #43: il catalogo si LEGGEVA soltanto; qui si crea e si corregge. */}
      <SkillCreator />
      {editingId && <SkillEditor skillId={editingId} onClose={() => setEditingId(null)} />}
    </DataTablePanel>
  );
}
