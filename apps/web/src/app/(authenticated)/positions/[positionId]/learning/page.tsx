"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
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
  // No dedicated /positions/:id/learning endpoint — compose from
  // /v1/learning-gaps?positionId= (gaps associated to the position).
  const gaps = useQuery({
    queryKey: ["learning-gaps", "by-position", positionId],
    queryFn: () =>
      apiFetch<{ items: LearningGap[]; total: number }>(
        `/v1/learning-gaps?positionId=${positionId}&limit=200`,
      ),
    enabled: !!positionId,
  });

  const items = gaps.data?.items ?? [];

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
            {gaps.data ? t("positions.learning.count", { count: gaps.data.total }) : t("common:loading")}
          </span>
        }
      />

      <Card>
        <CardHeader><CardTitle>{t("positions.learning.cardTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <EntityTable<LearningGap>
            isLoading={gaps.isLoading}
            isError={gaps.isError}
            rows={items}
            rowKey={(g) => g.learningGapId}
            rowTestId="position-learning-row"
            emptyTestId="position-learning-empty"
            emptyTitle={t("positions.learning.empty")}
            caption={t("positions.learning.caption")}
            columns={[
              { header: t("positions.learning.columns.user"), cell: (g) => <span className="font-mono text-xs">{g.userId.slice(0, 8)}</span> },
              { header: t("positions.learning.columns.skill"), cell: (g) => <span className="font-mono text-xs">{g.skillId?.slice(0, 8) ?? t("positions.learning.dash")}</span> },
              { header: t("positions.learning.columns.severity"), cell: (g) => <StatusBadge value={g.severity} /> },
              { header: t("positions.learning.columns.detected"), cell: (g) => <span className="text-xs">{g.detectedAt.slice(0, 10)}</span> },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
