"use client";

/**
 * Candidatura: correggere i dati del candidato e una valutazione già scritta (ondata 2 degli endpoint
 * senza consumatori, 2026-11-17). `PATCH /v1/candidates/:id` e `PATCH /v1/interview-feedback/:id`
 * esistevano e nessuna pagina li chiamava: un telefono sbagliato o un voto scritto male restavano così.
 * L'assunzione (`HIRED`) chiede la persona assunta: lo impone un CHECK del database.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { Candidate, CandidateStatus, InterviewFeedback, User } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { CANDIDATE_SOURCES, FEEDBACK_RECOMMENDATIONS, KEY } from "@/lib/recruiting";
import { PersonPicker } from "@/components/person-picker";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lista locale: il web importa TIPI, non valori (stesso ordine di CANDIDATE_STATUSES).
const STATI: readonly CandidateStatus[] = ["ACTIVE", "HIRED", "WITHDRAWN", "BLACKLISTED", "ARCHIVED"];

export function DatiCandidato({ candidato, puoScrivere }: { candidato: Candidate; puoScrivere: boolean }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const [v, setV] = useState({
    phone: candidato.phone ?? "",
    source: candidato.source,
    status: candidato.status,
    consentGivenOn: candidato.consentGivenOn ?? "",
    retentionUntil: candidato.retentionUntil ?? "",
  });
  const [assunto, setAssunto] = useState<User[]>([]);
  const salva = useMutation({
    mutationFn: () => apiFetch<Candidate>(`/v1/candidates/${candidato.candidateId}`, {
      method: "PATCH",
      body: {
        phone: v.phone.trim() || null,
        source: v.source,
        status: v.status,
        consentGivenOn: v.consentGivenOn || null,
        retentionUntil: v.retentionUntil || null,
        ...(v.status === "HIRED" && assunto[0] ? { hiredUserId: assunto[0].userId } : {}),
      },
    }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY.candidates }),
  });
  if (!puoScrivere) return null;
  const serveAssunto = v.status === "HIRED" && candidato.hiredUserId === null && assunto.length === 0;
  return (
    <Card data-testid="candidate-edit">
      <CardHeader><CardTitle>{t("recruiting.correzioni.candidato")}</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">{t("recruiting.fields.phone")}</span>
          <Input data-testid="candidate-edit-phone" value={v.phone} maxLength={64} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">{t("recruiting.fields.source")}</span>
          <select data-testid="candidate-edit-source" className={SELECT_CLASS} value={v.source} onChange={(e) => setV({ ...v, source: e.target.value as Candidate["source"] })}>
            {CANDIDATE_SOURCES.map((s) => <option key={s} value={s}>{t(`recruiting.source.${s}`)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">{t("recruiting.fields.status")}</span>
          <select data-testid="candidate-edit-status" className={SELECT_CLASS} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as CandidateStatus })}>
            {STATI.map((s) => <option key={s} value={s}>{t(`recruiting.candidateStatus.${s}`)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">{t("recruiting.fields.consentGivenOn")}</span>
          <Input type="date" data-testid="candidate-edit-consent" value={v.consentGivenOn} onChange={(e) => setV({ ...v, consentGivenOn: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">{t("recruiting.fields.retentionUntil")}</span>
          <Input type="date" data-testid="candidate-edit-retention" value={v.retentionUntil} onChange={(e) => setV({ ...v, retentionUntil: e.target.value })} />
        </label>
        {v.status === "HIRED" && candidato.hiredUserId === null && (
          <div className="md:col-span-3">
            <PersonPicker label={t("recruiting.correzioni.assunto")} value={assunto} onChange={(x) => setAssunto(x.slice(-1))} testId="candidate-edit-hired" />
          </div>
        )}
        <div className="flex items-center gap-3 md:col-span-3">
          <Button type="button" data-testid="candidate-edit-save" disabled={serveAssunto || salva.isPending} onClick={() => salva.mutate()}>
            {salva.isPending ? t("common:saving") : t("recruiting.correzioni.salva")}
          </Button>
          {salva.isSuccess && <span className="text-sm text-success">{t("recruiting.correzioni.salvato")}</span>}
          {salva.isError && <span data-testid="candidate-edit-error" className="text-sm text-danger">{t("recruiting.correzioni.errore")}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function CorreggiValutazione({ valutazione, interviewId }: { valutazione: InterviewFeedback; interviewId: string }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const [aperto, setAperto] = useState(false);
  const [v, setV] = useState({
    recommendation: valutazione.recommendation as string,
    score: valutazione.score === null ? "" : String(valutazione.score),
    notes: valutazione.notes ?? "",
  });
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/interview-feedback/${valutazione.feedbackId}`, {
      method: "PATCH",
      body: { recommendation: v.recommendation, score: v.score ? Number(v.score) : null, notes: v.notes.trim() || null },
    }),
    onSuccess: () => { setAperto(false); void qc.invalidateQueries({ queryKey: KEY.feedback(interviewId) }); },
  });
  if (!aperto) {
    return (
      <Button type="button" size="sm" variant="outline" data-testid="feedback-edit-open" onClick={() => setAperto(true)}>
        {t("recruiting.correzioni.correggi")}
      </Button>
    );
  }
  return (
    <span className="mt-2 grid gap-2 md:grid-cols-4" data-testid="feedback-edit">
      <select aria-label={t("recruiting.correzioni.raccomandazione")} data-testid="feedback-edit-recommendation" className={SELECT_CLASS} value={v.recommendation}
        onChange={(e) => setV({ ...v, recommendation: e.target.value })}>
        {FEEDBACK_RECOMMENDATIONS.map((r) => <option key={r} value={r}>{t(`recruiting.recommendation.${r}`)}</option>)}
      </select>
      <Input aria-label={t("recruiting.correzioni.voto")} type="number" min={0} max={10} step={0.5} data-testid="feedback-edit-score" value={v.score}
        onChange={(e) => setV({ ...v, score: e.target.value })} />
      <Input aria-label={t("recruiting.fields.notes")} data-testid="feedback-edit-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      <span className="flex gap-2">
        <Button type="button" size="sm" data-testid="feedback-edit-save" disabled={salva.isPending} onClick={() => salva.mutate()}>
          {salva.isPending ? t("common:saving") : t("recruiting.correzioni.salva")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setAperto(false)}>{t("recruiting.correzioni.annulla")}</Button>
      </span>
      {salva.isError && <span className="text-xs text-danger md:col-span-4">{t("recruiting.correzioni.errore")}</span>}
    </span>
  );
}
