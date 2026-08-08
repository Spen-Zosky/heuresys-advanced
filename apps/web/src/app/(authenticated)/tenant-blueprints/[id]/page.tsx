"use client";

/**
 * apps/web/src/app/(authenticated)/tenant-blueprints/[id]/page.tsx
 * #131 Tenant Builder P1, T6 — la cascata.
 *
 * Tre passi in sequenza, e il successivo si apre solo quando il precedente e'
 * completo: carta d'identita' -> modello proposto da confermare -> processi con
 * decisione e motivazione.
 *
 * Due regole si vedono a schermo, non solo nel codice:
 *   R4  quando non c'e' un modello per quella combinazione, si dice, e si
 *       elencano le combinazioni che esistono. Mai un modello ripiegato.
 *   R1  togliere una decisione riporta al modello, e la riga lo scrive
 *       («come dice il modello»), non lascia una cella vuota che si legge
 *       «escluso».
 */
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
  ActivityClassification,
  EnterpriseSizeBand,
  OperatingModel,
  ModelProposalResponse,
  ProcessDecision,
  TenantBlueprintDetail,
  TenantBlueprintVersion,
} from "@heuresys/shared";
import { Button, Input, Spinner, EmptyState, ErrorState } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { StatusPill } from "@/components/status-pill";

const INCLUSIONI = ["IN", "PARTIAL", "OUT"] as const;

