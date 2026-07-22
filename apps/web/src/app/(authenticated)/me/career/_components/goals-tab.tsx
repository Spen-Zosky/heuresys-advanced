"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MeGoalsResponse } from "@heuresys/shared";
import { Button } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { Field, ProfileSection, fmtDate } from "../../profile/_components/field";
import { GoalTimelineDialog } from "@/components/goal-timeline-dialog";
import { useEnumLabel } from "@/lib/enum-labels";

/** Obiettivi — the caller's own goals (read-only), lazy on tab open. */
export function GoalsTab() {
  const { t } = useTranslation("ess");
  const { t: tHr } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const [active, setActive] = useState<{ goalId: string; title: string } | null>(null);
  const q = useQuery({
    queryKey: ["me", "goals"],
    queryFn: () => apiFetch<MeGoalsResponse>("/v1/me/goals"),
  });

  if (q.isLoading) return <span className="text-sm text-muted-foreground">{t("common:loading")}</span>;
  if (q.isError || !q.data) return <p className="text-sm text-danger" data-testid="career-goals-error">{t("career.goals.error")}</p>;
  const items = q.data.items;
  if (items.length === 0) return <p className="text-sm text-muted-foreground" data-testid="career-goals-empty">{t("career.goals.none")}</p>;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="career-goals">
        {items.map((g, i) => (
          <ProfileSection
            key={g.goalId}
            title={g.title ?? t("career.goals.untitled")}
            testId={i === 0 ? "career-goal-primary" : undefined}
            footer={
              <Button variant="outline" size="sm" data-testid="me-goal-timeline-open"
                      onClick={() => setActive({ goalId: g.goalId, title: g.title ?? t("career.goals.untitled") })}>
                {tHr("goals.timeline.open")}
              </Button>
            }
          >
            <Field label={t("career.goals.status")} value={enumLabel("goalStatus", g.status)} testId={i === 0 ? "career-goal-status" : undefined} />
            <Field label={t("career.goals.progress")} value={g.progressPercent != null ? `${g.progressPercent}%` : null} />
            <Field label={t("career.goals.priority")} value={enumLabel("goalPriority", g.priority)} />
            <Field label={t("career.goals.weight")} value={g.weight != null ? String(g.weight) : null} />
            <Field label={t("career.goals.type")} value={g.type ? enumLabel("goalType", g.type) : g.category} />
            <Field label={t("career.goals.due")} value={fmtDate(g.dueDate)} />
          </ProfileSection>
        ))}
      </div>
      {active ? (
        <GoalTimelineDialog
          goalId={active.goalId} goalTitle={active.title} self
          open={active !== null} onOpenChange={(o) => { if (!o) setActive(null); }}
        />
      ) : null}
    </>
  );
}
