"use client";

/**
 * /assessments — le valutazioni delle persone (del responsabile, a 360°, tra pari, di sé, esterne) e
 * i loro risultati per dimensione (ondata 3 degli endpoint senza consumatori, 2026-11-17).
 * `POST/PATCH /v1/assessments` e `POST /v1/assessment-results` esistevano senza pagina: si entra
 * dalla scheda «Valutazioni delle persone» accanto a /performance. Il punteggio composto viaggia nei
 * metadati e arriva MASCHERATO a chi non ha il perimetro (#124): qui non si mostra, si mostrano stato,
 * soggetto e periodo (I20).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { User } from "@heuresys/shared";
import { PageHeader } from "@/components/intestazione-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";
import { cognomeNome } from "@/lib/person-label";
import { PersonPicker } from "@/components/person-picker";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TIPI = ["MANAGER", "THREE_SIXTY", "PEER", "SELF", "EXTERNAL"] as const;
const STATI = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

interface Valutazione { assessmentId: string; subjectUserId: string; kind: string; periodStart: string | null; periodEnd: string | null; status: string }
interface Risultato { assessmentResultId: string; dimension: string; score: number | null; narrative: string | null; recordedAt: string }

function Persona({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["users", id], queryFn: () => apiFetch<User>(`/v1/users/${id}`), staleTime: 300_000 });
  return <span className="font-medium">{q.data ? cognomeNome(q.data) : "…"}</span>;
}

function Risultati({ valutazione, puoScrivere }: { valutazione: Valutazione; puoScrivere: boolean }) {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const qc = useQueryClient();
  const chiave = ["assessment-results", valutazione.assessmentId];
  const [nuovo, setNuovo] = useState({ dimension: "", score: "", narrative: "" });
  const risultati = useQuery({
    queryKey: chiave,
    queryFn: () => apiFetch<{ items: Risultato[] }>(`/v1/assessment-results?assessmentId=${valutazione.assessmentId}&limit=200`),
  });
  const registra = useMutation({
    mutationFn: () => apiFetch("/v1/assessment-results", {
      method: "POST",
      body: { assessmentId: valutazione.assessmentId, dimension: nuovo.dimension.trim(), score: nuovo.score === "" ? null : Number(nuovo.score), narrative: nuovo.narrative.trim() || null },
    }),
    onSuccess: () => { setNuovo({ dimension: "", score: "", narrative: "" }); void qc.invalidateQueries({ queryKey: chiave }); },
  });
  const punteggioValido = nuovo.score === "" || (Number(nuovo.score) >= 0 && Number(nuovo.score) <= 100);
  return (
    <div className="space-y-3" data-testid="assessment-results">
      <ul className="divide-y divide-border rounded-card border border-border text-sm">
        {(risultati.data?.items ?? []).map((r) => (
          <li key={r.assessmentResultId} data-testid="assessment-result-row" className="px-4 py-2">
            <span className="font-medium">{r.dimension}</span>
            {r.score !== null && <span> · {r.score}/100</span>}
            {r.narrative && <span className="block text-muted-foreground">{r.narrative}</span>}
            <span className="block text-xs text-muted-foreground">{fmt.dataOra(r.recordedAt)}</span>
          </li>
        ))}
        {(risultati.data?.items ?? []).length === 0 && <li className="px-4 py-2 text-muted-foreground">{t("assessments.nessunRisultato")}</li>}
      </ul>
      {puoScrivere && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="assessment-result-create">
          <label className="text-sm font-medium text-foreground">{t("assessments.dimensione")}
            <Input value={nuovo.dimension} maxLength={128} onChange={(e) => setNuovo({ ...nuovo, dimension: e.target.value })} data-testid="assessment-result-dimension" /></label>
          <label className="text-sm font-medium text-foreground">{t("assessments.punteggio")}
            <Input type="number" min={0} max={100} value={nuovo.score} onChange={(e) => setNuovo({ ...nuovo, score: e.target.value })} data-testid="assessment-result-score" aria-invalid={!punteggioValido} /></label>
          <label className="text-sm font-medium text-foreground md:col-span-2">{t("assessments.commento")}
            <Input value={nuovo.narrative} maxLength={8192} onChange={(e) => setNuovo({ ...nuovo, narrative: e.target.value })} data-testid="assessment-result-narrative" /></label>
          <div className="md:col-span-4">
            <Button type="button" data-testid="assessment-result-submit" disabled={!nuovo.dimension.trim() || !punteggioValido || registra.isPending} onClick={() => registra.mutate()}>
              {registra.isPending ? t("common:saving") : t("assessments.registraRisultato")}
            </Button>
            {registra.isError && <span className="ml-3 text-sm text-danger">{t("assessments.errore")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssessmentsPage() {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const puoCreare = perms.includes("assessment:create");
  const puoModificare = perms.includes("assessment:update");
  const [stato, setStato] = useState("");
  const [scelta, setScelta] = useState("");
  const [persone, setPersone] = useState<User[]>([]);
  const [nuova, setNuova] = useState({ kind: "MANAGER" as string, dal: "", al: "" });
  const elenco = useQuery({
    queryKey: ["assessments", stato],
    queryFn: () => apiFetch<{ items: Valutazione[]; total: number }>(`/v1/assessments?limit=50${stato ? `&status=${stato}` : ""}`),
  });
  const ricarica = () => void qc.invalidateQueries({ queryKey: ["assessments"] });
  const crea = useMutation({
    mutationFn: () => apiFetch<Valutazione>("/v1/assessments", {
      method: "POST", body: { subjectUserId: persone[0]!.userId, kind: nuova.kind, periodStart: nuova.dal || null, periodEnd: nuova.al || null },
    }),
    onSuccess: (v) => { setPersone([]); setScelta(v.assessmentId); ricarica(); },
  });
  const cambiaStato = useMutation({
    mutationFn: (v: { id: string; status: string }) => apiFetch(`/v1/assessments/${v.id}`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: ricarica,
  });
  const valutazione = elenco.data?.items.find((v) => v.assessmentId === scelta) ?? null;
  const periodo = (v: Valutazione) => (v.periodStart ? `${fmt.data(v.periodStart)} – ${v.periodEnd ? fmt.data(v.periodEnd) : "…"}` : t("assessments.senzaPeriodo"));

  return (
    <main data-testid="assessments-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader title={t("assessments.titolo")} description={t("assessments.descrizione")} />
      <Card>
        <CardHeader><CardTitle>{t("assessments.elenco", { mostrati: elenco.data?.items.length ?? 0, totale: elenco.data?.total ?? 0 })}</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <label className="block w-56 font-medium text-foreground">{t("assessments.stato")}
            <select className={SELECT_CLASS} value={stato} onChange={(e) => setStato(e.target.value)} data-testid="assessments-filter">
              <option value="">{t("assessments.tutti")}</option>
              {STATI.map((s) => <option key={s} value={s}>{t(`assessments.stati.${s}`)}</option>)}
            </select></label>
          {elenco.isLoading ? <StatoCaricamento /> : elenco.isError ? (
            <StatoErrore errore={elenco.error} titolo={t("assessments.erroreCarica")} onRiprova={() => void elenco.refetch()} />
          ) : (elenco.data?.items ?? []).length === 0 ? <StatoVuoto titolo={t("assessments.nessuna")} /> : (
            <ul className="divide-y divide-border rounded-card border border-border">
              {(elenco.data?.items ?? []).map((v) => (
                <li key={v.assessmentId} data-testid="assessment-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                  <span><Persona id={v.subjectUserId} /><span className="text-xs text-muted-foreground"> · {t(`assessments.tipi.${v.kind}`)} · {periodo(v)}</span></span>
                  <span className="flex items-center gap-2">
                    {puoModificare ? (
                      <select aria-label={t("assessments.stato")} className={`${SELECT_CLASS} w-40`} value={v.status} disabled={cambiaStato.isPending}
                        onChange={(e) => cambiaStato.mutate({ id: v.assessmentId, status: e.target.value })} data-testid="assessment-status">
                        {STATI.map((s) => <option key={s} value={s}>{t(`assessments.stati.${s}`)}</option>)}
                      </select>
                    ) : <Badge variant="secondary">{t(`assessments.stati.${v.status}`)}</Badge>}
                    <Button type="button" size="sm" variant="outline" data-testid="assessment-open" onClick={() => setScelta(scelta === v.assessmentId ? "" : v.assessmentId)}>
                      {scelta === v.assessmentId ? t("assessments.chiudi") : t("assessments.risultati")}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cambiaStato.isError && <p className="text-danger">{t("assessments.errore")}</p>}
          {valutazione && <Risultati valutazione={valutazione} puoScrivere={puoCreare} />}
        </CardContent>
      </Card>
      {puoCreare && (
        <Card data-testid="assessment-create">
          <CardHeader><CardTitle>{t("assessments.nuova")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
            <div className="md:col-span-4"><PersonPicker label={t("assessments.persona")} value={persone} onChange={(x) => setPersone(x.slice(-1))} testId="assessment-create-person" /></div>
            <label className="font-medium text-foreground">{t("assessments.tipo")}
              <select className={SELECT_CLASS} value={nuova.kind} onChange={(e) => setNuova({ ...nuova, kind: e.target.value })} data-testid="assessment-create-kind">
                {TIPI.map((k) => <option key={k} value={k}>{t(`assessments.tipi.${k}`)}</option>)}
              </select></label>
            <label className="font-medium text-foreground">{t("assessments.dal")}
              <Input type="date" value={nuova.dal} onChange={(e) => setNuova({ ...nuova, dal: e.target.value })} data-testid="assessment-create-from" /></label>
            <label className="font-medium text-foreground">{t("assessments.al")}
              <Input type="date" value={nuova.al} onChange={(e) => setNuova({ ...nuova, al: e.target.value })} data-testid="assessment-create-to" /></label>
            <div className="flex items-end">
              <Button type="button" data-testid="assessment-create-submit" disabled={persone.length !== 1 || (!!nuova.al && nuova.al < nuova.dal) || crea.isPending} onClick={() => crea.mutate()}>
                {crea.isPending ? t("common:saving") : t("assessments.apri")}
              </Button>
            </div>
            {crea.isError && <p className="text-danger md:col-span-4">{t("assessments.errore")}</p>}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
