"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

interface PositionSkillReq {
  requirementId: string;
  skillId: string;
  skillCode: string | null;
  skillName: string | null;
  requiredProficiency: string;
  weight: number;
}

export default function PositionSkillsPage() {
  const { t } = useTranslation("admin");
  const params = useParams<{ positionId: string }>();
  const positionId = params.positionId;
  const skills = useQuery({
    queryKey: ["positions", positionId, "skills"],
    queryFn: () => apiFetch<{ items: PositionSkillReq[] }>(`/v1/positions/${positionId}/skills`),
    enabled: !!positionId,
  });

  const items = skills.data?.items ?? [];

  return (
    <main data-testid="position-skills-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="position-skills-title"
        title={t("positions.skills.title")}
        breadcrumbs={
          <Link
            href={`/positions/${positionId}`}
            data-testid="position-skills-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("positions.skills.back")}
          </Link>
        }
        badges={
          <span data-testid="position-skills-count" className="text-sm text-muted-foreground">
            {skills.data ? t("positions.skills.count", { count: items.length }) : t("common:loading")}
          </span>
        }
      />

      <Card>
        <CardHeader><CardTitle>{t("positions.skills.cardTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <EntityTable<PositionSkillReq>
            isLoading={skills.isLoading}
            isError={skills.isError}
            rows={items}
            rowKey={(s) => s.requirementId}
            rowTestId="position-skill-row"
            emptyTestId="position-skills-empty"
            emptyTitle={t("positions.skills.empty")}
            caption={t("positions.skills.caption")}
            columns={[
              { header: t("positions.skills.columns.code"), cell: (s) => <span className="font-mono text-xs">{s.skillCode ?? "—"}</span> },
              { header: t("positions.skills.columns.skill"), cell: (s) => s.skillName ?? s.skillId.slice(0, 8) },
              { header: t("positions.skills.columns.proficiency"), cell: (s) => <StatusBadge value={s.requiredProficiency} /> },
              { header: t("positions.skills.columns.weight"), cell: (s) => <span className="text-xs">{s.weight}</span> },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
