"use client";

/**
 * Requisiti della posizione: aggiungere, correggere e togliere competenze e indicatori
 * (ondata 2 degli endpoint senza consumatori, 2026-11-17).
 *
 * `POST/DELETE /v1/positions/:id/skills` e `POST/PATCH/DELETE /v1/positions/:id/kpis` esistevano
 * e nessuna pagina li chiamava: un requisito si dichiarava solo da database. Le scritture compaiono
 * solo a chi ha `position:update`; la scelta della voce cerca nel catalogo vivo (`/v1/skills`,
 * `/v1/kpi-definitions`), mai in un elenco scritto qui.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lista locale: il web importa TIPI, non valori (stesso ordine di SKILL_PROFICIENCY_VALUES).
const LIVELLI = ["NOVICE", "BASIC", "COMPETENT", "PROFICIENT", "EXPERT", "MASTER"] as const;

interface VoceCatalogo { id: string; code: string | null; name: string }

export function usePuoModificarePosizione(): boolean {
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  return perms.includes("position:update");
}

function messaggio(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("positions.requisiti.vietato");
    if (err.status === 409) return t("positions.requisiti.giaPresente");
  }
  return t("positions.requisiti.errore");
}

/** Cerca una voce nel catalogo vivo e la fa scegliere. */
function SceltaCatalogo({ percorso, chiave, valore, onScelta, testId }: {
  percorso: string; chiave: string; valore: string; onScelta: (id: string) => void; testId: string;
}) {
  const { t } = useTranslation("admin");
  const [cerca, setCerca] = useState("");
  const voci = useQuery({
    queryKey: [chiave, "scelta", cerca],
    queryFn: () => apiFetch<{ items: VoceCatalogo[] }>(`${percorso}?limit=50${cerca.trim() ? `&search=${encodeURIComponent(cerca.trim())}` : ""}`),
  });
  return (
    <div className="space-y-2">
      <Input
        data-testid={`${testId}-cerca`}
        aria-label={t("positions.requisiti.cerca")}
        placeholder={t("positions.requisiti.cerca")}
        value={cerca}
        onChange={(e) => setCerca(e.target.value)}
      />
      <select data-testid={`${testId}-voce`} className={SELECT_CLASS} value={valore} onChange={(e) => onScelta(e.target.value)}
        aria-label={t("positions.requisiti.voce")}>
        <option value="">{voci.isLoading ? t("common:loading") : t("positions.requisiti.scegli")}</option>
        {(voci.data?.items ?? []).map((v) => (
          <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ""}</option>
        ))}
      </select>
    </div>
  );
}

