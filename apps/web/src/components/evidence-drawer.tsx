"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { EvidenceItem, EvidenceListResponse } from "@heuresys/shared";
import {
  Badge, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  ErrorState, Spinner, formatDateTime,
} from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";

/**
 * EvidenceDrawer (#27) — "why this score": the raw evidence behind a subject,
 * unified over 9 domains with a lineage-provenance footer (the AI-Act
 * explainability surface). `self` uses /v1/me/evidence (I17); otherwise
 * /v1/evidence/subject/:userId (org-gated). Live-data only.
 */
function scoreLabel(v: number | null): string {
  return v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function ProvenanceFooter({ item, t }: { item: EvidenceItem; t: (k: string, o?: Record<string, unknown>) => string }) {
  const p = item.provenance;
  if (!p) return null;
  const parts: string[] = [`${t("evidence.source")}: ${p.sourceSystem}`];
  if (p.mappingConfidence != null) parts.push(`${t("evidence.confidence")} ${(p.mappingConfidence * 100).toFixed(0)}%`);
  if (p.sdbiHumanApprover) parts.push(t("evidence.humanApproved"));
  if (p.sdbiAiModelId) parts.push(`${t("evidence.aiModel")}: ${p.sdbiAiModelId}`);
  return <p className="mt-1 text-[11px] text-muted-foreground" data-testid="evidence-provenance">{parts.join(" · ")}</p>;
}

export function EvidenceDrawer({
  subjectUserId, subjectName, open, onOpenChange, self, types,
}: {
  subjectUserId?: string;
  subjectName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  self?: boolean;
  types?: string;
}) {
  const { t, i18n } = useTranslation("hr");
  const q = useQuery({
    queryKey: ["evidence", self ? "self" : subjectUserId, types ?? "all"],
    queryFn: () => {
      const qs = types ? `?types=${encodeURIComponent(types)}&limit=200` : "?limit=200";
      return apiFetch<EvidenceListResponse>(self ? `/v1/me/evidence${qs}` : `/v1/evidence/subject/${subjectUserId}${qs}`);
    },
    enabled: open && (self || Boolean(subjectUserId)),
  });

  const grouped = useMemo(() => {
    const g = new Map<string, EvidenceItem[]>();
    for (const it of q.data?.items ?? []) {
      const arr = g.get(it.kind) ?? [];
      arr.push(it);
      g.set(it.kind, arr);
    }
    return [...g.entries()];
  }, [q.data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("evidence.title")}</DialogTitle>
          <DialogDescription>{subjectName}</DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div>
        ) : q.isError ? (
          <ErrorState title={t("evidence.error")} />
        ) : grouped.length > 0 ? (
          <div className="space-y-5" data-testid="evidence-drawer">
            {grouped.map(([kind, items]) => (
              <section key={kind} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {t(`evidence.kind.${kind}`, { defaultValue: kind })}
                  <Badge variant="secondary">{items.length}</Badge>
                </h3>
                <ul className="space-y-2">
                  {items.map((it) => (
                    <li key={it.evidenceId} data-testid="evidence-item" className="rounded-card border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{it.title}</span>
                        <span className="flex items-center gap-2">
                          {it.score != null ? <span className="font-mono text-xs text-foreground">{scoreLabel(it.score)}</span> : null}
                          <span className="text-[11px] text-muted-foreground">{formatDateTime(it.recordedAt, i18n.language)}</span>
                        </span>
                      </div>
                      {it.narrative ? <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{it.narrative}</p> : null}
                      <ProvenanceFooter item={it} t={t} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="evidence-empty">{t("evidence.empty")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