export default function TenantBlueprintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canWrite = perms.data?.permissions.includes("tenant_blueprint:write") ?? false;

  const fascicolo = useQuery({
    queryKey: ["tenant-blueprints", id],
    queryFn: () => apiFetch<TenantBlueprintDetail>(`/v1/tenant-blueprints/${id}`),
  });

  // La versione su cui si lavora e' quella aperta; se non ce n'e' una, la piu'
  // alta — cosi' un fascicolo gia' firmato resta leggibile invece di sparire.
  const versione: TenantBlueprintVersion | null = useMemo(() => {
    const v = fascicolo.data?.versions ?? [];
    return v.find((x) => x.status === "DRAFT" || x.status === "IN_APPROVAL") ?? v.at(-1) ?? null;
  }, [fascicolo.data]);

  const modificabile = canWrite && versione?.status === "DRAFT";
  const numero = versione?.number ?? 1;
  const base = `/v1/tenant-blueprints/${id}/versions/${numero}`;

  if (fascicolo.isLoading) return <Spinner />;
  if (fascicolo.isError) return <ErrorState description={t("dossier.error")} />;
  if (!fascicolo.data || !versione) return <EmptyState title={t("dossier.notFound")} />;

  return (
    <div className="space-y-6" data-testid="tenant-blueprint-detail">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/tenant-blueprints"
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            {t("dossier.back")}
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-foreground" data-testid="tenant-blueprint-name">
            {fascicolo.data.name}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">{fascicolo.data.code}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {t("dossier.version")} {versione.number}
          </span>
          <StatusPill tone={versione.status === "DRAFT" ? "info" : "success"}>
            {versione.status}
          </StatusPill>
          <Link
            href={`/tenant-blueprints/${id}/versions/${versione.number}/diff`}
            className="text-sm text-foreground underline-offset-2 hover:underline"
            data-testid="tenant-blueprint-diff-link"
          >
            {t("dossier.diff.title")}
          </Link>
        </div>
      </header>

      <PassoIdentita
        base={base}
        blueprintId={id}
        versione={versione}
        modificabile={modificabile}
        onSalvato={() => qc.invalidateQueries({ queryKey: ["tenant-blueprints", id] })}
      />

      <PassoModello base={base} versione={versione} modificabile={modificabile} blueprintId={id} />

      <PassoProcessi base={base} versione={versione} modificabile={modificabile} />

      {modificabile ? <Sottometti base={base} blueprintId={id} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ passo 1 */

function PassoIdentita({
  base,
  blueprintId,
  versione,
  modificabile,
  onSalvato,
}: {
  base: string;
  blueprintId: string;
  versione: TenantBlueprintVersion;
  modificabile: boolean;
  onSalvato: () => void;
}) {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const [ricerca, setRicerca] = useState("");
  const [bozza, setBozza] = useState(versione.identity);

  // La ricerca ATECO e' un CAMPO DI RICERCA e non un menu a tendina: il catalogo
  // ha 3.257 voci, e una tendina con 3.257 righe non e' un'interfaccia.
  const classificazioni = useQuery({
    queryKey: ["activity-classifications", ricerca],
    queryFn: () =>
      apiFetch<{ items: ActivityClassification[] }>(
        `/v1/activity-classifications?limit=20&search=${encodeURIComponent(ricerca)}`,
      ),
    enabled: ricerca.trim().length >= 2,
  });

  const fasce = useQuery({
    queryKey: ["enterprise-size-bands"],
    queryFn: () => apiFetch<{ items: EnterpriseSizeBand[] }>("/v1/enterprise-size-bands?limit=50"),
  });

  const modelli = useQuery({
    queryKey: ["operating-models"],
    queryFn: () => apiFetch<{ items: OperatingModel[] }>("/v1/operating-models?limit=50"),
  });

  const salva = useMutation({
    mutationFn: () => apiFetch(`${base}/identity`, { method: "PATCH", body: bozza }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tenant-blueprints", blueprintId] });
      await qc.invalidateQueries({ queryKey: ["model-proposal", base] });
      onSalvato();
    },
  });

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="passo-identita">
      <h2 className="text-sm font-semibold text-foreground">{t("dossier.steps.identity")}</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("dossier.identity.industry")}</span>
          <Input
            value={ricerca}
            placeholder={t("dossier.identity.industrySearch")}
            onChange={(e) => setRicerca(e.target.value)}
            disabled={!modificabile}
            data-testid="identita-ateco-ricerca"
          />
          {classificazioni.data ? (
            <select
              className="mt-1 rounded-md border border-border bg-background p-2 text-sm"
              value={bozza.industryClassId ?? ""}
              onChange={(e) => setBozza({ ...bozza, industryClassId: e.target.value || null })}
              disabled={!modificabile}
              data-testid="identita-ateco"
            >
              <option value="">—</option>
              {classificazioni.data.items.map((c) => (
                <option key={c.activityClassificationId} value={c.activityClassificationId}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("dossier.identity.sizeBand")}</span>
          <select
            className="rounded-md border border-border bg-background p-2 text-sm"
            value={bozza.sizeBandId ?? ""}
            onChange={(e) => setBozza({ ...bozza, sizeBandId: e.target.value || null })}
            disabled={!modificabile}
            data-testid="identita-fascia"
          >
            <option value="">—</option>
            {(fasce.data?.items ?? []).map((b) => (
              <option key={b.enterpriseSizeBandId} value={b.enterpriseSizeBandId}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("dossier.identity.operatingModel")}</span>
          <select
            className="rounded-md border border-border bg-background p-2 text-sm"
            value={bozza.operatingModelId ?? ""}
            onChange={(e) => setBozza({ ...bozza, operatingModelId: e.target.value || null })}
            disabled={!modificabile}
            data-testid="identita-modello-operativo"
          >
            <option value="">—</option>
            {(modelli.data?.items ?? []).map((m) => (
              <option key={m.operatingModelId} value={m.operatingModelId}>
                {m.code} — {m.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("dossier.identity.regulatory")}</span>
          <select
            className="rounded-md border border-border bg-background p-2 text-sm"
            value={bozza.regulatoryIntensity ?? ""}
            onChange={(e) =>
              setBozza({
                ...bozza,
                regulatoryIntensity: (e.target.value ||
                  null) as TenantBlueprintVersion["identity"]["regulatoryIntensity"],
              })
            }
            disabled={!modificabile}
            data-testid="identita-vigilanza"
          >
            <option value="">—</option>
            {["LOW", "MEDIUM", "HIGH", "EXTREME"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("dossier.identity.country")}</span>
          <Input
            value={bozza.countryCode ?? ""}
            maxLength={2}
            onChange={(e) => setBozza({ ...bozza, countryCode: e.target.value.toUpperCase() || null })}
            disabled={!modificabile}
            data-testid="identita-paese"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("dossier.identity.employees")}</span>
          <Input
            type="number"
            min={0}
            value={bozza.employeeCount ?? ""}
            onChange={(e) =>
              setBozza({ ...bozza, employeeCount: e.target.value === "" ? null : Number(e.target.value) })
            }
            disabled={!modificabile}
            data-testid="identita-dipendenti"
          />
        </label>
      </div>

      {modificabile ? (
        <Button
          className="mt-3"
          onClick={() => salva.mutate()}
          disabled={salva.isPending}
          data-testid="identita-salva"
        >
          {t("dossier.identity.save")}
        </Button>
      ) : null}
      {salva.isSuccess ? (
        <p className="mt-2 text-sm text-success" role="status" data-testid="identita-salvata">
          {t("dossier.identity.saved")}
        </p>
      ) : null}
    </section>
  );
}

/** I due predicati che separano le facce di `ModelProposalResponse`. */
function modelloTrovato(
  r: ModelProposalResponse | undefined,
): r is Extract<ModelProposalResponse, { available: true }> {
  return r !== undefined && r.available === true;
}
function modelloAssente(
  r: ModelProposalResponse | undefined,
): r is Extract<ModelProposalResponse, { available: false }> {
  return r !== undefined && r.available === false;
}

/* ------------------------------------------------------------------ passo 2 */

function PassoModello({
  base,
  blueprintId,
  versione,
  modificabile,
}: {
  base: string;
  blueprintId: string;
  versione: TenantBlueprintVersion;
  modificabile: boolean;
}) {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();

  const completa = Boolean(versione.identity.industryClassId && versione.identity.sizeBandId);

  const proposta = useQuery({
    queryKey: ["model-proposal", base],
    queryFn: () => apiFetch<ModelProposalResponse>(`${base}/model-proposal`),
    enabled: completa,
  });

  const ancora = useMutation({
    mutationFn: (variantVersionId: string) =>
      apiFetch(`${base}/model`, { method: "PUT", body: { variantVersionId } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tenant-blueprints", blueprintId] });
      await qc.invalidateQueries({ queryKey: ["processi", base] });
    },
  });

  // Le due facce dell'unione si estraggono QUI: dentro un callback JSX il
  // restringimento fatto nella condizione di un ternario non sopravvive.
  // Le due facce dell'unione si separano con due predicati espliciti: il
  // restringimento fatto dentro un ternario non sopravvive ai callback JSX che
  // leggono i campi piu' sotto, e senza predicato TypeScript vede l'unione
  // intera su ogni accesso.
  const risposta = proposta.data;
  const disponibile = modelloTrovato(risposta) ? risposta : null;
  const assente = modelloAssente(risposta) ? risposta : null;

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="passo-modello">
      <h2 className="text-sm font-semibold text-foreground">{t("dossier.steps.model")}</h2>

      {!completa ? (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="modello-identita-incompleta">
          {t("dossier.identity.incomplete")}
        </p>
      ) : proposta.isLoading ? (
        <Spinner />
      ) : disponibile ? (
        <div className="mt-2 space-y-2" data-testid="modello-proposto">
          <p className="text-sm text-foreground">
            <span className="font-medium">{disponibile.variantName}</span>{" "}
            <span className="font-mono text-xs text-muted-foreground">
              {`${disponibile.variantCode} v${disponibile.versionNumber}`}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dossier.proposal.processCount", { count: disponibile.processCount })} ·{" "}
            {disponibile.matchedOn.industryFamilyCode} / {disponibile.matchedOn.sizeBandCode}
          </p>
          {modificabile && versione.variantVersionId !== disponibile.variantVersionId ? (
            <Button
              onClick={() => ancora.mutate(disponibile.variantVersionId)}
              disabled={ancora.isPending}
              data-testid="modello-ancora"
            >
              {t("dossier.proposal.confirm")}
            </Button>
          ) : null}
          {versione.variantVersionId ? (
            <p className="text-sm text-success" data-testid="modello-ancorato">
              {t("dossier.proposal.confirmed")}
            </p>
          ) : null}
        </div>
      ) : assente ? (
        // R4 a schermo: si dice che non c'e', si spiega perche', e si elenca
        // cio' che esiste. Nessun ripiego sul modello piu' somigliante.
        <div className="mt-2 space-y-2" data-testid="modello-non-disponibile">
          <p className="text-sm font-medium text-foreground">{t("dossier.proposal.unavailable")}</p>
          <p className="text-sm text-muted-foreground">{assente.reason}</p>
          <p className="text-xs text-muted-foreground">{t("dossier.proposal.noFallback")}</p>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t("dossier.proposal.availableTitle")}
            </p>
            <ul className="mt-1 space-y-1">
              {assente.availableCombinations.map((c) => (
                <li key={c.variantCode} className="font-mono text-xs text-muted-foreground">
                  {c.industryFamilyCode} / {c.sizeBandCode} → {c.variantCode}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ passo 3 */

function PassoProcessi({
  base,
  versione,
  modificabile,
}: {
  base: string;
  versione: TenantBlueprintVersion;
  modificabile: boolean;
}) {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();

  const processi = useQuery({
    queryKey: ["processi", base],
    queryFn: () => apiFetch<{ items: ProcessDecision[] }>(`${base}/processes`),
    enabled: Boolean(versione.variantVersionId),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="passo-processi">
      <h2 className="text-sm font-semibold text-foreground">{t("dossier.steps.processes")}</h2>

      {!versione.variantVersionId ? (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="processi-vuoto">
          {t("dossier.decisions.empty")}
        </p>
      ) : processi.isLoading ? (
        <Spinner />
      ) : (
        <ul className="mt-3 space-y-3">
          {(processi.data?.items ?? []).map((p) => (
            <RigaProcesso
              key={p.processId}
              base={base}
              processo={p}
              modificabile={modificabile}
              onCambiato={() => qc.invalidateQueries({ queryKey: ["processi", base] })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RigaProcesso({
  base,
  processo,
  modificabile,
  onCambiato,
}: {
  base: string;
  processo: ProcessDecision;
  modificabile: boolean;
  onCambiato: () => void;
}) {
  const { t } = useTranslation("blueprints");
  const [inclusion, setInclusion] = useState(processo.inclusion ?? "IN");
  const [rationale, setRationale] = useState(processo.rationale ?? "");

  const salva = useMutation({
    mutationFn: () =>
      apiFetch(`${base}/processes/${processo.processId}`, {
        method: "PUT",
        body: { inclusion, rationale },
      }),
    onSuccess: onCambiato,
  });

  const togli = useMutation({
    mutationFn: () =>
      apiFetch(`${base}/processes/${processo.processId}`, { method: "DELETE" }),
    onSuccess: onCambiato,
  });

  return (
    <li className="rounded-md border border-border p-3" data-testid="processo-riga">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-foreground">{processo.processName}</span>{" "}
          <span className="font-mono text-xs text-muted-foreground">{processo.processCode}</span>
        </div>
        {/* R1 a schermo: nessuna decisione NON e' «fuori», e' «come dice il modello». */}
        {processo.inclusion === null ? (
          <span className="text-xs uppercase text-muted-foreground" data-testid="processo-dal-modello">
            {t("dossier.decisions.fromModel")}
          </span>
        ) : (
          <StatusPill tone={processo.inclusion === "OUT" ? "warning" : "success"}>
            {processo.inclusion}
          </StatusPill>
        )}
      </div>

      {modificabile ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <select
            className="rounded-md border border-border bg-background p-2 text-sm"
            value={inclusion}
            onChange={(e) => setInclusion(e.target.value as ProcessDecision["inclusion"] & string)}
            data-testid="processo-inclusione"
          >
            {INCLUSIONI.map((v) => (
              <option key={v} value={v}>
                {t(`dossier.decisions.${v.toLowerCase()}`)}
              </option>
            ))}
          </select>
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("dossier.decisions.rationale")}</span>
            <Input
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              data-testid="processo-motivazione"
            />
          </label>
          {/* Il pulsante resta spento finche' la motivazione e' vuota: la regola
              del prodotto, resa impossibile da aggirare a schermo. */}
          <Button
            onClick={() => salva.mutate()}
            disabled={salva.isPending || rationale.trim().length === 0}
            data-testid="processo-salva"
          >
            {t("dossier.decisions.save")}
          </Button>
          {processo.inclusion !== null ? (
            <Button
              variant="ghost"
              onClick={() => togli.mutate()}
              disabled={togli.isPending}
              data-testid="processo-togli"
            >
              {t("dossier.decisions.clear")}
            </Button>
          ) : null}
        </div>
      ) : processo.rationale ? (
        <p className="mt-1 text-sm text-muted-foreground">{processo.rationale}</p>
      ) : null}
    </li>
  );
}

/* ----------------------------------------------------------------- la firma */

function Sottometti({ base, blueprintId }: { base: string; blueprintId: string }) {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const [errore, setErrore] = useState<string | null>(null);

  const invia = useMutation({
    mutationFn: () => apiFetch(`${base}/submit`, { method: "POST" }),
    onSuccess: async () => {
      setErrore(null);
      await qc.invalidateQueries({ queryKey: ["tenant-blueprints", blueprintId] });
    },
    onError: (e: unknown) => setErrore(e instanceof Error ? e.message : String(e)),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <Button onClick={() => invia.mutate()} disabled={invia.isPending} data-testid="fascicolo-sottometti">
        {t("dossier.submit.action")}
      </Button>
      {invia.isSuccess ? (
        <p className="mt-2 text-sm text-success" role="status" data-testid="fascicolo-sottomesso">
          {t("dossier.submit.done")}
        </p>
      ) : null}
      {errore ? (
        <p className="mt-2 text-sm text-danger" data-testid="fascicolo-sottometti-errore">
          {errore}
        </p>
      ) : null}
    </section>
  );
}