export function NuovaCompetenzaRichiesta({ positionId }: { positionId: string }) {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const [aperto, setAperto] = useState(false);
  const [skillId, setSkillId] = useState("");
  const [livello, setLivello] = useState<(typeof LIVELLI)[number]>("COMPETENT");
  const [peso, setPeso] = useState("1");
  const aggiungi = useMutation({
    mutationFn: () => apiFetch(`/v1/positions/${positionId}/skills`, {
      method: "POST", body: { skillId, requiredProficiency: livello, weight: Number(peso) },
    }),
    onSuccess: () => {
      setSkillId(""); setPeso("1");
      void qc.invalidateQueries({ queryKey: ["positions", positionId, "skills"] });
    },
  });
  if (!usePuoModificarePosizione()) return null;
  return (
    <Card data-testid="position-skill-add">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{t("positions.requisiti.nuovaCompetenza")}</span>
          <Button type="button" variant="outline" data-testid="position-skill-add-toggle" onClick={() => setAperto((v) => !v)}>
            {aperto ? t("positions.requisiti.chiudi") : t("positions.requisiti.aggiungi")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent hidden={!aperto} className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-3">
          <SceltaCatalogo percorso="/v1/skills" chiave="skills" valore={skillId} onScelta={setSkillId} testId="position-skill-add" />
        </div>
        <label className="text-sm font-medium text-foreground">
          {t("positions.skills.columns.proficiency")}
          <select data-testid="position-skill-add-livello" className={SELECT_CLASS} value={livello}
            onChange={(e) => setLivello(e.target.value as (typeof LIVELLI)[number])}>
            {LIVELLI.map((l) => <option key={l} value={l}>{enumLabel("proficiency", l)}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-foreground">
          {t("positions.skills.columns.weight")}
          <Input data-testid="position-skill-add-peso" type="number" min={0} max={10} step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} />
        </label>
        <div className="flex items-end gap-3">
          <Button type="button" data-testid="position-skill-add-submit" disabled={!skillId || aggiungi.isPending} onClick={() => aggiungi.mutate()}>
            {aggiungi.isPending ? t("common:saving") : t("positions.requisiti.aggiungi")}
          </Button>
          {aggiungi.isError && <span data-testid="position-skill-add-error" className="text-sm text-danger">{messaggio(aggiungi.error, t)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function NuovoIndicatoreRichiesto({ positionId }: { positionId: string }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const [aperto, setAperto] = useState(false);
  const [kpiId, setKpiId] = useState("");
  const [peso, setPeso] = useState("1");
  const aggiungi = useMutation({
    mutationFn: () => apiFetch(`/v1/positions/${positionId}/kpis`, {
      method: "POST", body: { kpiDefinitionId: kpiId, weight: Number(peso) },
    }),
    onSuccess: () => {
      setKpiId(""); setPeso("1");
      void qc.invalidateQueries({ queryKey: ["positions", positionId, "kpis"] });
    },
  });
  if (!usePuoModificarePosizione()) return null;
  return (
    <Card data-testid="position-kpi-add">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{t("positions.requisiti.nuovoIndicatore")}</span>
          <Button type="button" variant="outline" data-testid="position-kpi-add-toggle" onClick={() => setAperto((v) => !v)}>
            {aperto ? t("positions.requisiti.chiudi") : t("positions.requisiti.aggiungi")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent hidden={!aperto} className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-3">
          <SceltaCatalogo percorso="/v1/kpi-definitions" chiave="kpi-definitions" valore={kpiId} onScelta={setKpiId} testId="position-kpi-add" />
        </div>
        <label className="text-sm font-medium text-foreground">
          {t("positions.kpis.columns.weight")}
          <Input data-testid="position-kpi-add-peso" type="number" min={0} max={9.999} step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} />
        </label>
        <div className="flex items-end gap-3 md:col-span-2">
          <Button type="button" data-testid="position-kpi-add-submit" disabled={!kpiId || aggiungi.isPending} onClick={() => aggiungi.mutate()}>
            {aggiungi.isPending ? t("common:saving") : t("positions.requisiti.aggiungi")}
          </Button>
          {aggiungi.isError && <span data-testid="position-kpi-add-error" className="text-sm text-danger">{messaggio(aggiungi.error, t)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Il peso di un indicatore si corregge sul posto (`PATCH /v1/positions/:id/kpis/:kpiId`). */
export function PesoIndicatore({ positionId, kpiId, peso }: { positionId: string; kpiId: string; peso: number }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const puo = usePuoModificarePosizione();
  const [valore, setValore] = useState(String(peso));
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/positions/${positionId}/kpis/${kpiId}`, { method: "PATCH", body: { weight: Number(valore) } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["positions", positionId, "kpis"] }),
  });
  if (!puo) return <span className="text-xs">{peso}</span>;
  return (
    <span className="flex items-center gap-2">
      <Input aria-label={t("positions.kpis.columns.weight")} data-testid="position-kpi-peso" className="w-20" type="number"
        min={0} max={9.999} step="0.1" value={valore} onChange={(e) => setValore(e.target.value)} />
      {Number(valore) !== peso && (
        <Button type="button" size="sm" variant="outline" data-testid="position-kpi-peso-salva" disabled={salva.isPending} onClick={() => salva.mutate()}>
          {salva.isPending ? t("common:saving") : t("positions.requisiti.salva")}
        </Button>
      )}
      {salva.isError && <span className="text-xs text-danger">{messaggio(salva.error, t)}</span>}
    </span>
  );
}

/** Togli un requisito, con conferma. */
export function TogliRequisito({ percorso, chiave, testId }: { percorso: string; chiave: unknown[]; testId: string }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const puo = usePuoModificarePosizione();
  const togli = useMutation({
    mutationFn: () => apiFetch(percorso, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chiave }),
  });
  if (!puo) return null;
  return (
    <Button type="button" size="sm" variant="outline" data-testid={testId} disabled={togli.isPending}
      onClick={() => { if (window.confirm(t("positions.requisiti.confermaTogli"))) togli.mutate(); }}>
      {togli.isPending ? t("common:saving") : t("positions.requisiti.togli")}
    </Button>
  );
}
