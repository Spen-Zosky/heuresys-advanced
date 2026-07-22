"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { GoalComment, GoalTimelineEvent, GoalTimelineResponse } from "@heuresys/shared";
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Spinner,
  Timeline,
  type TimelineEvent,
  formatDateTime,
} from "@heuresys/ui";
import { Lock } from "lucide-react";
import { apiFetch } from "@/lib/api/fetch";
import { useEnumLabel, type EnumLabelFn } from "@/lib/enum-labels";

/**
 * GoalTimelineDialog (#26) — merged activity timeline (updates ∪ check-ins ∪
 * milestones) of ONE goal, plus its comment thread on the admin surface.
 * Live-data doctrine: everything comes from /v1/goals/* (admin) or /v1/me/goals/*
 * (self-scope); the only empty branch is the API's real empty list.
 */
interface GoalCommentList {
  items: GoalComment[];
  total: number;
}

function toneForCheckIn(status: string | null): TimelineEvent["tone"] {
  if (status === "ON_TRACK" || status === "AHEAD") return "success";
  if (status === "AT_RISK") return "warning";
  if (status === "BLOCKED") return "destructive";
  return "muted";
}

function toneForMilestone(status: string): TimelineEvent["tone"] {
  if (status === "COMPLETED") return "success";
  if (status === "MISSED" || status === "CANCELLED") return "destructive";
  return "muted";
}

function toTimelineEvents(events: GoalTimelineEvent[], t: TFunction, locale: string, enumLabel: EnumLabelFn): TimelineEvent[] {
  return events.map((e) => {
    const time = formatDateTime(e.at, locale);
    if (e.kind === "UPDATE") {
      const u = e.update;
      const delta =
        u.previousProgress != null || u.newProgress != null
          ? ` · ${t("goals.timeline.progress")}: ${u.previousProgress ?? "—"}% → ${u.newProgress ?? "—"}%`
          : "";
      return {
        id: u.updateId,
        time,
        title: `${t("goals.timeline.update")} · ${enumLabel("goalUpdateType", u.type)}${delta}`,
        description: u.content ?? undefined,
        tone: "primary",
      };
    }
    if (e.kind === "CHECK_IN") {
      const c = e.checkIn;
      const description = [
        c.notes,
        c.confidenceLevel != null ? `${t("goals.timeline.confidence")}: ${c.confidenceLevel}` : null,
      ]
        .filter(Boolean)
        .join(" — ");
      return {
        id: c.checkInId,
        time,
        title: `${t("goals.timeline.checkIn")}${c.statusUpdate ? ` · ${enumLabel("goalCheckInStatus", c.statusUpdate)}` : ""} · ${c.newProgress}%`,
        description: description || undefined,
        tone: toneForCheckIn(c.statusUpdate),
      };
    }
    const m = e.milestone;
    return {
      id: m.milestoneId,
      time,
      title: `${t("goals.timeline.milestone")} · ${m.title} · ${enumLabel("goalMilestoneStatus", m.status)}`,
      description: m.targetDate ? `${t("goals.timeline.target")}: ${m.targetDate}` : undefined,
      tone: toneForMilestone(m.status),
    };
  });
}

export function GoalTimelineDialog({
  goalId,
  goalTitle,
  open,
  onOpenChange,
  self,
}: {
  goalId: string;
  goalTitle: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  self?: boolean;
}) {
  const { t, i18n } = useTranslation("hr");
  const enumLabel = useEnumLabel();

  const timeline = useQuery({
    queryKey: ["goal-timeline", goalId, self ? "self" : "admin"],
    queryFn: () =>
      apiFetch<GoalTimelineResponse>(self ? `/v1/me/goals/${goalId}/timeline` : `/v1/goals/${goalId}/timeline`),
    enabled: open,
  });

  const comments = useQuery({
    queryKey: ["goal-comments", goalId],
    queryFn: () => apiFetch<GoalCommentList>(`/v1/goals/${goalId}/comments?limit=50`),
    enabled: open && !self,
  });

  const events = useMemo(
    () => (timeline.data ? toTimelineEvents(timeline.data.events, t, i18n.language, enumLabel) : []),
    [timeline.data, t, i18n.language, enumLabel],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("goals.timeline.title")}</DialogTitle>
          <DialogDescription>{goalTitle}</DialogDescription>
        </DialogHeader>

        {timeline.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : timeline.isError ? (
          <ErrorState title={t("goals.timeline.error")} />
        ) : (
          <div data-testid="goal-timeline">
            <Timeline events={events} emptyMessage={t("goals.timeline.empty")} />
          </div>
        )}

        {!self ? (
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">{t("goals.timeline.comments")}</h3>
            {comments.isLoading ? (
              <div className="flex justify-center py-4">
                <Spinner className="h-5 w-5" />
              </div>
            ) : comments.isError ? (
              <ErrorState title={t("goals.timeline.error")} />
            ) : comments.data && comments.data.items.length > 0 ? (
              <ul className="space-y-3">
                {comments.data.items.map((c) => (
                  <li
                    key={c.commentId}
                    data-testid="goal-comment-item"
                    className="rounded-card border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt, i18n.language)}</span>
                      {c.isPrivate ? (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          {t("goals.timeline.private")}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">{c.content}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="goal-comments-empty">
                {t("goals.timeline.commentsEmpty")}
              </p>
            )}
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
