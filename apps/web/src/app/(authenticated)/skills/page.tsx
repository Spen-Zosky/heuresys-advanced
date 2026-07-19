"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { Skill } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { SemanticSearchPanel } from "@/components/semantic-search-panel";
import { StatusPill } from "@/components/status-pill";

function buildColumns(t: TFunction): DataColumn<Skill>[] {
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
  ];
}

export default function SkillsCataloguePage() {
  const { t } = useTranslation("hr");
  const columns = useMemo(() => buildColumns(t), [t]);
  // C4 (#42): server-side pagination. The catalogue holds ~14k rows — the legacy
  // `?limit=200` silently truncated it to the first page's worth.
  const skills = usePaginatedList<Skill>({ queryKey: ["skills", "list"], path: "/v1/skills" });

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
    </DataTablePanel>
  );
}
