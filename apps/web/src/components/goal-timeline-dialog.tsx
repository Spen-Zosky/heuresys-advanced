"use client";

import { MODALE } from "@/lib/modale";
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
  type TimelineEvent,
  formatDateTime,
} from "@heuresys/ui";
import { Lock } from "lucide-react";
import { apiFetch } from "@/lib/api/fetch";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { useEnumLabel, type EnumLabelFn } from "@/lib/enum-labels";
import { formati } from "@/lib/format";

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
    // `time` resta l ISO: la data si scrive nella lingua della persona al momento del disegno (vedi LineaDelTempo)
    const time = e.at;
    if (e.kind === "UPDATE") {
      const u = e.update;
      const delta =
        u.previousProgress != null || u.newProgress != null
          ? ` · ${t("goals.timeline.progress")}: ${formati(locale).percento(u.previousProgress, "0-100")} → ${formati(locale).percento(u.newProgress, "0-100")}`
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
        title: `${t("goals.timeline.checkIn")}${c.statusUpdate ? ` · ${enumLabel("goalCheckInStatus", c.statusUpdate)}` : ""} · ${formati(locale).percento(c.newProgress, "0-100")}`,
        description: description || undefined,
        tone: toneForCheckIn(c.statusUpdate),
      };
    }
    const m = e.milestone;
    return {
      id: m.milestoneId,
      time,
      title: `${t("goals.timeline.milestone")} · ${m.title} · ${enumLabel("goalMilestoneStatus", m.status)}`,
      description: m.targetDate ? `${t("goals.timeline.target")}: ${formati(locale).data(m.targetDate)}` : undefined,
      tone: toneForMilestone(m.status),
    };
  });
}

const TONO: Record<NonNullable<TimelineEvent["tone"]>, string> = {
  primary: "bg-primary text-primary-fg",
  success: "bg-success text-success-fg",
  warning: "bg-warning text-warning-fg",
  destructive: "bg-destructive text-destructive-fg",
  muted: "bg-muted text-muted-fg",
};

/**
 * Giro 18/11 (G-RENDER): la `Timeline` di @heuresys/ui rilegge `time` con `new Date(...)` e lo scrive
 * nella lingua del browser; passandole una data gia' scritta mostrava «Invalid Date». Qui `time` e' l'ISO
 * e la data si scrive con la lingua della persona. (Difetto di @heuresys/ui da segnalare al repo ux-design-shared.)
 */
function LineaDelTempo({ events, vuoto, locale }: { events: TimelineEvent[]; vuoto: string; locale: string }) {
  if (events.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">{vuoto}</p>;
  return (
    <ol className="relative ml-4 border-l border-border">
      {events.map((e) => (
        <li key={e.id} className="relative pb-6 pl-6">
          <span aria-hidden="true" className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background ${TONO[e.tone ?? "primary"]}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          <time dateTime={e.time} className="text-xs text-muted-foreground">{formatDateTime(e.time, locale)}</time>
          <h4 className="text-sm font-medium">{e.title}</h4>
          {e.description ? <p className="text-xs text-muted-foreground">{e.description}</p> : null}
        </li>
      ))}
    </ol>
  );
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
      <DialogContent className={MODALE.media} closeLabel={t("shell:ui.close")}>
        <DialogHeader>
          <DialogTitle>{t("goals.timeline.title")}</DialogTitle>
          <DialogDescription>{goalTitle}</DialogDescription>
        </DialogHeader>

        {timeline.isLoading ? (
          <StatoCaricamento />
        ) : timeline.isError ? (
          <StatoErrore errore={timeline.error} titolo={t("goals.timeline.error")} testId="goal-timeline-error" onRiprova={() => void timeline.refetch()} />
        ) : (
          <div data-testid="goal-timeline">
            <LineaDelTempo events={events} vuoto={t("goals.timeline.empty")} locale={i18n.language} />
          </div>
        )}

        {!self ? (
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">{t("goals.timeline.comments")}</h3>
            {comments.isLoading ? (
              <StatoCaricamento />
            ) : comments.isError ? (
              <StatoErrore errore={comments.error} titolo={t("goals.timeline.error")} testId="goal-comments-error" onRiprova={() => void comments.refetch()} />
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
              <StatoVuoto compatto titolo={t("goals.timeline.commentsEmpty")} testId="goal-comments-empty" />
            )}
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
