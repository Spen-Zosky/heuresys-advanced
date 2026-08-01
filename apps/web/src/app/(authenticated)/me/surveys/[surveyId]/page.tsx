"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import type { MeSurveyDetail } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

const INPUT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const isRating = (type: string) => type === "rating" || type === "nps";

export default function MeSurveyAnswerPage() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();
  const params = useParams<{ surveyId: string }>();
  const surveyId = params.surveyId;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const detail = useQuery({
    queryKey: ["me", "survey", surveyId],
    queryFn: () => apiFetch<MeSurveyDetail>(`/v1/me/surveys/${surveyId}`),
    enabled: Boolean(surveyId),
  });
  const d = detail.data;
  const completed = Boolean(d?.completedAt);

  const submit = useMutation({
    mutationFn: () => {
      const payload = {
        answers: (d?.questions ?? [])
          .filter((q) => (answers[q.questionId] ?? "").trim() !== "")
          .map((q) => {
            const v = answers[q.questionId]!.trim();
            if (isRating(q.type)) return { questionId: q.questionId, ratingValue: Number(v) };
            if (q.type === "choice") return { questionId: q.questionId, choiceValue: v };
            return { questionId: q.questionId, textValue: v };
          }),
      };
      return apiFetch(`/v1/me/surveys/${surveyId}/responses`, { method: "POST", body: payload });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me", "survey", surveyId] });
      void qc.invalidateQueries({ queryKey: ["me", "surveys"] });
      setFeedback({ kind: "ok", msg: t("surveys.submitSuccess") });
    },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("surveys.submitError") }),
  });

  const answeredCount = useMemo(() => Object.values(answers).filter((v) => v.trim() !== "").length, [answers]);
  const myAnswerFor = (questionId: string) => d?.myAnswers.find((a) => a.questionId === questionId);

  return (
    <main data-testid="me-survey-answer-page" className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div className="text-sm">
        <Link href="/me/surveys" className="text-muted-foreground hover:underline" data-testid="me-survey-back">
          ← {t("surveys.back")}
        </Link>
      </div>

      {detail.isLoading ? (
        <p className="text-sm text-muted-foreground" data-testid="me-survey-loading">{t("common:loading")}</p>
      ) : detail.isError || !d ? (
        <p className="text-sm text-danger" data-testid="me-survey-detail-error">{t("surveys.notFound")}</p>
      ) : (
        <>
          <PageHeader
            data-testid="me-survey-detail-title"
            title={d.title}
            badges={completed ? <Badge variant="outline" className="border-success text-success" data-testid="me-survey-detail-completed">{t("surveys.completed")}</Badge> : undefined}
          />

          <Card>
            <CardHeader>
              <CardTitle>{completed ? t("surveys.yourAnswers") : t("surveys.formTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                data-testid="me-survey-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setFeedback(null);
                  if (!completed && answeredCount > 0) submit.mutate();
                }}
                className="space-y-4"
                noValidate
              >
                {d.questions.map((q, i) => {
                  const mine = myAnswerFor(q.questionId);
                  const mineVal = mine ? (mine.ratingValue ?? mine.textValue ?? mine.choiceValue ?? "—") : "—";
                  return (
                    <div key={q.questionId} data-testid="me-survey-question">
                      <label htmlFor={`q-${q.questionId}`} className="mb-1 block text-sm font-medium text-foreground">
                        {i + 1}. {q.text} {q.isRequired && <span aria-hidden="true">*</span>}
                      </label>
                      {completed ? (
                        <p className="text-sm text-muted-foreground" data-testid="me-survey-my-answer">{String(mineVal)}</p>
                      ) : isRating(q.type) ? (
                        <input
                          id={`q-${q.questionId}`}
                          data-testid="me-survey-rating"
                          type="number"
                          min={0}
                          max={10}
                          className={INPUT_CLASS}
                          value={answers[q.questionId] ?? ""}
                          onChange={(e) => setAnswers((a) => ({ ...a, [q.questionId]: e.target.value }))}
                        />
                      ) : (
                        <textarea
                          id={`q-${q.questionId}`}
                          data-testid="me-survey-text"
                          rows={2}
                          className={INPUT_CLASS}
                          value={answers[q.questionId] ?? ""}
                          onChange={(e) => setAnswers((a) => ({ ...a, [q.questionId]: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}

                {!completed && (
                  <div className="flex items-center gap-3">
                    <Button type="submit" data-testid="me-survey-submit" disabled={answeredCount === 0 || submit.isPending}>
                      {submit.isPending ? t("surveys.submitting") : t("surveys.submit")}
                    </Button>
                    {feedback && (
                      <p
                        data-testid={feedback.kind === "ok" ? "me-survey-success" : "me-survey-submit-error"}
                        className={feedback.kind === "ok" ? "text-sm font-medium text-success" : "text-sm font-medium text-danger"}
                        role={feedback.kind === "err" ? "alert" : undefined}
                      >
                        {feedback.msg}
                      </p>
                    )}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
