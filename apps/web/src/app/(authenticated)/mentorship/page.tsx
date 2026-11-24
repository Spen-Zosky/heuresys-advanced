"use client";

/**
  * /mentorship — programmi di mentoring, coppie e incontri (ondata 3 degli endpoint
 * senza consumatori, 2026-11-17). Il modulo `/v1/mentorship/*` aveva tutto (programmi, coppie,
 * incontri) e nessuna pagina: si entra dalla scheda «Mentoring» del gruppo Carriera e successione.
 * Letture con `mentorship:read`, scritture con `mentorship:create` / `mentorship:update`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { incontriLeggibili } from "@/lib/mentorship-coppie";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TIPI = ["GENERAL", "LEADERSHIP", "TECHNICAL", "MANAGEMENT", "DEI"] as const;
const STATI_PROGRAMMA = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
const STATI_COPPIA = ["PENDING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
const FREQUENZE = ["WEEKLY", "BI_WEEKLY", "MONTHLY", "QUARTERLY", "AD_HOC"] as const;
const STATI_INCONTRO = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"] as const;

interface Programma { programId: string; name: string; type: string; status: string; durationMonths: number | null; maxParticipants: number | null }
interface Coppia { mentorshipId: string; programId: string | null; mentorUserId: string | null; menteeUserId: string | null; mentorName: string | null; menteeName: string | null; status: string; meetingFrequency: string; startDate: string | null }
interface Incontro { sessionId: string; date: string; durationMinutes: number | null; status: string; notes: string | null; rating: number | null }

function usePermessi() {
  const q = useCurrentUserPermissions();
  const p = q.data?.permissions ?? [];
  // K30: le letture partono solo con `mentorship:read` (prima chi non l'aveva riceveva due 403).
  // Finché i permessi non sono noti la pagina mostra il caricamento, e un errore se non arrivano:
  // una lettura spenta non deve sembrare un elenco vuoto.
  return {
    query: q,
    legge: p.includes("mentorship:read"), crea: p.includes("mentorship:create"), modifica: p.includes("mentorship:update"),
  };
}

function Persona({ id, nome }: { id: string | null; nome: string | null }) {
  const { t } = useTranslation("hr");
  if (!id) return <span className="text-muted-foreground">{t("mentorship.nessuno")}</span>;
  if (!nome) return <span className="text-muted-foreground" title={t("mentorship.omissisAiuto")}>{t("mentorship.omissis")}</span>;
  return <span className="font-medium">{nome}</span>;
}

function Incontri({ coppia }: { coppia: Coppia }) {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const qc = useQueryClient();
  const perm = usePermessi();
  const chiave = ["mentorship", "sessions", coppia.mentorshipId];
  const [nuovo, setNuovo] = useState({ quando: "", minuti: "60" });
  const incontri = useQuery({
    queryKey: chiave,
    queryFn: () => apiFetch<{ items: Incontro[] }>(`/v1/mentorship/pairings/${coppia.mentorshipId}/sessions?limit=100`),
  });
  const aggiungi = useMutation({
    mutationFn: () => apiFetch(`/v1/mentorship/pairings/${coppia.mentorshipId}/sessions`, {
      method: "POST", body: { date: new Date(nuovo.quando).toISOString(), durationMinutes: Number(nuovo.minuti) || null },
    }),
    onSuccess: () => { setNuovo({ quando: "", minuti: "60" }); void qc.invalidateQueries({ queryKey: chiave }); },
  });
  const aggiorna = useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) => apiFetch(`/v1/mentorship/sessions/${v.id}`, { method: "PATCH", body: v.body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chiave }),
  });
  return (
    <div className="space-y-3" data-testid="mentorship-sessions">
      <ul className="divide-y divide-border rounded-card border border-border text-sm">
        {(incontri.data?.items ?? []).map((s) => (
          <li key={s.sessionId} data-testid="mentorship-session-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
            <span>{fmt.dataOra(s.date)}{s.durationMinutes ? ` · ${t("mentorship.minuti", { count: s.durationMinutes })}` : ""}</span>
            {perm.modifica ? (
              <span className="flex items-center gap-2">
                <select aria-label={t("mentorship.statoIncontro")} className={`${SELECT_CLASS} w-40`} value={s.status} disabled={aggiorna.isPending}
                  onChange={(e) => aggiorna.mutate({ id: s.sessionId, body: { status: e.target.value } })} data-testid="mentorship-session-status">
                  {STATI_INCONTRO.map((x) => <option key={x} value={x}>{t(`mentorship.statiIncontro.${x}`)}</option>)}
                </select>
                <select aria-label={t("mentorship.voto")} className={`${SELECT_CLASS} w-24`} value={s.rating ?? ""} disabled={aggiorna.isPending}
                  onChange={(e) => aggiorna.mutate({ id: s.sessionId, body: { rating: e.target.value ? Number(e.target.value) : null } })} data-testid="mentorship-session-rating">
                  <option value="">{t("mentorship.senzaVoto")}</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </span>
            ) : <Badge variant="secondary">{t(`mentorship.statiIncontro.${s.status}`)}</Badge>}
          </li>
        ))}
        {(incontri.data?.items ?? []).length === 0 && <li className="px-4 py-2 text-muted-foreground">{t("mentorship.nessunIncontro")}</li>}
      </ul>
      {perm.crea && (
        <div className="flex flex-wrap items-end gap-3" data-testid="mentorship-session-create">
          <label className="text-sm font-medium text-foreground">{t("mentorship.quando")}
            <Input type="datetime-local" value={nuovo.quando} onChange={(e) => setNuovo({ ...nuovo, quando: e.target.value })} data-testid="mentorship-session-when" /></label>
          <label className="w-32 text-sm font-medium text-foreground">{t("mentorship.durata")}
            <Input type="number" min={0} value={nuovo.minuti} onChange={(e) => setNuovo({ ...nuovo, minuti: e.target.value })} data-testid="mentorship-session-minutes" /></label>
          <Button type="button" data-testid="mentorship-session-submit" disabled={!nuovo.quando || aggiungi.isPending} onClick={() => aggiungi.mutate()}>
            {aggiungi.isPending ? t("common:saving") : t("mentorship.fissa")}
          </Button>
        </div>
      )}
      {(aggiungi.isError || aggiorna.isError) && <p className="text-sm text-danger">{t("mentorship.errore")}</p>}
    </div>
  );
}

export default function MentorshipPage() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const perm = usePermessi();
  const [nuovo, setNuovo] = useState({ name: "", type: "GENERAL" as string, durationMonths: "" });
  const [programma, setProgramma] = useState("");
  const [coppiaScelta, setCoppiaScelta] = useState("");
  const programmi = useQuery({ queryKey: ["mentorship", "programs"], enabled: perm.legge, queryFn: () => apiFetch<{ items: Programma[]; total: number }>("/v1/mentorship/programs?limit=100") });
  const coppie = useQuery({
    queryKey: ["mentorship", "pairings", programma],
    enabled: perm.legge,
    queryFn: () => apiFetch<{ items: Coppia[]; total: number }>(`/v1/mentorship/pairings?limit=100${programma ? `&programId=${programma}` : ""}`),
  });
  const ricarica = () => void qc.invalidateQueries({ queryKey: ["mentorship"] });
  const crea = useMutation({
    mutationFn: () => apiFetch("/v1/mentorship/programs", {
      method: "POST", body: { name: nuovo.name.trim(), type: nuovo.type, status: "DRAFT", durationMonths: nuovo.durationMonths ? Number(nuovo.durationMonths) : null },
    }),
    onSuccess: () => { setNuovo({ name: "", type: "GENERAL", durationMonths: "" }); ricarica(); },
  });
  const statoProgramma = useMutation({
    mutationFn: (v: { id: string; status: string }) => apiFetch(`/v1/mentorship/programs/${v.id}`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: ricarica,
  });
  const aggiornaCoppia = useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) => apiFetch(`/v1/mentorship/pairings/${v.id}`, { method: "PATCH", body: v.body }),
    onSuccess: ricarica,
  });
  const nomeProgramma = (id: string | null) => programmi.data?.items.find((p) => p.programId === id)?.name ?? t("mentorship.senzaProgramma");
  const coppia = coppie.data?.items.find((c) => c.mentorshipId === coppiaScelta) ?? null;

  if (!perm.query.data) {
    return (
      <div data-testid="mentorship-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
        <PageHeader title={t("mentorship.titolo")} description={t("mentorship.descrizione")} />
        {perm.query.isError ? (
          <StatoErrore errore={perm.query.error} titolo={t("mentorship.erroreCarica")} onRiprova={() => void perm.query.refetch()} />
        ) : <StatoCaricamento />}
      </div>
    );
  }
  if (!perm.legge) {
    // La guardia di pagina nega già questa scheda; qui resta solo la difesa, senza letture.
    return (
      <div data-testid="mentorship-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
        <PageHeader title={t("mentorship.titolo")} description={t("mentorship.descrizione")} />
        <StatoVuoto titolo={t("shell:noAccess.title")} motivo={t("shell:noAccess.bodyGenerico")} />
      </div>
    );
  }

  return (
    <div data-testid="mentorship-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader title={t("mentorship.titolo")} description={t("mentorship.descrizione")} />

      <Card data-testid="mentorship-programs">
        <CardHeader><CardTitle as="h2">{t("mentorship.programmi", { count: programmi.data?.total ?? 0 })}</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {programmi.isLoading ? <StatoCaricamento /> : programmi.isError ? (
            <StatoErrore errore={programmi.error} titolo={t("mentorship.erroreCarica")} onRiprova={() => void programmi.refetch()} />
          ) : (programmi.data?.items ?? []).length === 0 ? <StatoVuoto titolo={t("mentorship.nessunProgramma")} /> : (
            <ul className="divide-y divide-border rounded-card border border-border">
              {(programmi.data?.items ?? []).map((p) => (
                <li key={p.programId} data-testid="mentorship-program-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                  <span><span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground"> · {t(`mentorship.tipi.${p.type}`)}{p.durationMonths ? ` · ${t("mentorship.mesi", { count: p.durationMonths })}` : ""}</span></span>
                  {perm.modifica ? (
                    <select aria-label={t("mentorship.statoProgramma")} className={`${SELECT_CLASS} w-40`} value={p.status} disabled={statoProgramma.isPending}
                      onChange={(e) => statoProgramma.mutate({ id: p.programId, status: e.target.value })} data-testid="mentorship-program-status">
                      {STATI_PROGRAMMA.map((s) => <option key={s} value={s}>{t(`mentorship.statiProgramma.${s}`)}</option>)}
                    </select>
                  ) : <Badge variant="secondary">{t(`mentorship.statiProgramma.${p.status}`)}</Badge>}
                </li>
              ))}
            </ul>
          )}
          {perm.crea && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="mentorship-program-create">
              <label className="font-medium text-foreground md:col-span-2">{t("mentorship.nome")}
                <Input value={nuovo.name} maxLength={255} onChange={(e) => setNuovo({ ...nuovo, name: e.target.value })} data-testid="mentorship-program-create-name" /></label>
              <label className="font-medium text-foreground">{t("mentorship.tipo")}
                <select className={SELECT_CLASS} value={nuovo.type} onChange={(e) => setNuovo({ ...nuovo, type: e.target.value })} data-testid="mentorship-program-create-type">
                  {TIPI.map((x) => <option key={x} value={x}>{t(`mentorship.tipi.${x}`)}</option>)}
                </select></label>
              <label className="font-medium text-foreground">{t("mentorship.durataMesi")}
                <Input type="number" min={0} value={nuovo.durationMonths} onChange={(e) => setNuovo({ ...nuovo, durationMonths: e.target.value })} data-testid="mentorship-program-create-months" /></label>
              <div className="md:col-span-4">
                <Button type="button" data-testid="mentorship-program-create-submit" disabled={!nuovo.name.trim() || crea.isPending} onClick={() => crea.mutate()}>
                  {crea.isPending ? t("common:saving") : t("mentorship.creaProgramma")}
                </Button>
              </div>
            </div>
          )}
          {(crea.isError || statoProgramma.isError) && <p className="text-danger">{t("mentorship.errore")}</p>}
        </CardContent>
      </Card>

      <Card data-testid="mentorship-pairings">
        <CardHeader><CardTitle as="h2">{t("mentorship.coppie", { count: coppie.data?.total ?? 0 })}</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <label className="block w-72 font-medium text-foreground">{t("mentorship.filtraProgramma")}
            <select className={SELECT_CLASS} value={programma} onChange={(e) => { setProgramma(e.target.value); setCoppiaScelta(""); }} data-testid="mentorship-pairing-filter">
              <option value="">{t("mentorship.tuttiProgrammi")}</option>
              {(programmi.data?.items ?? []).map((p) => <option key={p.programId} value={p.programId}>{p.name}</option>)}
            </select></label>
          {coppie.isLoading ? <StatoCaricamento /> : coppie.isError ? (
            <StatoErrore errore={coppie.error} titolo={t("mentorship.erroreCarica")} onRiprova={() => void coppie.refetch()} />
          ) : (
          <ul className="divide-y divide-border rounded-card border border-border">
            {(coppie.data?.items ?? []).map((c) => (
              <li key={c.mentorshipId} data-testid="mentorship-pairing-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                <span>
                  <Persona id={c.mentorUserId} nome={c.mentorName} /> → <Persona id={c.menteeUserId} nome={c.menteeName} />
                  <span className="text-xs text-muted-foreground"> · {nomeProgramma(c.programId)}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {perm.modifica ? (
                    <>
                      <select aria-label={t("mentorship.statoCoppia")} className={`${SELECT_CLASS} w-36`} value={c.status} disabled={aggiornaCoppia.isPending}
                        onChange={(e) => aggiornaCoppia.mutate({ id: c.mentorshipId, body: { status: e.target.value } })} data-testid="mentorship-pairing-status">
                        {STATI_COPPIA.map((s) => <option key={s} value={s}>{t(`mentorship.statiCoppia.${s}`)}</option>)}
                      </select>
                      <select aria-label={t("mentorship.frequenza")} className={`${SELECT_CLASS} w-36`} value={c.meetingFrequency} disabled={aggiornaCoppia.isPending}
                        onChange={(e) => aggiornaCoppia.mutate({ id: c.mentorshipId, body: { meetingFrequency: e.target.value } })} data-testid="mentorship-pairing-frequency">
                        {FREQUENZE.map((f) => <option key={f} value={f}>{t(`mentorship.frequenze.${f}`)}</option>)}
                      </select>
                    </>
                  ) : <Badge variant="secondary">{t(`mentorship.statiCoppia.${c.status}`)}</Badge>}
                  {incontriLeggibili(c) ? (
                    <Button type="button" size="sm" variant="outline" data-testid="mentorship-pairing-open" onClick={() => setCoppiaScelta(c.mentorshipId === coppiaScelta ? "" : c.mentorshipId)}>
                      {c.mentorshipId === coppiaScelta ? t("mentorship.chiudiIncontri") : t("mentorship.apriIncontri")}
                    </Button>
                  ) : <span className="text-xs text-muted-foreground" data-testid="mentorship-pairing-closed">{t("mentorship.incontriFuoriPerimetro")}</span>}
                </span>
              </li>
            ))}
            {(coppie.data?.items ?? []).length === 0 && <li className="px-4 py-2 text-muted-foreground">{t("mentorship.nessunaCoppia")}</li>}
          </ul>
          )}
          {aggiornaCoppia.isError && <p className="text-danger">{t("mentorship.errore")}</p>}
          {coppia && <Incontri coppia={coppia} />}
        </CardContent>
      </Card>
    </div>
  );
}
