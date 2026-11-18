"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import type { EngagementSurveyResultsResponse, EngagementQuestionResult } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { StatoCaricamento, StatoErrore } from "@/components/stato-pagina";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { useEnumLabel } from "@/lib/enum-labels";
import { EChartsCard } from "../../_charts-client";
import { useFormat } from "@/lib/format";

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
  const fmt = useFormat();
  const enumLabel = useEnumLabel();
  const params = useParams<{ surveyId: string }>();
  const surveyId = params.surveyId;

  const results = useQuery({
    queryKey: ["engagement", "results", surveyId],
    queryFn: () => apiFetch<EngagementSurveyResultsResponse>(`/v1/engagement/surveys/${surveyId}/results`),
    enabled: Boolean(surveyId),
  });

  const d = results.data;
  const hasRated = (d?.questions ?? []).some((q) => q.avgRating != null);

  // C15 (giro qa-web 18/11): una colonna che ha lo stesso valore su tutte le righe non dice niente
  // (Tipo sempre «Valutazione», Risposte sempre 100): si toglie, e il valore comune va nel sottotitolo.
  // La media porta la sua scala nell'intestazione.
  const domande = d?.questions ?? [];
  const costante = <K,>(f: (q: EngagementQuestionResult) => K) => domande.length > 1 && domande.every((q) => f(q) === f(domande[0]!));
  const tipoCostante = costante((q) => q.type);
  const categoriaCostante = costante((q) => q.category);
  const risposteCostanti = costante((q) => q.responseCount);
  const columns: DataColumn<EngagementQuestionResult>[] = [
    { header: t("engagement.results.question"), cell: (q) => <span className="font-medium text-foreground">{q.text}</span> },
    ...(tipoCostante ? [] : [{ header: t("engagement.results.type"), cell: (q: EngagementQuestionResult) => <span className="text-muted-foreground">{enumLabel("questionType", q.type)}</span> }]),
    ...(categoriaCostante ? [] : [{ header: t("engagement.results.category"), cell: (q: EngagementQuestionResult) => <span className="text-muted-foreground">{enumLabel("surveyCategory", q.category)}</span> }]),
    ...(risposteCostanti ? [] : [{ header: t("engagement.results.responses"), cell: (q: EngagementQuestionResult) => <span className="text-muted-foreground">{q.responseCount}</span> }]),
    { header: t("engagement.results.avgScale"), cell: (q) => <span className="text-muted-foreground">{q.avgRating != null ? fmt.numeroFisso(q.avgRating, 2) : "—"}</span> },
  ];
  const sottotitolo = [
    t("engagement.results.subtitle", { count: domande.length }),
    ...(tipoCostante && domande[0] ? [t("engagement.results.allOfType", { tipo: enumLabel("questionType", domande[0].type) })] : []),
    ...(risposteCostanti && domande[0] ? [t("engagement.results.eachResponses", { n: domande[0].responseCount })] : []),
  ].join(" · ");

  return (
    <main data-testid="engagement-results-page" className="mx-auto max-w-5xl space-y-6 px-6 pb-8">
      <div className="text-sm">
        <Link href="/engagement" className="text-muted-foreground hover:underline" data-testid="engagement-results-back">
          ← {t("engagement.results.back")}
        </Link>
      </div>

      {results.isLoading ? (
        <StatoCaricamento testId="engagement-results-loading" />
      ) : results.isError || !d ? (
        <StatoErrore
          errore={results.error}
          titolo={t("engagement.results.notFound")}
          testId="engagement-results-error"
          onRiprova={() => void results.refetch()}
        />
      ) : (
        <>
          <PageHeader data-testid="engagement-results-title" title={d.title} description={sottotitolo} />

          <div data-testid="engagement-results-table">
            <EntityTable<EngagementQuestionResult> originPath={"/v1/engagement/surveys"}
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
                <CardTitle as="h2">{t("engagement.results.chartTitle")}</CardTitle>
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
