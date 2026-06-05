"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface Skill {
  skillId: string;
  code: string;
  name: string;
  isGlobal: boolean;
  tenantId: string | null;
}

interface SkillsList {
  items: Skill[];
  total: number;
}

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
  const skills = useQuery({
    queryKey: ["skills", "list"],
    queryFn: () => apiFetch<SkillsList>("/v1/skills?limit=200"),
  });

  return (
    <DataTablePanel<Skill>
      pageTestId="skills-page"
      titleTestId="skills-title"
      countTestId="skills-count"
      title={t("skills.title")}
      description={t("skills.description")}
      count={skills.data ? t("skills.count", { count: skills.data.total }) : undefined}
      isLoading={skills.isLoading}
      isError={skills.isError}
      errorMessage={t("skills.errorMessage")}
      rows={skills.data?.items ?? []}
      rowKey={(s) => s.skillId}
      rowTestId="skills-row"
      columns={columns}
      emptyTestId="skills-empty"
      emptyTitle={t("skills.emptyTitle")}
      emptyDescription={t("skills.emptyDescription")}
      caption={t("skills.caption")}
    />
  );
}
