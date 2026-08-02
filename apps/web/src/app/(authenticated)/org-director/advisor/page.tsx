"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, PageHeader } from "@heuresys/ui";
import type { AdvisorSuggestionsResponse, AdvisorSuggestion, AdvisorCitation } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

// #58 F4 — advisor prescrittivo. Tutto viene da GET /v1/advisor/suggestions, derivato dalle
// scorecard F1/F2/F3 da un motore a REGOLE: nessun modello linguistico, nessun dato finto,
// empty-state reale quando nessuna regola trova casi.
//
// Le FONTI sono rese in pagina, non nascoste dietro un'icona: sono ciò che distingue questa
// pagina da un generatore di frasi plausibili. Un consiglio che si legge senza poterne
// verificare l'origine vale quanto un'opinione.

const PRIORITY_TONE = (p: number): "danger" | "warning" | "info" =>
  p >= 75 ? "danger" : p >= 50 ? "warning" : "info";

function Citation({ c, t }: { c: AdvisorCitation; t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <li data-testid="advisor-citation" className="flex flex-wrap items-baseline gap-x-1.5 leading-tight">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t(`advisor.sources.${c.source}`)}
      </span>
      <span className="text-xs text-foreground">{c.subjectLabel}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{c.field}</span>
      <span className="font-mono text-[10px] font-semibold tabular-nums text-foreground">= {String(c.value)}</span>
    </li>
  );
}

function buildColumns(t: ReturnType<typeof useTranslation>["t"]): DataColumn<AdvisorSuggestion>[] {
  return [
    {
      header: t("advisor.cols.priority"),
      align: "right",
      cell: (r) => (
        <span data-testid={`advisor-priority-${r.ruleId}`}>
          <StatusPill tone={PRIORITY_TONE(r.priority)}>{Math.round(r.priority)}</StatusPill>
        </span>
      ),
    },
    {
      header: t("advisor.cols.rule"),
      cell: (r) => (
        <span className="flex flex-col leading-tight" data-testid={`advisor-rule-${r.ruleId}`}>
          <span className="text-xs font-medium text-foreground">{t(`advisor.rules.${r.ruleId}`)}</span>
          <span className="text-[10px] text-muted-foreground">{t(`advisor.subjectTypes.${r.subjectType}`)}</span>
        </span>
      ),
    },
    {
      header: t("advisor.cols.subject"),
      cell: (r) => <span className="text-sm font-medium text-foreground">{r.subjectLabel}</span>,
    },
    {
      header: t("advisor.cols.action"),
      cell: (r) => (
        <span data-testid="advisor-headline" className="block max-w-xl text-sm text-foreground">
          {t(`advisor.rule.${r.headlineKey.replace("advisor.rule.", "")}`, r.headlineParams)}
        </span>
      ),
    },
    {
      header: t("advisor.cols.citations"),
      cell: (r) => (
        <ul data-testid="advisor-citations" className="space-y-0.5">
          {r.citations.map((c, i) => (
            <Citation key={`${c.source}-${c.field}-${i}`} c={c} t={t} />
          ))}
        </ul>
      ),
    },
  ];
}

export default function AdvisorPage() {
  const { t } = useTranslation("hr");

  const advisor = useQuery({
    queryKey: ["advisor-suggestions"],
    queryFn: () => apiFetch<AdvisorSuggestionsResponse>("/v1/advisor/suggestions"),
  });

  const columns = useMemo(() => buildColumns(t), [t]);
  const data = advisor.data;

  return (
    <main data-testid="advisor-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="advisor-title"
        title={t("advisor.title")}
        description={t("advisor.description")}
        badges={
          data ? (
            <Badge variant="secondary" data-testid="advisor-count">
              {t("advisor.count", { count: data.total })}
            </Badge>
          ) : undefined
        }
      />

      <EntityTable<AdvisorSuggestion>
        isLoading={advisor.isLoading}
        isError={advisor.isError}
        errorMessage={t("advisor.errorMessage")}
        rows={data?.items ?? []}
        rowKey={(r) => `${r.ruleId}-${r.subjectId}`}
        rowTestId="advisor-row"
        columns={columns}
        emptyTestId="advisor-empty"
        emptyTitle={t("advisor.emptyTitle")}
        emptyDescription={t("advisor.emptyDescription")}
        caption={t("advisor.caption")}
      />

      <p data-testid="advisor-method" className="text-xs text-muted-foreground">
        {data
          ? t("advisor.method", {
              count: data.total,
              rules: data.rulesEvaluated.length,
              discarded: data.discarded,
              model: data.modelVersion,
            })
          : t("advisor.methodIdle")}
      </p>
    </main>
  );
}
