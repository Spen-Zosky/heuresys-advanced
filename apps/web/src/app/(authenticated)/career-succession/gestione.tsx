"use client";

/**
 * Carriere e successione: creare e correggere percorsi, passi, bacini, candidati e prontezza
 * (ondata 3 degli endpoint senza consumatori, 2026-11-17). Le rotte `POST/PATCH/PUT/DELETE` di
 * `career-paths`, `career-path-steps`, `position-career-paths`, `succession-pools`,
 * `position-succession-relevance`, `successor-candidates` e `successor-readiness` esistevano e la
 * pagina le leggeva soltanto. Ogni comando compare solo con il permesso `career_succession:*` che
 * la rotta chiede; posizioni e persone si scelgono dagli elenchi vivi, mai incollando identificativi.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { CareerPath, SuccessionPool, SuccessorCandidate, User } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";
import { PersonPicker } from "@/components/person-picker";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
// Liste locali: il web importa TIPI, non valori (stesso ordine degli enum di @heuresys/shared).
const TIPI_PERCORSO = ["VERTICAL", "LATERAL", "SPECIALIST", "MANAGERIAL", "CROSS_FUNCTIONAL"] as const;
const STATI_BACINO = ["PROPOSED", "ACTIVE", "ARCHIVED"] as const;
const STATI_CANDIDATO = ["CANDIDATE", "CONFIRMED", "WITHDRAWN", "NOT_READY"] as const;
const PRONTEZZA = ["READY_NOW", "READY_6_MONTHS", "READY_1_YEAR", "READY_2_YEARS", "NOT_READY"] as const;

function usePermessi() {
  const p = useCurrentUserPermissions().data?.permissions ?? [];
  return { crea: p.includes("career_succession:create"), modifica: p.includes("career_succession:update"), togli: p.includes("career_succession:delete") };
}

function messaggio(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("career.gestione.vietato");
    if (err.status === 409) return t("career.gestione.duplicato");
    if (err.status === 400 || err.status === 422) return t("career.gestione.nonValido");
  }
  return t("career.gestione.errore");
}

function Errore({ e }: { e: unknown }) {
  const { t } = useTranslation("hr");
  return e ? <span className="text-sm text-danger" data-testid="career-manage-error">{messaggio(e, t)}</span> : null;
}

interface PosizioneVoce { positionId: string; title: string }

/** Sceglie una posizione cercandola nell'elenco vivo `/v1/positions`. */
function SceltaPosizione({ valore, onScelta, etichetta, testId }: { valore: string; onScelta: (id: string) => void; etichetta: string; testId: string }) {
  const { t } = useTranslation("hr");
  const [cerca, setCerca] = useState("");
  const q = useQuery({
    queryKey: ["positions", "scelta", cerca],
    queryFn: () => apiFetch<{ items: PosizioneVoce[] }>(`/v1/positions?limit=50${cerca.trim() ? `&search=${encodeURIComponent(cerca.trim())}` : ""}`),
  });
  return (
    <div className="space-y-1 text-sm">
      <span className="font-medium text-foreground">{etichetta}</span>
      <Input aria-label={`${etichetta}: ${t("career.gestione.cerca")}`} placeholder={t("career.gestione.cerca")} value={cerca}
        onChange={(e) => setCerca(e.target.value)} data-testid={`${testId}-search`} />
      <select aria-label={etichetta} className={SELECT_CLASS} value={valore} onChange={(e) => onScelta(e.target.value)} data-testid={testId}>
        <option value="">{t("career.gestione.scegliPosizione")}</option>
        {(q.data?.items ?? []).map((p) => <option key={p.positionId} value={p.positionId}>{p.title}</option>)}
      </select>
    </div>
  );
}

/* --- percorsi, passi e posizioni collegate ------------------------------------------------------ */

interface Passo { careerPathStepId: string; ordinal: number; originPositionId: string | null; targetPositionId: string | null; typicalDurationMonths: number | null }
interface Collegamento { positionCareerPathId: string; positionId: string }

