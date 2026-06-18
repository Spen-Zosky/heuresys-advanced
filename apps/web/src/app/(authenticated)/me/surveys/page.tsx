"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, EmptyState, PageHeader } from "@heuresys/ui";
import { ClipboardList } from "lucide-react";
import type { MeSurveysResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

export default function MeSurveysPage() {
  const { t } = useTranslation("ess");
  const surveys = useQuery({
    queryKey: ["me", "surveys"],
    queryFn: () => apiFetch<MeSurveysResponse>("/v1/me/surveys"),
  });

  const items = surveys.data?.items ?? [];

  return (
    <main data-testid="me-surveys-page" className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="me-surveys-title"
        title={t("surveys.title")}
        description={t("surveys.description")}
        badges={
          <Badge variant="secondary" data-testid="me-surveys-count">
            {surveys.data ? t("surveys.count", { count: surveys.data.total }) : t("common:loading")}
          </Badge>
        }
      />

      {surveys.isLoading ? (
        <p className="text-sm text-muted-foreground" data-testid="me-surveys-loading">{t("common:loading")}</p>
      ) : surveys.isError ? (
        <p className="text-sm text-danger" data-testid="me-surveys-error">{t("surveys.error")}</p>
      ) : items.length === 0 ? (
        <EmptyState
          data-testid="me-surveys-empty"
          icon={<ClipboardList className="h-6 w-6" />}
          title={t("surveys.emptyTitle")}
          description={t("surveys.emptyDesc")}
        />
      ) : (
        <Card data-testid="me-surveys-list">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {items.map((s) => (
                <li key={s.surveyId} data-testid="me-survey-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{t("surveys.questionCount", { count: s.questionCount })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.completedAt ? (
                      <Badge variant="success" data-testid="me-survey-completed">{t("surveys.completed")}</Badge>
                    ) : (
                      <Badge variant="secondary" data-testid="me-survey-pending">{t("surveys.pending")}</Badge>
                    )}
                    <Link href={`/me/surveys/${s.surveyId}`}>
                      <Button size="sm" variant={s.completedAt ? "outline" : "default"} data-testid="me-survey-open">
                        {s.completedAt ? t("surveys.review") : t("surveys.answer")}
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
