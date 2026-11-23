"use client";

/**
 * Il piano di un progetto: fasi, attività e tappe con le date, le dipendenze, il Gantt e il grafo
 * (V7 del piano docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md).
 *
 * Legge `GET /v1/projects/:id/scheda`; chi guida il progetto (`canManage`, deciso dall'API) aggiunge,
 * corregge e toglie fasi e dipendenze. Ogni scrittura torna con la scheda intera, che sostituisce
 * quella in memoria: la pagina mostra sempre ciò che il database ha scritto.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from "@heuresys/ui";
import type {
  ProjectDependencyCreateBody, ProjectDependencyKind, ProjectPhaseCreateBody, ProjectPhaseKind, ProjectPhaseStatus, ProjectScheda,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useFormat } from "@/lib/format";
import { MODALE } from "@/lib/modale";
import { SchedePagina } from "@/components/schede-pagina";
import { StatoCaricamento, StatoErrore } from "@/components/stato-pagina";
import { GanttProgetto, GrafoDipendenze, haDate, profondita } from "@/components/progetto/gantt";

type Fase = ProjectScheda["phases"][number];

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
// Liste locali: il web importa TIPI, non valori (stesso ordine degli schemi in project-plan.ts).
const TIPI: readonly ProjectPhaseKind[] = ["PHASE", "ACTIVITY", "MILESTONE"];
const STATI: readonly ProjectPhaseStatus[] = ["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"];
const LEGAMI: readonly ProjectDependencyKind[] = ["FS", "SS", "FF", "SF"];

function oggiRoma(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
}

function messaggio(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("projects.piano.errori.vietato");
    if (err.code === "PROJECT_DEPENDENCY_CYCLE" || err.code === "PROJECT_PHASE_CYCLE") return t("projects.piano.errori.ciclo");
    if (err.status === 409) return t("projects.piano.errori.duplicato");
    if (err.status === 400) return t("projects.piano.errori.dati");
  }
  return t("projects.piano.errori.generico");
}

export function PianoProgetto({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation("hr");
  const fmt = useFormat();
  const qc = useQueryClient();
  const chiave = ["projects", "scheda", projectId] as const;
  const q = useQuery({
    queryKey: chiave,
    queryFn: ({ signal }) => apiFetch<ProjectScheda>(`/v1/projects/${projectId}/scheda`, { signal }),
    staleTime: 30_000,
    retry: 0,
  });
  const [modulo, setModulo] = useState<{ fase: Fase | null; padre: string | null } | null>(null);
  const [aperta, setAperta] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const scrivi = useMutation({
    mutationFn: (r: { url: string; method: "POST" | "PATCH" | "DELETE"; body?: unknown }) =>
      apiFetch<ProjectScheda>(r.url, { method: r.method, ...(r.body !== undefined ? { body: r.body } : {}) }),
    onSuccess: (s) => {
      qc.setQueryData(chiave, s);
      setErrore(null);
      setModulo(null);
    },
    onError: (e) => setErrore(messaggio(e, t)),
  });

  const mesi = useMemo(
    () => Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(i18n.language || "it", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, m, 1)))),
    [i18n.language],
  );

  if (q.isLoading) return <StatoCaricamento testId="project-plan-loading" />;
  if (q.isError || !q.data) {
    return <StatoErrore errore={q.error} titolo={t("projects.piano.errori.lettura")} testId="project-plan-error" onRiprova={() => void q.refetch()} />;
  }
  const s = q.data;
  const prof = profondita(s.phases);
  const nome = new Map(s.phases.map((f) => [f.phaseId, f.name]));
  const faseAperta = s.phases.find((f) => f.phaseId === aperta) ?? null;
  const base = `/v1/projects/${projectId}`;
  const data = (d: string | null) => (d ? fmt.data(d) : "—");

  const tabella = (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center justify-between gap-3">
          <span>{t("projects.piano.titolo", { count: s.phases.length })}</span>
          {s.canManage ? (
            <Button type="button" variant="outline" data-testid="project-phase-add" onClick={() => setModulo({ fase: null, padre: null })}>
              {t("projects.piano.aggiungi")}
            </Button>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {s.process ? (
          <p className="mb-3 text-sm text-muted-foreground" data-testid="project-plan-process">
            {t("projects.piano.processo")}: <a className="underline" href={`/tenant-processes/${s.process.processId}`}>{s.process.name}</a>
          </p>
        ) : null}
        {errore ? <p role="alert" className="mb-3 text-sm text-destructive" data-testid="project-plan-errore">{errore}</p> : null}
        {s.phases.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="project-plan-empty">
            {s.canManage ? t("projects.piano.vuotoGestore") : t("projects.piano.vuoto")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="project-plan-table">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">{t("projects.piano.colonne.nome")}</th>
                  <th className="py-2 pr-3">{t("projects.piano.colonne.tipo")}</th>
                  <th className="py-2 pr-3">{t("projects.piano.colonne.chi")}</th>
                  <th className="py-2 pr-3">{t("projects.piano.colonne.inizio")}</th>
                  <th className="py-2 pr-3">{t("projects.piano.colonne.fine")}</th>
                  <th className="py-2 pr-3 text-right">{t("projects.piano.colonne.avanzamento")}</th>
                  <th className="py-2 pr-3">{t("projects.piano.colonne.stato")}</th>
                  {s.canManage ? <th className="py-2"><span className="sr-only">{t("common:table.actions")}</span></th> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {s.phases.map((f) => (
                  <tr key={f.phaseId} data-testid="project-phase-row">
                    <td className="py-2 pr-3" style={{ paddingLeft: `${(prof.get(f.phaseId) ?? 0) * 16}px` }}>
                      <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => setAperta(f.phaseId)}>
                        <span className={f.kind === "PHASE" ? "font-semibold" : ""}>{f.name}</span>
                      </button>
                    </td>
                    <td className="py-2 pr-3">{t(`projects.piano.tipo.${f.kind}`)}</td>
                    <td className="py-2 pr-3">{f.ownerName ?? "—"}</td>
                    <td className="py-2 pr-3 tabular-nums">{data(f.plannedStart)}</td>
                    <td className="py-2 pr-3 tabular-nums">{data(f.plannedEnd)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{f.progressPct === null ? "—" : fmt.percento(f.progressPct, "0-100")}</td>
                    <td className="py-2 pr-3"><Badge>{t(`projects.piano.stato.${f.status}`)}</Badge></td>
                    {s.canManage ? (
                      <td className="whitespace-nowrap py-2 text-right">
                        {f.kind === "PHASE" ? (
                          <Button type="button" variant="ghost" size="sm" data-testid="project-phase-add-child" onClick={() => setModulo({ fase: null, padre: f.phaseId })}>
                            {t("projects.piano.aggiungiDentro")}
                          </Button>
                        ) : null}
                        <Button type="button" variant="ghost" size="sm" data-testid="project-phase-edit" onClick={() => setModulo({ fase: f, padre: f.parentId })}>
                          {t("projects.piano.modifica")}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" data-testid="project-phase-delete" disabled={scrivi.isPending}
                          onClick={() => scrivi.mutate({ url: `${base}/phases/${f.phaseId}`, method: "DELETE" })}>
                          {t("projects.piano.togli")}
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const gantt = haDate(s.phases) ? (
    <GanttProgetto scheda={s} oggi={oggiRoma()} mesi={mesi} onApri={setAperta} nomeFile={`gantt-${s.project.code}`}
      ariaLabel={t("projects.piano.gantt")} testId="project-gantt" />
  ) : (
    <p className="text-sm text-muted-foreground" data-testid="project-gantt-empty">{t("projects.piano.ganttVuoto")}</p>
  );

  const dipendenze = (
    <div className="space-y-4">
      {s.dependencies.length > 0 ? (
        <GrafoDipendenze scheda={s} onApri={setAperta} nomeFile={`dipendenze-${s.project.code}`} ariaLabel={t("projects.piano.dipendenze")} testId="project-dependency-graph" />
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="project-dependencies-empty">{t("projects.piano.dipendenzeVuote")}</p>
      )}
      {s.dependencies.length > 0 ? (
        <ul className="divide-y text-sm" data-testid="project-dependency-list">
          {s.dependencies.map((d) => (
            <li key={d.dependencyId} className="flex items-center justify-between gap-3 py-2" data-testid="project-dependency-row">
              <span>
                {t("projects.piano.legameFrase", { prima: nome.get(d.predecessorId) ?? "", dopo: nome.get(d.successorId) ?? "", legame: t(`projects.piano.legame.${d.kind}`) })}
                {d.lagDays !== 0 ? ` (${t("projects.piano.ritardo", { count: d.lagDays })})` : ""}
              </span>
              {s.canManage ? (
                <Button type="button" variant="ghost" size="sm" data-testid="project-dependency-delete" disabled={scrivi.isPending}
                  onClick={() => scrivi.mutate({ url: `${base}/dependencies/${d.dependencyId}`, method: "DELETE" })}>
                  {t("projects.piano.togli")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {s.canManage && s.phases.length > 1 ? (
        <NuovaDipendenza fasi={s.phases} inCorso={scrivi.isPending}
          onCrea={(body) => scrivi.mutate({ url: `${base}/dependencies`, method: "POST", body })} />
      ) : null}
      {errore ? <p role="alert" className="text-sm text-destructive">{errore}</p> : null}
    </div>
  );

  return (
    <section data-testid="project-plan" className="space-y-3">
      <SchedePagina
        chiave="piano"
        schede={[
          { id: "piano", titolo: t("projects.piano.scheda"), conteggio: s.phases.length, contenuto: tabella },
          { id: "gantt", titolo: t("projects.piano.gantt"), contenuto: gantt },
          { id: "dipendenze", titolo: t("projects.piano.dipendenze"), conteggio: s.dependencies.length, contenuto: dipendenze },
        ]}
      />

      {modulo ? (
        <ModuloFase scheda={s} fase={modulo.fase} padre={modulo.padre} inCorso={scrivi.isPending} errore={errore}
          onChiudi={() => { setModulo(null); setErrore(null); }}
          onSalva={(body) => scrivi.mutate(modulo.fase
            ? { url: `${base}/phases/${modulo.fase.phaseId}`, method: "PATCH", body }
            : { url: `${base}/phases`, method: "POST", body })} />
      ) : null}

      <Dialog open={Boolean(faseAperta)} onOpenChange={(o) => { if (!o) setAperta(null); }}>
        {faseAperta ? (
          <DialogContent className={MODALE.media} data-testid="project-phase-finestra">
            <DialogTitle className="text-lg font-bold leading-tight">{faseAperta.name}</DialogTitle>
            <DialogDescription className="text-xs">{t(`projects.piano.tipo.${faseAperta.kind}`)} · {t(`projects.piano.stato.${faseAperta.status}`)}</DialogDescription>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">{t("projects.piano.colonne.chi")}</dt><dd>{faseAperta.ownerName ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t("projects.piano.colonne.avanzamento")}</dt><dd>{faseAperta.progressPct === null ? "—" : fmt.percento(faseAperta.progressPct, "0-100")}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t("projects.piano.pianificato")}</dt><dd>{data(faseAperta.plannedStart)} → {data(faseAperta.plannedEnd)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t("projects.piano.effettivo")}</dt><dd>{data(faseAperta.actualStart)} → {data(faseAperta.actualEnd)}</dd></div>
              {faseAperta.parentId ? <div className="col-span-2"><dt className="text-xs text-muted-foreground">{t("projects.piano.dentro")}</dt><dd>{nome.get(faseAperta.parentId)}</dd></div> : null}
              {faseAperta.processStepName ? <div className="col-span-2"><dt className="text-xs text-muted-foreground">{t("projects.piano.attivitaProcesso")}</dt><dd>{faseAperta.processStepName}</dd></div> : null}
              {faseAperta.description ? <div className="col-span-2"><dt className="text-xs text-muted-foreground">{t("projects.piano.descrizione")}</dt><dd className="whitespace-pre-line">{faseAperta.description}</dd></div> : null}
            </dl>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

function ModuloFase({
  scheda, fase, padre, inCorso, errore, onChiudi, onSalva,
}: {
  scheda: ProjectScheda;
  fase: Fase | null;
  padre: string | null;
  inCorso: boolean;
  errore: string | null;
  onChiudi: () => void;
  onSalva: (body: ProjectPhaseCreateBody) => void;
}) {
  const { t } = useTranslation("hr");
  const [v, setV] = useState({
    name: fase?.name ?? "",
    kind: (fase?.kind ?? (padre ? "ACTIVITY" : "PHASE")) as ProjectPhaseKind,
    parentId: fase?.parentId ?? padre ?? "",
    plannedStart: fase?.plannedStart ?? "",
    plannedEnd: fase?.plannedEnd ?? "",
    actualStart: fase?.actualStart ?? "",
    actualEnd: fase?.actualEnd ?? "",
    progressPct: fase?.progressPct === null || fase?.progressPct === undefined ? "" : String(fase.progressPct),
    status: (fase?.status ?? "PLANNED") as ProjectPhaseStatus,
    ownerMemberId: fase?.ownerMemberId ?? "",
    description: fase?.description ?? "",
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const genitori = scheda.phases.filter((f) => f.kind === "PHASE" && f.phaseId !== fase?.phaseId);
  const membri = scheda.project.members.filter((m) => m.isCurrent);
  const salva = () => {
    const fine = v.kind === "MILESTONE" ? v.plannedStart : v.plannedEnd;
    onSalva({
      name: v.name.trim(),
      kind: v.kind,
      parentId: v.parentId || null,
      plannedStart: v.plannedStart || null,
      plannedEnd: fine || null,
      actualStart: v.actualStart || null,
      actualEnd: v.actualEnd || null,
      progressPct: v.progressPct === "" ? null : Number(v.progressPct),
      status: v.status,
      ownerMemberId: v.ownerMemberId || null,
      description: v.description.trim() || null,
    });
  };
  const campo = "text-sm font-medium text-foreground";
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onChiudi(); }}>
      <DialogContent className={MODALE.media} data-testid="project-phase-form">
        <DialogTitle>{fase ? t("projects.piano.modificaTitolo") : t("projects.piano.nuovaTitolo")}</DialogTitle>
        <DialogDescription className="text-xs">{scheda.project.name}</DialogDescription>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className={`${campo} md:col-span-2`}>
            {t("projects.piano.colonne.nome")}
            <Input data-testid="phase-name" value={v.name} maxLength={255} onChange={set("name")} />
          </label>
          <label className={campo}>
            {t("projects.piano.colonne.tipo")}
            <select data-testid="phase-kind" className={SELECT_CLASS} value={v.kind} onChange={set("kind")}>
              {TIPI.map((k) => <option key={k} value={k}>{t(`projects.piano.tipo.${k}`)}</option>)}
            </select>
          </label>
          <label className={campo}>
            {t("projects.piano.dentro")}
            <select data-testid="phase-parent" className={SELECT_CLASS} value={v.parentId} onChange={set("parentId")}>
              <option value="">{t("projects.piano.primoLivello")}</option>
              {genitori.map((f) => <option key={f.phaseId} value={f.phaseId}>{f.name}</option>)}
            </select>
          </label>
          <label className={campo}>
            {v.kind === "MILESTONE" ? t("projects.piano.dataTappa") : t("projects.piano.inizioPianificato")}
            <Input type="date" data-testid="phase-planned-start" value={v.plannedStart} onChange={set("plannedStart")} />
          </label>
          {v.kind !== "MILESTONE" ? (
            <label className={campo}>
              {t("projects.piano.finePianificata")}
              <Input type="date" data-testid="phase-planned-end" value={v.plannedEnd} onChange={set("plannedEnd")} />
            </label>
          ) : <span />}
          <label className={campo}>
            {t("projects.piano.inizioEffettivo")}
            <Input type="date" data-testid="phase-actual-start" value={v.actualStart} onChange={set("actualStart")} />
          </label>
          <label className={campo}>
            {t("projects.piano.fineEffettiva")}
            <Input type="date" data-testid="phase-actual-end" value={v.actualEnd} onChange={set("actualEnd")} />
          </label>
          <label className={campo}>
            {t("projects.piano.colonne.avanzamento")}
            <Input type="number" min={0} max={100} data-testid="phase-progress" value={v.progressPct} onChange={set("progressPct")} />
          </label>
          <label className={campo}>
            {t("projects.piano.colonne.stato")}
            <select data-testid="phase-status" className={SELECT_CLASS} value={v.status} onChange={set("status")}>
              {STATI.map((k) => <option key={k} value={k}>{t(`projects.piano.stato.${k}`)}</option>)}
            </select>
          </label>
          <label className={`${campo} md:col-span-2`}>
            {t("projects.piano.colonne.chi")}
            <select data-testid="phase-owner" className={SELECT_CLASS} value={v.ownerMemberId} onChange={set("ownerMemberId")}>
              <option value="">{t("projects.piano.nessuno")}</option>
              {membri.map((m) => <option key={m.memberId} value={m.memberId}>{m.fullName ?? "—"}</option>)}
            </select>
          </label>
          <label className={`${campo} md:col-span-2`}>
            {t("projects.piano.descrizione")}
            <textarea data-testid="phase-description" className={SELECT_CLASS} rows={3} maxLength={4000} value={v.description} onChange={set("description")} />
          </label>
        </div>
        {errore ? <p role="alert" className="text-sm text-destructive" data-testid="phase-form-errore">{errore}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onChiudi}>{t("projects.piano.annulla")}</Button>
          <Button type="button" data-testid="phase-save" disabled={inCorso || v.name.trim() === ""} onClick={salva}>
            {inCorso ? t("projects.piano.salvataggio") : t("projects.piano.salva")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NuovaDipendenza({ fasi, inCorso, onCrea }: { fasi: Fase[]; inCorso: boolean; onCrea: (b: ProjectDependencyCreateBody) => void }) {
  const { t } = useTranslation("hr");
  const [prima, setPrima] = useState("");
  const [dopo, setDopo] = useState("");
  const [legame, setLegame] = useState<ProjectDependencyKind>("FS");
  const [ritardo, setRitardo] = useState("0");
  const pronta = prima !== "" && dopo !== "" && prima !== dopo;
  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 md:grid-cols-4" data-testid="project-dependency-form">
      <label className="text-sm font-medium">
        {t("projects.piano.prima")}
        <select data-testid="dependency-predecessor" className={SELECT_CLASS} value={prima} onChange={(e) => setPrima(e.target.value)}>
          <option value="">—</option>
          {fasi.map((f) => <option key={f.phaseId} value={f.phaseId}>{f.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">
        {t("projects.piano.dopo")}
        <select data-testid="dependency-successor" className={SELECT_CLASS} value={dopo} onChange={(e) => setDopo(e.target.value)}>
          <option value="">—</option>
          {fasi.map((f) => <option key={f.phaseId} value={f.phaseId}>{f.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">
        {t("projects.piano.tipoLegame")}
        <select data-testid="dependency-kind" className={SELECT_CLASS} value={legame} onChange={(e) => setLegame(e.target.value as ProjectDependencyKind)}>
          {LEGAMI.map((k) => <option key={k} value={k}>{t(`projects.piano.legame.${k}`)}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">
        {t("projects.piano.ritardoGiorni")}
        <Input type="number" min={-365} max={365} data-testid="dependency-lag" value={ritardo} onChange={(e) => setRitardo(e.target.value)} />
      </label>
      <div className="md:col-span-4 flex justify-end">
        <Button type="button" data-testid="dependency-add" disabled={!pronta || inCorso}
          onClick={() => onCrea({ predecessorId: prima, successorId: dopo, kind: legame, lagDays: Number(ritardo) || 0 })}>
          {inCorso ? t("projects.piano.salvataggio") : t("projects.piano.aggiungiLegame")}
        </Button>
      </div>
    </div>
  );
}
