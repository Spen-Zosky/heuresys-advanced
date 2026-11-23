"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { VocabularyEquivalence } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { ApiError } from "@/lib/api/errors";
import { StatusPill, type StatusTone } from "@/components/status-pill";

// Il vocabolario comune: le equivalenze fra il termine del tenant e quello del modello. Le legge chi legge il
// consolidamento (`GET /v1/consolidation-vocabulary`); le approva o ritira solo chi ha `vocabulary:approve`
// (`POST /v1/consolidation-vocabulary/:id/status`): per chi non lo ha, il server risponde con il mandato mancante.

const VOC = "/v1/consolidation-vocabulary";
const TONO: Record<VocabularyEquivalence["status"], StatusTone> = { PROPOSTA: "warning", APPROVATA: "success", RITIRATA: "neutral" };

export function VocabolarioComune({ onErrore }: { onErrore: (messaggio: string | null) => void }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["consolidation-vocabulary"],
    queryFn: () => apiFetch<{ items: VocabularyEquivalence[] }>(VOC),
  });
  const decidi = useMutation({
    mutationFn: (v: { id: string; status: "APPROVATA" | "RITIRATA" }) =>
      apiFetch<VocabularyEquivalence>(`${VOC}/${v.id}/status`, { method: "POST", body: { status: v.status } }),
    onSuccess: () => { onErrore(null); void qc.invalidateQueries({ queryKey: ["consolidation-vocabulary"] }); },
    onError: (e) => onErrore(e instanceof ApiError ? t(`consolidationRuns.errors.${e.code}`, { defaultValue: e.message }) : t("consolidation.errors.generic")),
  });
  const righe = q.data?.items ?? [];
  if (q.isSuccess && righe.length === 0) return null;

  return (
    <Card data-testid="consolidation-vocabulary">
      <CardHeader>
        <CardTitle as="h2">{t("consolidationVocabulary.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("consolidationVocabulary.hint")}</p>
        {q.isError ? <p role="alert" className="text-sm text-destructive">{t("consolidation.loadError")}</p> : null}
        <ul className="space-y-2">
          {righe.map((v) => (
            <li key={v.equivalenceId} data-testid="consolidation-vocabulary-row"
              className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border px-3 py-2 text-sm">
              <span className="text-foreground">
                {t("consolidationVocabulary.row", { group: t(`consolidation.groups.${v.group}`), tenant: v.tenantTerm, model: v.prototypeTerm })}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <StatusPill tone={TONO[v.status]}>{t(`consolidationVocabulary.statuses.${v.status}`)}</StatusPill>
                {v.status !== "APPROVATA" ? (
                  <Button type="button" size="sm" variant="secondary" disabled={decidi.isPending}
                    onClick={() => decidi.mutate({ id: v.equivalenceId, status: "APPROVATA" })}>{t("consolidationVocabulary.approve")}</Button>
                ) : null}
                {v.status !== "RITIRATA" ? (
                  <Button type="button" size="sm" variant="outline" disabled={decidi.isPending}
                    onClick={() => decidi.mutate({ id: v.equivalenceId, status: "RITIRATA" })}>{t("consolidationVocabulary.withdraw")}</Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
