"use client";

/**
 * apps/web/src/components/timeline-panel.tsx
 * D5 (#49) — la storia della vita lavorativa di una persona.
 *
 * Lo stesso pannello serve due punti diversi: la scheda di una persona
 * (`/users/[userId]`, dati altrui, cancello organizzativo sull'API) e la
 * propria area personale (`/me`, pavimento I17). Cambia solo l'endpoint, che
 * il chiamante passa: il componente non decide di chi sia la storia.
 *
 * Componente specifico di questo prodotto (legge schemi di @heuresys/shared):
 * vive qui e compone primitive di @heuresys/ui, non ne reimplementa.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { UserTimelineEvent, UserTimelineSummaryResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useEnumLabel } from "@/lib/enum-labels";

const PAGE = 25;

export interface TimelinePanelProps {
  /** Es. `/v1/user-timeline` oppure `/v1/me/timeline`. */
  basePath: string;
  /** Filtra su una persona (solo per il percorso amministrativo). */
  userId?: string;
  testId?: string;
}

export function TimelinePanel({ basePath, userId, testId = "timeline-panel" }: TimelinePanelProps) {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const [type, setType] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    if (userId) p.set("userId", userId);
    if (type) p.set("type", type);
    for (const [k, v] of Object.entries(extra)) if (v !== undefined) p.set(k, String(v));
    return p.toString();
  };

  const summary = useQuery({
    queryKey: ["timeline", basePath, userId, "summary"],
    queryFn: () => apiFetch<UserTimelineSummaryResponse>(`${basePath}/summary?${qs({})}`),
  });

  const events = useQuery({
    queryKey: ["timeline", basePath, userId, type, limit],
    queryFn: () =>
      apiFetch<{ items: UserTimelineEvent[]; total: number }>(`${basePath}?${qs({ limit })}`),
  });

  const total = events.data?.total ?? 0;
  const shown = events.data?.items.length ?? 0;

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>{t("timeline.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.data && summary.data.total > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="timeline-range">
            {t("timeline.range", {
              count: summary.data.total,
              from: summary.data.firstEventAt?.slice(0, 10) ?? "—",
              to: summary.data.lastEventAt?.slice(0, 10) ?? "—",
            })}
          </p>
        ) : null}

        {/* Filtro per tipo: i tipi sono quelli REALMENTE presenti nella storia
            di questa persona, non l'elenco completo dei 26 ammessi. */}
        {summary.data && summary.data.items.length > 0 ? (
          <div className="flex flex-wrap gap-2" data-testid="timeline-type-filters">
            <Button
              variant={type === null ? "default" : "outline"}
              onClick={() => { setType(null); setLimit(PAGE); }}
              data-testid="timeline-filter-all"
            >
              {t("timeline.all", { count: summary.data.total })}
            </Button>
            {summary.data.items.map((i) => (
              <Button
                key={i.type}
                variant={type === i.type ? "default" : "outline"}
                onClick={() => { setType(i.type); setLimit(PAGE); }}
                data-testid="timeline-filter-type"
              >
                {enumLabel("timelineEventType", i.type)} ({i.count})
              </Button>
            ))}
          </div>
        ) : null}

        {events.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
        ) : events.isError ? (
          <p className="text-sm text-danger" data-testid="timeline-error">{t("timeline.error")}</p>
        ) : shown === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="timeline-empty">
            {t("timeline.empty")}
          </p>
        ) : (
          <ol className="space-y-3" data-testid="timeline-list">
            {events.data!.items.map((e) => (
              <li key={e.userTimelineEventId} className="flex gap-3" data-testid="timeline-item">
                {/* La data a sinistra, il fatto a destra: si legge scorrendo. */}
                <span className="w-24 shrink-0 tabular-nums text-xs text-muted-foreground">
                  {e.occurredAt.slice(0, 10)}
                </span>
                <span className="min-w-0 flex-1">
                  <Badge variant="secondary">{enumLabel("timelineEventType", e.type)}</Badge>
                  {e.summary ? (
                    <span className="ml-2 text-sm text-foreground">{e.summary}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}

        {shown < total ? (
          <Button
            variant="outline"
            data-testid="timeline-more"
            onClick={() => setLimit((l) => l + PAGE)}
            disabled={events.isFetching}
          >
            {t("timeline.more", { shown, total })}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
