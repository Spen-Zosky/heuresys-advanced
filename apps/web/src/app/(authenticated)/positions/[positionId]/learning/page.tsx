"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import type {
  PositionLearningRequirement,
  PositionLearningModule,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

interface LearningGap {
  learningGapId: string;
  userId: string;
  skillId: string | null;
  severity: string;
  detectedAt: string;
}

export default function PositionLearningPage() {
  const { t } = useTranslation("admin");
  const params = useParams<{ positionId: string }>();
  const positionId = params.positionId;

  // #25 A/L5: dedicated learning bridge endpoints (S1016)
  const requirements = useQuery({
    queryKey: ["positions", positionId, "learning-requirements"],
    queryFn: () =>
      apiFetch<{ items: PositionLearningRequirement[] }>(
        `/v1/positions/${positionId}/learning-requirements`,
      ),
    enabled: !!positionId,
  });
  const modules = useQuery({
    queryKey: ["positions", positionId, "learning-modules"],
    queryFn: () =>
      apiFetch<{ items: PositionLearningModule[] }>(
        `/v1/positions/${positionId}/learning-modules`,
      ),
    enabled: !!positionId,
  });
  const gaps = useQuery({
    queryKey: ["learning-gaps", "by-position", positionId],
    queryFn: () =>
      apiFetch<{ items: LearningGap[]; total: number }>(
        `/v1/learning-gaps?positionId=${positionId}&limit=200`,
      ),
    enabled: !!positionId,
  });

  const reqItems = requirements.data?.items ?? [];
  const moduleItems = modules.data?.items ?? [];
  const gapItems = gaps.data?.items ?? [];

  return (
    <main data-testid="position-learning-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="position-learning-title"
        title={t("positions.learning.title")}
        breadcrumbs={
          <Link
            href={`/positions/${positionId}`}
            data-testid="position-learning-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("positions.learning.back")}
          </Link>
        }
        badges={
          <span data-testid="position-learning-count" className="text-sm text-muted-foreground">
            {requirements.data
              ? t("positions.learning.count", { count: reqItems.length, modules: moduleItems.length })
              : t("common:loading")}
          </span>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("positions.learning.requirements.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <EntityTable<PositionLearningRequirement>
            isLoading={requirements.isLoading}
            isError={requirements.isError}
            rows={reqItems}
            rowKey={(r) => r.requirementId}
            rowTestId="position-learning-req-row"
            emptyTestId="position-learning-req-empty"
            emptyTitle={t("positions.learning.requirements.empty")}
            caption={t("positions.learning.requirements.caption")}
            columns={[
              {
                header: t("positions.learning.requirements.columns.path"),
                cell: (r) => (
                  <span className="text-sm">
                    {r.learningPathName ?? t("positions.learning.dash")}
                    {r.learningPathCode ? (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{r.learningPathCode}</span>
                    ) : null}
                  </span>
                ),
              },
              {
                header: t("positions.learning.requirements.columns.mandatory"),
                cell: (r) => (
                  <StatusBadge
                    value={
                      r.isMandatory
                        ? t("positions.learning.requirements.mandatoryYes")
                        : t("positions.learning.requirements.mandatoryNo")
                    }
                  />
                ),
              },
              {
                header: t("positions.learning.requirements.columns.since"),
                cell: (r) => <span className="text-xs">{r.createdAt.slice(0, 10)}</span>,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("positions.learning.modules.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <EntityTable<PositionLearningModule>
            isLoading={modules.isLoading}
            isError={modules.isError}
            rows={moduleItems}
            rowKey={(m) => `${m.skillId}-${m.learningModuleId}`}
            rowTestId="position-learning-module-row"
            emptyTestId="position-learning-module-empty"
            emptyTitle={t("positions.learning.modules.empty")}
            caption={t("positions.learning.modules.caption")}
            columns={[
              {
                header: t("positions.learning.modules.columns.skill"),
                cell: (m) => <span className="text-sm">{m.skillName ?? t("positions.learning.dash")}</span>,
              },
              {
                header: t("positions.learning.modules.columns.required"),
                cell: (m) => <StatusBadge value={m.requiredProficiency} />,
              },
              {
                header: t("positions.learning.modules.columns.module"),
                cell: (m) => <span className="text-sm">{m.learningModuleTitle ?? t("positions.learning.dash")}</span>,
              },
              {
                header: t("positions.learning.modules.columns.delivery"),
                cell: (m) => (
                  <span className="text-xs text-muted-foreground">
                    {m.learningModuleDelivery ?? t("positions.learning.dash")}
                    {m.learningModuleDurationMinutes
                      ? ` · ${t("positions.learning.modules.minutes", { count: m.learningModuleDurationMinutes })}`
                      : ""}
                  </span>
                ),
              },
              {
                header: t("positions.learning.modules.columns.target"),
                cell: (m) => <StatusBadge value={m.targetProficiency} />,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("positions.learning.gaps.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <EntityTable<LearningGap>
            isLoading={gaps.isLoading}
            isError={gaps.isError}
            rows={gapItems}
            rowKey={(g) => g.learningGapId}
            rowTestId="position-learning-row"
            emptyTestId="position-learning-empty"
            emptyTitle={t("positions.learning.gaps.empty")}
            caption={t("positions.learning.gaps.caption")}
            columns={[
              { header: t("positions.learning.gaps.columns.user"), cell: (g) => <span className="font-mono text-xs">{g.userId.slice(0, 8)}</span> },
              { header: t("positions.learning.gaps.columns.skill"), cell: (g) => <span className="font-mono text-xs">{g.skillId?.slice(0, 8) ?? t("positions.learning.dash")}</span> },
              { header: t("positions.learning.gaps.columns.severity"), cell: (g) => <StatusBadge value={g.severity} /> },
              { header: t("positions.learning.gaps.columns.detected"), cell: (g) => <span className="text-xs">{g.detectedAt.slice(0, 10)}</span> },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