export function GestionePercorsi({ percorsi }: { percorsi: CareerPath[] }) {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perm = usePermessi();
  const [nuovo, setNuovo] = useState({ code: "", name: "", kind: "VERTICAL" as (typeof TIPI_PERCORSO)[number], description: "" });
  const [scelto, setScelto] = useState("");
  const percorso = percorsi.find((p) => p.careerPathId === scelto) ?? null;
  const [modifica, setModifica] = useState({ name: "", kind: "VERTICAL" as string, description: "" });
  const [passo, setPasso] = useState({ ordinal: "1", origin: "", target: "", mesi: "" });
  const [posizione, setPosizione] = useState("");
  const ricarica = () => void qc.invalidateQueries({ queryKey: ["career-paths"] });

  const passi = useQuery({
    queryKey: ["career-path-steps", scelto],
    queryFn: () => apiFetch<{ items: Passo[] }>(`/v1/career-path-steps?pathId=${scelto}&limit=200`),
    enabled: !!scelto,
  });
  const collegate = useQuery({
    queryKey: ["position-career-paths", scelto],
    queryFn: () => apiFetch<{ items: Collegamento[] }>(`/v1/position-career-paths?careerPathId=${scelto}&limit=200`),
    enabled: !!scelto,
  });
  const nomi = useQuery({
    queryKey: ["positions", "nomi-percorso", scelto],
    queryFn: () => apiFetch<{ items: PosizioneVoce[] }>("/v1/positions?limit=200"),
    enabled: !!scelto,
  });
  const nomeDi = (id: string | null) => (id ? nomi.data?.items.find((p) => p.positionId === id)?.title ?? t("career.gestione.posizione") : "—");

  const crea = useMutation({
    mutationFn: () => apiFetch<CareerPath>("/v1/career-paths", {
      method: "POST", body: { code: nuovo.code.trim(), name: nuovo.name.trim(), kind: nuovo.kind, description: nuovo.description.trim() || null },
    }),
    onSuccess: (p) => { setNuovo({ code: "", name: "", kind: "VERTICAL", description: "" }); setScelto(p.careerPathId); ricarica(); },
  });
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/career-paths/${scelto}`, { method: "PATCH", body: { name: modifica.name.trim(), kind: modifica.kind, description: modifica.description.trim() || null } }),
    onSuccess: ricarica,
  });
  const aggiungiPasso = useMutation({
    mutationFn: () => apiFetch("/v1/career-path-steps", {
      method: "POST",
      body: { pathId: scelto, ordinal: Number(passo.ordinal), originPositionId: passo.origin || null, targetPositionId: passo.target || null,
        typicalDurationMonths: passo.mesi.trim() === "" ? null : Number(passo.mesi) },
    }),
    onSuccess: () => { setPasso({ ordinal: String(Number(passo.ordinal) + 1), origin: passo.target, target: "", mesi: "" }); void qc.invalidateQueries({ queryKey: ["career-path-steps", scelto] }); },
  });
  const durata = useMutation({
    mutationFn: (v: { id: string; mesi: number | null }) => apiFetch(`/v1/career-path-steps/${v.id}`, { method: "PATCH", body: { typicalDurationMonths: v.mesi } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["career-path-steps", scelto] }),
  });
  const collega = useMutation({
    mutationFn: () => apiFetch("/v1/position-career-paths", { method: "POST", body: { positionId: posizione, careerPathId: scelto } }),
    onSuccess: () => { setPosizione(""); void qc.invalidateQueries({ queryKey: ["position-career-paths", scelto] }); },
  });
  const scollega = useMutation({
    mutationFn: (id: string) => apiFetch(`/v1/position-career-paths/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["position-career-paths", scelto] }),
  });

  if (!perm.crea && !perm.modifica) return null;
  return (
    <Card data-testid="career-paths-manage">
      <CardHeader><CardTitle as="h2">{t("career.gestione.percorsi")}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {perm.crea && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="career-path-create">
            <label className="text-sm font-medium text-foreground">{t("career.gestione.nome")}
              <Input value={nuovo.name} maxLength={255} onChange={(e) => setNuovo({ ...nuovo, name: e.target.value })} data-testid="career-path-create-name" /></label>
            <label className="text-sm font-medium text-foreground">{t("career.gestione.codice")}
              <Input value={nuovo.code} maxLength={128} onChange={(e) => setNuovo({ ...nuovo, code: e.target.value })} data-testid="career-path-create-code" /></label>
            <label className="text-sm font-medium text-foreground">{t("career.pathsCols.kind")}
              <select className={SELECT_CLASS} value={nuovo.kind} onChange={(e) => setNuovo({ ...nuovo, kind: e.target.value as (typeof TIPI_PERCORSO)[number] })} data-testid="career-path-create-kind">
                {TIPI_PERCORSO.map((k) => <option key={k} value={k}>{enumLabel("careerPathKind", k)}</option>)}
              </select></label>
            <div className="flex items-end gap-2">
              <Button type="button" data-testid="career-path-create-submit" disabled={!nuovo.name.trim() || !nuovo.code.trim() || crea.isPending} onClick={() => crea.mutate()}>
                {crea.isPending ? t("common:saving") : t("career.gestione.creaPercorso")}
              </Button>
              <Errore e={crea.error} />
            </div>
          </div>
        )}
        <label className="block text-sm font-medium text-foreground">{t("career.gestione.scegliPercorso")}
          <select className={SELECT_CLASS} value={scelto} data-testid="career-path-select" onChange={(e) => {
            setScelto(e.target.value);
            const p = percorsi.find((x) => x.careerPathId === e.target.value);
            if (p) setModifica({ name: p.name, kind: p.kind, description: p.description ?? "" });
          }}>
            <option value="">{t("career.gestione.nessuno")}</option>
            {percorsi.map((p) => <option key={p.careerPathId} value={p.careerPathId}>{p.name}</option>)}
          </select></label>
        {percorso && (
          <div className="space-y-6" data-testid="career-path-detail">
            {perm.modifica && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="text-sm font-medium text-foreground">{t("career.gestione.nome")}
                  <Input value={modifica.name} maxLength={255} onChange={(e) => setModifica({ ...modifica, name: e.target.value })} data-testid="career-path-edit-name" /></label>
                <label className="text-sm font-medium text-foreground">{t("career.pathsCols.kind")}
                  <select className={SELECT_CLASS} value={modifica.kind} onChange={(e) => setModifica({ ...modifica, kind: e.target.value })} data-testid="career-path-edit-kind">
                    {TIPI_PERCORSO.map((k) => <option key={k} value={k}>{enumLabel("careerPathKind", k)}</option>)}
                  </select></label>
                <label className="text-sm font-medium text-foreground">{t("career.gestione.descrizione")}
                  <Input value={modifica.description} maxLength={4096} onChange={(e) => setModifica({ ...modifica, description: e.target.value })} data-testid="career-path-edit-description" /></label>
                <div className="flex items-end gap-2">
                  <Button type="button" variant="outline" data-testid="career-path-edit-save" disabled={!modifica.name.trim() || salva.isPending} onClick={() => salva.mutate()}>
                    {salva.isPending ? t("common:saving") : t("career.gestione.salva")}
                  </Button>
                  <Errore e={salva.error} />
                </div>
              </div>
            )}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t("career.gestione.passi")}</h3>
              <ul className="divide-y divide-border rounded-card border border-border text-sm">
                {(passi.data?.items ?? []).sort((a, b) => a.ordinal - b.ordinal).map((s) => (
                  <li key={s.careerPathStepId} data-testid="career-path-step-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                    <span>{s.ordinal}. {nomeDi(s.originPositionId)} → {nomeDi(s.targetPositionId)}</span>
                    {perm.modifica ? (
                      <Input aria-label={t("career.gestione.mesi")} type="number" min={0} max={1200} className="w-24" defaultValue={s.typicalDurationMonths ?? ""}
                        data-testid="career-path-step-months"
                        onBlur={(e) => {
                          const v = e.target.value.trim() === "" ? null : Number(e.target.value);
                          if (v !== s.typicalDurationMonths) durata.mutate({ id: s.careerPathStepId, mesi: v });
                        }} />
                    ) : <span className="text-xs text-muted-foreground">{s.typicalDurationMonths ?? "—"}</span>}
                  </li>
                ))}
                {(passi.data?.items ?? []).length === 0 && <li className="px-4 py-2 text-muted-foreground">{t("career.gestione.nessunPasso")}</li>}
              </ul>
              <Errore e={durata.error} />
              {perm.crea && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="career-path-step-add">
                  <label className="text-sm font-medium text-foreground">{t("career.gestione.ordine")}
                    <Input type="number" min={0} value={passo.ordinal} onChange={(e) => setPasso({ ...passo, ordinal: e.target.value })} data-testid="career-path-step-ordinal" /></label>
                  <SceltaPosizione etichetta={t("career.gestione.da")} valore={passo.origin} onScelta={(v) => setPasso({ ...passo, origin: v })} testId="career-path-step-origin" />
                  <SceltaPosizione etichetta={t("career.gestione.a")} valore={passo.target} onScelta={(v) => setPasso({ ...passo, target: v })} testId="career-path-step-target" />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t("career.gestione.mesi")}
                      <Input type="number" min={0} max={1200} value={passo.mesi} onChange={(e) => setPasso({ ...passo, mesi: e.target.value })} data-testid="career-path-step-months-new" /></label>
                    <Button type="button" data-testid="career-path-step-submit" disabled={!passo.target || aggiungiPasso.isPending} onClick={() => aggiungiPasso.mutate()}>
                      {aggiungiPasso.isPending ? t("common:saving") : t("career.gestione.aggiungiPasso")}
                    </Button>
                    <Errore e={aggiungiPasso.error} />
                  </div>
                </div>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t("career.gestione.posizioniCollegate")}</h3>
              <ul className="divide-y divide-border rounded-card border border-border text-sm">
                {(collegate.data?.items ?? []).map((c) => (
                  <li key={c.positionCareerPathId} data-testid="career-path-position-row" className="flex items-center justify-between gap-3 px-4 py-2">
                    <span>{nomeDi(c.positionId)}</span>
                    {perm.togli && (
                      <Button type="button" size="sm" variant="outline" data-testid="career-path-position-remove" disabled={scollega.isPending}
                        onClick={() => { if (window.confirm(t("career.gestione.confermaScollega"))) scollega.mutate(c.positionCareerPathId); }}>
                        {t("career.gestione.scollega")}
                      </Button>
                    )}
                  </li>
                ))}
                {(collegate.data?.items ?? []).length === 0 && <li className="px-4 py-2 text-muted-foreground">{t("career.gestione.nessunaPosizione")}</li>}
              </ul>
              {perm.crea && (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-72"><SceltaPosizione etichetta={t("career.gestione.collegaPosizione")} valore={posizione} onScelta={setPosizione} testId="career-path-position-new" /></div>
                  <Button type="button" variant="outline" data-testid="career-path-position-submit" disabled={!posizione || collega.isPending} onClick={() => collega.mutate()}>
                    {t("career.gestione.collega")}
                  </Button>
                  <Errore e={collega.error ?? scollega.error} />
                </div>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --- bacini di successione e rilevanza della posizione ------------------------------------------ */

interface Rilevanza { positionSuccessionRelevanceId: string; positionId: string; isCritical: boolean; readinessHorizon: string | null }

export function GestioneBacini({ bacini }: { bacini: SuccessionPool[] }) {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perm = usePermessi();
  const [nuovo, setNuovo] = useState({ positionId: "", code: "", name: "" });
  const [scelto, setScelto] = useState("");
  const bacino = bacini.find((b) => b.successionPoolId === scelto) ?? null;
  const [stato, setStato] = useState<string>("ACTIVE");
  const [ril, setRil] = useState({ isCritical: false, horizon: "" });
  const ricarica = () => void qc.invalidateQueries({ queryKey: ["succession-pools"] });
  const rilevanze = useQuery({
    queryKey: ["position-succession-relevance"],
    queryFn: () => apiFetch<{ items: Rilevanza[] }>("/v1/position-succession-relevance?limit=200"),
    enabled: !!bacino,
  });
  const rilevanza = bacino ? rilevanze.data?.items.find((r) => r.positionId === bacino.positionId) ?? null : null;
  const crea = useMutation({
    mutationFn: () => apiFetch<SuccessionPool>("/v1/succession-pools", { method: "POST", body: { positionId: nuovo.positionId, code: nuovo.code.trim(), name: nuovo.name.trim() } }),
    onSuccess: () => { setNuovo({ positionId: "", code: "", name: "" }); ricarica(); },
  });
  const salvaStato = useMutation({
    mutationFn: () => apiFetch(`/v1/succession-pools/${scelto}`, { method: "PATCH", body: { status: stato } }),
    onSuccess: ricarica,
  });
  const salvaRilevanza = useMutation({
    mutationFn: () => apiFetch("/v1/position-succession-relevance", {
      method: "PUT", body: { positionId: bacino!.positionId, isCritical: ril.isCritical, readinessHorizon: ril.horizon || null },
    }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["position-succession-relevance"] }),
  });
  const togliRilevanza = useMutation({
    mutationFn: (id: string) => apiFetch(`/v1/position-succession-relevance/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["position-succession-relevance"] }),
  });

  if (!perm.crea && !perm.modifica) return null;
  return (
    <Card data-testid="career-pools-manage">
      <CardHeader><CardTitle as="h2">{t("career.gestione.bacini")}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {perm.crea && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="career-pool-create">
            <SceltaPosizione etichetta={t("career.gestione.posizione")} valore={nuovo.positionId} onScelta={(v) => setNuovo({ ...nuovo, positionId: v })} testId="career-pool-create-position" />
            <label className="text-sm font-medium text-foreground">{t("career.gestione.nome")}
              <Input value={nuovo.name} maxLength={255} onChange={(e) => setNuovo({ ...nuovo, name: e.target.value })} data-testid="career-pool-create-name" /></label>
            <label className="text-sm font-medium text-foreground">{t("career.gestione.codice")}
              <Input value={nuovo.code} maxLength={128} onChange={(e) => setNuovo({ ...nuovo, code: e.target.value })} data-testid="career-pool-create-code" /></label>
            <div className="flex items-end gap-2">
              <Button type="button" data-testid="career-pool-create-submit" disabled={!nuovo.positionId || !nuovo.name.trim() || !nuovo.code.trim() || crea.isPending} onClick={() => crea.mutate()}>
                {crea.isPending ? t("common:saving") : t("career.gestione.creaBacino")}
              </Button>
              <Errore e={crea.error} />
            </div>
          </div>
        )}
        <label className="block text-sm font-medium text-foreground">{t("career.gestione.scegliBacino")}
          <select className={SELECT_CLASS} value={scelto} data-testid="career-pool-select" onChange={(e) => {
            setScelto(e.target.value);
            const b = bacini.find((x) => x.successionPoolId === e.target.value);
            if (b) setStato(b.status);
          }}>
            <option value="">{t("career.gestione.nessuno")}</option>
            {bacini.map((b) => <option key={b.successionPoolId} value={b.successionPoolId}>{b.name}</option>)}
          </select></label>
        {bacino && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2" data-testid="career-pool-detail">
            {perm.modifica && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">{t("career.poolsCols.status")}
                  <select className={SELECT_CLASS} value={stato} onChange={(e) => setStato(e.target.value)} data-testid="career-pool-status">
                    {STATI_BACINO.map((s) => <option key={s} value={s}>{enumLabel("successionPoolStatus", s)}</option>)}
                  </select></label>
                <Button type="button" variant="outline" data-testid="career-pool-status-save" disabled={stato === bacino.status || salvaStato.isPending} onClick={() => salvaStato.mutate()}>
                  {salvaStato.isPending ? t("common:saving") : t("career.gestione.salva")}
                </Button>
                <Errore e={salvaStato.error} />
              </div>
            )}
            {perm.crea && (
              <div className="space-y-2" data-testid="career-pool-relevance">
                <p className="text-sm font-medium text-foreground">{t("career.gestione.rilevanza")}</p>
                <p className="text-xs text-muted-foreground">
                  {rilevanza
                    ? t("career.gestione.rilevanzaOra", { critica: rilevanza.isCritical ? t("career.gestione.si") : t("career.gestione.no"), orizzonte: enumLabel("readinessLevel", rilevanza.readinessHorizon) })
                    : t("career.gestione.rilevanzaAssente")}
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={ril.isCritical} onChange={(e) => setRil({ ...ril, isCritical: e.target.checked })} data-testid="career-pool-relevance-critical" />
                  {t("career.gestione.critica")}
                </label>
                <select aria-label={t("career.gestione.orizzonte")} className={SELECT_CLASS} value={ril.horizon} onChange={(e) => setRil({ ...ril, horizon: e.target.value })} data-testid="career-pool-relevance-horizon">
                  <option value="">{t("career.gestione.orizzonteNessuno")}</option>
                  {PRONTEZZA.map((h) => <option key={h} value={h}>{enumLabel("readinessLevel", h)}</option>)}
                </select>
                <span className="flex gap-2">
                  <Button type="button" variant="outline" data-testid="career-pool-relevance-save" disabled={salvaRilevanza.isPending} onClick={() => salvaRilevanza.mutate()}>
                    {t("career.gestione.salva")}
                  </Button>
                  {rilevanza && perm.togli && (
                    <Button type="button" variant="outline" data-testid="career-pool-relevance-remove" disabled={togliRilevanza.isPending}
                      onClick={() => { if (window.confirm(t("career.gestione.confermaTogli"))) togliRilevanza.mutate(rilevanza.positionSuccessionRelevanceId); }}>
                      {t("career.gestione.togli")}
                    </Button>
                  )}
                </span>
                <Errore e={salvaRilevanza.error ?? togliRilevanza.error} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --- candidati alla successione e prontezza ----------------------------------------------------- */

export function GestioneCandidati({ candidati }: { candidati: SuccessorCandidate[] }) {
  const { t } = useTranslation("hr");
  const elencoBacini = useQuery({
    queryKey: ["succession-pools", "scelta"],
    queryFn: () => apiFetch<{ items: SuccessionPool[] }>("/v1/succession-pools?limit=200"),
  });
  const bacini = elencoBacini.data?.items ?? [];
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perm = usePermessi();
  const [bacino, setBacino] = useState("");
  const [persone, setPersone] = useState<User[]>([]);
  const [scelto, setScelto] = useState("");
  const candidato = candidati.find((c) => c.successorCandidateId === scelto) ?? null;
  const [v, setV] = useState({ status: "CANDIDATE", readiness: "" });
  const [valuta, setValuta] = useState({ score: "", horizon: "" });
  const ricarica = () => void qc.invalidateQueries({ queryKey: ["successor-candidates"] });
  const aggiungi = useMutation({
    mutationFn: () => apiFetch("/v1/successor-candidates", { method: "POST", body: { poolId: bacino, userId: persone[0]!.userId } }),
    onSuccess: () => { setPersone([]); ricarica(); },
  });
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/successor-candidates/${scelto}`, { method: "PATCH", body: { status: v.status, readinessLevel: v.readiness || null } }),
    onSuccess: ricarica,
  });
  const togli = useMutation({
    mutationFn: () => apiFetch(`/v1/successor-candidates/${scelto}`, { method: "DELETE" }),
    onSuccess: () => { setScelto(""); ricarica(); },
  });
  const registra = useMutation({
    mutationFn: () => apiFetch("/v1/successor-readiness", {
      method: "POST", body: { candidateId: scelto, score: valuta.score.trim() === "" ? null : Number(valuta.score), horizon: valuta.horizon || null },
    }),
    onSuccess: () => { setValuta({ score: "", horizon: "" }); ricarica(); },
  });

  if (!perm.crea && !perm.modifica) return null;
  return (
    <Card data-testid="career-candidates-manage">
      <CardHeader><CardTitle as="h2">{t("career.gestione.candidati")}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {perm.crea && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="career-candidate-create">
            <label className="text-sm font-medium text-foreground">{t("career.candidatesCols.pool")}
              <select className={SELECT_CLASS} value={bacino} onChange={(e) => setBacino(e.target.value)} data-testid="career-candidate-create-pool">
                <option value="">{t("career.gestione.scegliBacino")}</option>
                {bacini.map((b) => <option key={b.successionPoolId} value={b.successionPoolId}>{b.name}</option>)}
              </select></label>
            <PersonPicker label={t("career.candidatesCols.user")} value={persone} onChange={(x) => setPersone(x.slice(-1))} testId="career-candidate-create-person" />
            <div className="flex items-end gap-2">
              <Button type="button" data-testid="career-candidate-create-submit" disabled={!bacino || persone.length !== 1 || aggiungi.isPending} onClick={() => aggiungi.mutate()}>
                {aggiungi.isPending ? t("common:saving") : t("career.gestione.aggiungiCandidato")}
              </Button>
              <Errore e={aggiungi.error} />
            </div>
          </div>
        )}
        <label className="block text-sm font-medium text-foreground">{t("career.gestione.scegliCandidato")}
          <select className={SELECT_CLASS} value={scelto} data-testid="career-candidate-select" onChange={(e) => {
            setScelto(e.target.value);
            const c = candidati.find((x) => x.successorCandidateId === e.target.value);
            if (c) setV({ status: c.status, readiness: c.readinessLevel ?? "" });
          }}>
            <option value="">{t("career.gestione.nessuno")}</option>
            {candidati.map((c) => <option key={c.successorCandidateId} value={c.successorCandidateId}>{`${c.userName ?? t("career.gestione.persona")} · ${c.poolName ?? ""}`}</option>)}
          </select></label>
        {candidato && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2" data-testid="career-candidate-detail">
            {perm.modifica && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">{t("career.candidatesCols.status")}
                  <select className={SELECT_CLASS} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })} data-testid="career-candidate-status">
                    {STATI_CANDIDATO.map((s) => <option key={s} value={s}>{enumLabel("successorCandidateStatus", s)}</option>)}
                  </select></label>
                <label className="block text-sm font-medium text-foreground">{t("career.candidatesCols.readiness")}
                  <select className={SELECT_CLASS} value={v.readiness} onChange={(e) => setV({ ...v, readiness: e.target.value })} data-testid="career-candidate-readiness">
                    <option value="">{t("career.gestione.orizzonteNessuno")}</option>
                    {PRONTEZZA.map((h) => <option key={h} value={h}>{enumLabel("readinessLevel", h)}</option>)}
                  </select></label>
                <span className="flex gap-2">
                  <Button type="button" variant="outline" data-testid="career-candidate-save" disabled={salva.isPending} onClick={() => salva.mutate()}>{t("career.gestione.salva")}</Button>
                  {perm.togli && (
                    <Button type="button" variant="outline" data-testid="career-candidate-remove" disabled={togli.isPending}
                      onClick={() => { if (window.confirm(t("career.gestione.confermaTogliCandidato"))) togli.mutate(); }}>
                      {t("career.gestione.togli")}
                    </Button>
                  )}
                </span>
                <Errore e={salva.error ?? togli.error} />
              </div>
            )}
            {perm.crea && (
              <div className="space-y-2" data-testid="career-candidate-assessment">
                <p className="text-sm font-medium text-foreground">{t("career.gestione.valutazione")}</p>
                <Input aria-label={t("career.gestione.punteggio")} placeholder={t("career.gestione.punteggio")} type="number" min={-100} max={100}
                  value={valuta.score} onChange={(e) => setValuta({ ...valuta, score: e.target.value })} data-testid="career-candidate-assessment-score" />
                <select aria-label={t("career.gestione.orizzonte")} className={SELECT_CLASS} value={valuta.horizon} onChange={(e) => setValuta({ ...valuta, horizon: e.target.value })}
                  data-testid="career-candidate-assessment-horizon">
                  <option value="">{t("career.gestione.orizzonteNessuno")}</option>
                  {PRONTEZZA.map((h) => <option key={h} value={h}>{enumLabel("readinessLevel", h)}</option>)}
                </select>
                <Button type="button" variant="outline" data-testid="career-candidate-assessment-submit" disabled={(!valuta.score && !valuta.horizon) || registra.isPending} onClick={() => registra.mutate()}>
                  {registra.isPending ? t("common:saving") : t("career.gestione.registra")}
                </Button>
                {registra.isSuccess && <span className="text-sm text-success">{t("career.gestione.registrata")}</span>}
                <Errore e={registra.error} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
