"use client";

import { useTranslation } from "react-i18next";
import type { OkrCheckIn } from "@heuresys/shared";
import {
  Badge, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  ErrorState, Spinner, formatDateTime,
} from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { useQuery } from "@tanstack/react-query";

/**
 * OkrCheckInsDialog (#26) — check-in history of ONE OKR, read-only over
 * /v1/okrs/:id/check-ins. Live-data doctrine; empty branch = real empty list.
 */
interface OkrCheckInList { items: OkrCheckIn[]; total: number }

export function OkrCheckInsDialog({
  okrId, okrTitle, open, onOpenChange,
}: {
  okrId: string; okrTitle: string; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const { t, i18n } = useTranslation("hr");
  const q = useQuery({
    queryKey: ["okr-checkins", okrId],
    queryFn: () => apiFetch<OkrCheckInList>(`/v1/okrs/${okrId}/check-ins?limit=200`),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("okrs.checkIns.title")}</DialogTitle>
          <DialogDescription>{okrTitle}</DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div>
        ) : q.isError ? (
          <ErrorState title={t("okrs.checkIns.error")} />
        ) : q.data && q.data.items.length > 0 ? (
          <ul className="space-y-3" data-testid="okr-checkins">
            {q.data.items.map((c) => {
              const progress = c.overallProgress ?? c.newProgress;
              return (
                <li key={c.checkInId} data-testid="okr-checkin-item"
                    className="rounded-card border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt, i18n.language)}</span>
                    <Badge variant="secondary">
                      {c.scope === "OKR_AGGREGATE" ? t("okrs.checkIns.scopeAggregate") : t("okrs.checkIns.scopeKeyResult")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    {t(c.scope === "OKR_AGGREGATE" ? "okrs.checkIns.overall" : "okrs.checkIns.progress")}:{" "}
                    {progress != null ? `${progress}%` : "—"}
                    {c.statusUpdate ? ` · ${c.statusUpdate}` : ""}
                  </p>
                  {c.notes ? <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{c.notes}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="okr-checkins-empty">{t("okrs.checkIns.empty")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
