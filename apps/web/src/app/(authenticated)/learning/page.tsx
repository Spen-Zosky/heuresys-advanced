"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface LearningModule {
  learningModuleId: string;
  code: string;
  name: string;
  isGlobal: boolean;
  durationMinutes: number | null;
}

interface LearningModulesList {
  items: LearningModule[];
  total: number;
}

function buildColumns(t: TFunction): DataColumn<LearningModule>[] {
  return [
    { header: t("shared.code"), cell: (m) => <span className="font-mono text-xs">{m.code}</span> },
    { header: t("shared.name"), cell: (m) => <span className="font-medium text-foreground">{m.name}</span> },
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
  ];
}

export default function LearningCataloguePage() {
  const { t } = useTranslation("hr");
  const columns = useMemo(() => buildColumns(t), [t]);
  const modules = useQuery({
    queryKey: ["learning-modules", "list"],
    queryFn: () => apiFetch<LearningModulesList>("/v1/learning-modules?limit=200"),
  });

  return (
    <DataTablePanel<LearningModule>
      pageTestId="learning-page"
      titleTestId="learning-title"
      countTestId="learning-count"
      title={t("learning.title")}
      description={t("learning.description")}
      count={modules.data ? t("learning.count", { count: modules.data.total }) : undefined}
      isLoading={modules.isLoading}
      isError={modules.isError}
      errorMessage={t("learning.errorMessage")}
      rows={modules.data?.items ?? []}
      rowKey={(m) => m.learningModuleId}
      rowTestId="learning-row"
      columns={columns}
      emptyTestId="learning-empty"
      emptyTitle={t("learning.emptyTitle")}
      emptyDescription={t("learning.emptyDescription")}
      caption={t("learning.caption")}
    />
  );
}
