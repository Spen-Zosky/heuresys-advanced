"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import type { EngagementSurveyResultsResponse, EngagementQuestionResult } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { EChartsCard } from "../../_charts-client";

/** Bar of avgRating per rated question (rating/nps only). */
function ratingsBarOption(questions: EngagementQuestionResult[], label: string) {
  const rated = questions.filter((q) => q.avgRating != null);
  return {
    tooltip: { trigger: "axis" as const },
    grid: { left: 40, right: 20, top: 30, bottom: 80 },
    xAxis: { type: "category" as const, data: rated.map((q) => q.text.slice(0, 24)), axisLabel: { interval: 0, rotate: 35, fontSize: 10 } },
    yAxis: { type: "value" as const, name: label, max: 10 },
    series: [{ type: "bar" as const, data: rated.map((q) => q.avgRating) }],
  };
}

export default function EngagementResultsPage() {
  const { t } = useTranslation("admin");
  const params = useParams<{ surveyId: string }>();
  const surveyId = params.surveyId;

  const results = useQuery({
    queryKey: ["engagement", "results", surveyId],
    queryFn: () => apiFetch<EngagementSurveyResultsResponse>(`/v1/engagement/surveys/${surveyId}/results`),
    enabled: Boolean(surveyId),
  });

  const columns: DataColumn<EngagementQuestionResult>[] = useMemo(
    () => [
      { header: t("engagement.results.question"), cell: (q) => <span className="font-medium text-foreground">{q.text}</span> },
      { header: t("engagement.results.type"), cell: (q) => <span className="text-muted-foreground">{q.type}</span> },
      { header: t("engagement.results.category"), cell: (q) => <span className="text-muted-foreground">{q.category ?? "—"}</span> },
      { header: t("engagement.results.responses"), cell: (q) => <span className="text-muted-foreground">{q.responseCount}</span> },
      { header: t("engagement.results.avg"), cell: (q) => <span className="text-muted-foreground">{q.avgRating != null ? q.avgRating.toFixed(2) : "—"}</span> },
    ],
    [t],
  );

  const d = results.data;
  const hasRated = (d?.questions ?? []).some((q) => q.avgRating != null);

  return (
    <main data-testid="engagement-results-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="text-sm">
        <Link href="/engagement" className="text-muted-foreground hover:underline" data-testid="engagement-results-back">
          ← {t("engagement.results.back")}
        </Link>
      </div>

      {results.isLoading ? (
        <p className="text-sm text-muted-foreground" data-testid="engagement-results-loading">{t("common:loading")}</p>
      ) : results.isError || !d ? (
        <p className="text-sm text-danger" data-testid="engagement-results-error">{t("engagement.results.notFound")}</p>
      ) : (
        <>
          <PageHeader data-testid="engagement-results-title" title={d.title} description={t("engagement.results.subtitle", { count: d.questions.length })} />

          <div data-testid="engagement-results-table">
            <EntityTable<EngagementQuestionResult>
              isLoading={false}
              isError={false}
              errorMessage={t("engagement.errorMessage")}
              rows={d.questions}
              rowKey={(q) => q.questionId}
              rowTestId="engagement-question-row"
              columns={columns}
              emptyTestId="engagement-results-empty"
              emptyTitle={t("engagement.results.emptyTitle")}
              emptyDescription={t("engagement.results.emptyDescription")}
              caption={t("engagement.results.caption")}
            />
          </div>

          {hasRated && (
            <Card data-testid="engagement-results-chart">
              <CardHeader>
                <CardTitle>{t("engagement.results.chartTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <EChartsCard option={ratingsBarOption(d.questions, t("engagement.results.avg"))} height={360} ariaLabel={t("engagement.results.chartTitle")} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
