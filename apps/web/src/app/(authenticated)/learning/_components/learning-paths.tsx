"use client";

/**
 * Percorsi formativi e i loro passi (#43 — linea C2).
 *
 * `learning-paths` (5 endpoint) e `learning-path-steps` (5) erano gli ultimi
 * due moduli del catalogo formativo senza interfaccia: un percorso — la
 * sequenza ordinata di corsi che porta a un risultato — si componeva solo da
 * database.
 *
 * I passi vivono DENTRO il percorso aperto, perché è lì che hanno senso: un
 * passo è "il terzo corso di questo percorso", non un'entità a sé.
 *
 * L'ordine è un numero esplicito e non un trascinamento: l'API espone
 * `ordinal` e cambiarlo è l'operazione vera. Una riordinabilità finta, che poi
 * non si salva, sarebbe peggio di un campo numerico onesto.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { LearningModule, LearningPath, LearningPathStep } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const LIST_LIMIT = 200;

const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

function messaggioErrore(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.code === "TENANT_ID_REQUIRED") return t("learning.paths.tenantRequired");
    if (err.status === 403) return t("learning.paths.forbidden");
    if (err.status === 409) return t("learning.paths.duplicate");
  }
  return t("learning.paths.saveError");
}

interface PathForm {
  code: string;
  name: string;
  description: string;
  targetOutcome: string;
  isGlobal: boolean;
}

export function LearningPathsPanel() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canCreate = perms.has("learning:create");
  const canUpdate = perms.has("learning:update");
  const canGlobal = perms.has("tenant:create") || perms.has("platform:manage");

  const [editing, setEditing] = useState<LearningPath | null>(null);
  const [aperto, setAperto] = useState(false);
  const [cerca, setCerca] = useState("");

  const paths = useQuery({
    queryKey: ["learning-paths", "list", cerca],
    queryFn: () =>
      apiFetch<{ items: LearningPath[] }>(
        `/v1/learning-paths?limit=${LIST_LIMIT}${cerca.trim() ? `&search=${encodeURIComponent(cerca.trim())}` : ""}`,
      ),
  });

  const createForm = useForm<PathForm>({
    defaultValues: { code: "", name: "", description: "", targetOutcome: "", isGlobal: false },
  });
  const editForm = useForm<PathForm>({
    values: editing
      ? {
          code: editing.code,
          name: editing.name,
          description: editing.description ?? "",
          targetOutcome: editing.targetOutcome ?? "",
          isGlobal: editing.isGlobal,
        }
      : undefined,
  });

  const create = useMutation({
    mutationFn: (v: PathForm) =>
      apiFetch<LearningPath>("/v1/learning-paths", {
        method: "POST",
        body: {
          code: v.code.trim(),
          name: v.name.trim(),
          description: orNull(v.description),
          targetOutcome: orNull(v.targetOutcome),
          isGlobal: canGlobal ? v.isGlobal : false,
        },
      }),
    onSuccess: () => {
      createForm.reset({ code: "", name: "", description: "", targetOutcome: "", isGlobal: false });
      setAperto(false);
      void qc.invalidateQueries({ queryKey: ["learning-paths"] });
    },
  });

  const save = useMutation({
    mutationFn: (v: PathForm) =>
      apiFetch<LearningPath>(`/v1/learning-paths/${editing!.learningPathId}`, {
        method: "PATCH",
        body: { name: v.name.trim(), description: orNull(v.description), targetOutcome: orNull(v.targetOutcome) },
      }),
    onSuccess: (next) => {
      setEditing(next);
      void qc.invalidateQueries({ queryKey: ["learning-paths"] });
    },
  });

  const columns: DataColumn<LearningPath>[] = [
    { header: t("shared.code"), cell: (p) => <span className="font-mono text-xs">{p.code}</span> },
    { header: t("shared.name"), cell: (p) => <span className="font-medium text-foreground">{p.name}</span> },
    {
      header: t("learning.paths.targetOutcome"),
      cell: (p) => <span className="text-sm text-muted-foreground">{p.targetOutcome ?? t("learning.paths.dash")}</span>,
    },
    {
      header: t("common:table.actions"),
      cell: (p) => (
        <Button type="button" variant="outline" data-testid={`path-open-${p.code}`} onClick={() => setEditing(p)}>
          {t("learning.paths.open")}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card data-testid="learning-paths-panel">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>
              {t("learning.paths.title")}
              <span className="ml-2 text-sm font-normal text-muted-foreground">{paths.data?.items.length ?? 0}</span>
            </span>
            {canCreate && (
              <Button type="button" variant="outline" data-testid="path-create-toggle" onClick={() => setAperto((v) => !v)}>
                {aperto ? t("learning.paths.close") : t("learning.paths.create")}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <label htmlFor="lp-search" className="mb-1 block text-sm font-medium text-foreground">
              {t("learning.paths.search")}
            </label>
            <Input
              id="lp-search"
              data-testid="path-search"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder={t("learning.paths.searchPlaceholder")}
            />
          </div>

          <EntityTable<LearningPath>
            isLoading={paths.isLoading}
            isError={paths.isError}
            errorMessage={t("learning.paths.loadError")}
            rows={paths.data?.items ?? []}
            rowKey={(p) => p.learningPathId}
            rowTestId="learning-path-row"
            columns={columns}
            emptyTestId="learning-paths-empty"
            emptyTitle={t("learning.paths.emptyTitle")}
            caption={t("learning.paths.caption")}
          />

          {canCreate && aperto && (
            <form
              data-testid="path-create-form"
              className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-2"
              noValidate
              onSubmit={(e) => {
                void createForm.handleSubmit((v) => create.mutateAsync(v).catch(() => undefined))(e);
              }}
            >
              <div>
                <label htmlFor="lp-code" className="mb-1 block text-sm font-medium text-foreground">
                  {t("shared.code")} <span aria-hidden="true">*</span>
                </label>
                <Input id="lp-code" data-testid="path-create-code" {...createForm.register("code", { required: true, maxLength: 128 })} />
              </div>
              <div>
                <label htmlFor="lp-name" className="mb-1 block text-sm font-medium text-foreground">
                  {t("shared.name")} <span aria-hidden="true">*</span>
                </label>
                <Input id="lp-name" data-testid="path-create-name" {...createForm.register("name", { required: true, maxLength: 255 })} />
              </div>
              <div>
                <label htmlFor="lp-outcome" className="mb-1 block text-sm font-medium text-foreground">
                  {t("learning.paths.targetOutcome")}
                </label>
                <Input id="lp-outcome" data-testid="path-create-outcome" {...createForm.register("targetOutcome", { maxLength: 4096 })} />
              </div>
              <div>
                <label htmlFor="lp-desc" className="mb-1 block text-sm font-medium text-foreground">
                  {t("learning.form.description")}
                </label>
                <Input id="lp-desc" data-testid="path-create-description" {...createForm.register("description", { maxLength: 4096 })} />
              </div>
              {canGlobal && (
                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    id="lp-global"
                    type="checkbox"
                    data-testid="path-create-global"
                    className="h-4 w-4 rounded border-border"
                    {...createForm.register("isGlobal")}
                  />
                  <label htmlFor="lp-global" className="text-sm font-medium text-foreground">
                    {t("learning.paths.isGlobal")}
                  </label>
                </div>
              )}
              <div className="flex items-center gap-3 md:col-span-2">
                <Button type="submit" data-testid="path-create-submit" disabled={create.isPending}>
                  {create.isPending ? t("common:saving") : t("learning.paths.create")}
                </Button>
                {create.isError && (
                  <span data-testid="path-create-error" className="text-sm text-danger">
                    {messaggioErrore(create.error, t)}
                  </span>
                )}
              </div>
            </form>
          )}

          {editing && canUpdate && (
            <form
              data-testid="path-edit-form"
              className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-2"
              noValidate
              onSubmit={(e) => {
                void editForm.handleSubmit((v) => save.mutateAsync(v).catch(() => undefined))(e);
              }}
            >
              <div>
                <label htmlFor="lp-edit-code" className="mb-1 block text-sm font-medium text-foreground">
                  {t("shared.code")}
                </label>
                <Input id="lp-edit-code" data-testid="path-edit-code" disabled {...editForm.register("code")} />
                <p className="mt-1 text-xs text-muted-foreground">{t("learning.form.codeImmutable")}</p>
              </div>
              <div>
                <label htmlFor="lp-edit-name" className="mb-1 block text-sm font-medium text-foreground">
                  {t("shared.name")} <span aria-hidden="true">*</span>
                </label>
                <Input id="lp-edit-name" data-testid="path-edit-name" {...editForm.register("name", { required: true, maxLength: 255 })} />
              </div>
              <div>
                <label htmlFor="lp-edit-outcome" className="mb-1 block text-sm font-medium text-foreground">
                  {t("learning.paths.targetOutcome")}
                </label>
                <Input id="lp-edit-outcome" data-testid="path-edit-outcome" {...editForm.register("targetOutcome", { maxLength: 4096 })} />
              </div>
              <div>
                <label htmlFor="lp-edit-desc" className="mb-1 block text-sm font-medium text-foreground">
                  {t("learning.form.description")}
                </label>
                <Input id="lp-edit-desc" data-testid="path-edit-description" {...editForm.register("description", { maxLength: 4096 })} />
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <Button type="submit" data-testid="path-edit-save" disabled={save.isPending}>
                  {save.isPending ? t("common:saving") : t("learning.paths.save")}
                </Button>
                <Button type="button" variant="outline" data-testid="path-edit-close" onClick={() => setEditing(null)}>
                  {t("learning.paths.close")}
                </Button>
                {save.isError && (
                  <span data-testid="path-edit-error" className="text-sm text-danger">
                    {messaggioErrore(save.error, t)}
                  </span>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {editing && <LearningPathStepsPanel path={editing} />}
    </>
  );
}

/** Il titolo di UN modulo, risolto per identificativo: l'elenco generale e'
 *  troncato e non puo' fare da dizionario su un catalogo di oltre mille voci. */
function NomeModulo({ id }: { id: string }) {
  const modulo = useQuery({
    queryKey: ["learning-modules", id],
    queryFn: () => apiFetch<LearningModule>(`/v1/learning-modules/${id}`),
  });
  return (
    <span className="font-medium text-foreground" data-testid="step-module-name">
      {modulo.data?.title ?? id.slice(0, 8)}
    </span>
  );
}

/* --- passi del percorso -------------------------------------------------- */

function LearningPathStepsPanel({ path }: { path: LearningPath }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canWrite = perms.has("learning:update");
  const canDelete = perms.has("learning:delete");

  const [moduleId, setModuleId] = useState("");
  const [ordinal, setOrdinal] = useState("");

  const key = ["learning-path-steps", path.learningPathId] as const;
  const steps = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<{ items: LearningPathStep[] }>(`/v1/learning-path-steps?pathId=${path.learningPathId}&limit=${LIST_LIMIT}`),
  });
  // Il modulo da aggiungere si CERCA: il catalogo ne ha oltre mille e un
  // menu' a tendina troncato a 200 nasconde proprio quelli appena creati
  // (misurato: il collaudo e' andato rosso esattamente cosi').
  const [cercaModulo, setCercaModulo] = useState("");
  const risultati = useQuery({
    queryKey: ["learning-modules", "step-picker", cercaModulo],
    queryFn: () =>
      apiFetch<{ items: LearningModule[] }>(
        `/v1/learning-modules?limit=20&search=${encodeURIComponent(cercaModulo.trim())}`,
      ),
    enabled: canWrite && cercaModulo.trim().length >= 2,
  });

  const add = useMutation({
    mutationFn: () =>
      apiFetch<LearningPathStep>("/v1/learning-path-steps", {
        method: "POST",
        body: {
          pathId: path.learningPathId,
          moduleId,
          // Ordine vuoto = in coda: si calcola dal massimo esistente, così chi
          // compila non deve conoscere la numerazione interna.
          ordinal:
            ordinal.trim() === ""
              ? Math.max(0, ...(steps.data?.items ?? []).map((s) => s.ordinal)) + 1
              : Number(ordinal),
        },
      }),
    onSuccess: () => {
      setModuleId("");
      setOrdinal("");
      setCercaModulo("");
      void qc.invalidateQueries({ queryKey: key });
    },
  });

  const remove = useMutation({
    mutationFn: (stepId: string) => apiFetch<void>(`/v1/learning-path-steps/${stepId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const cambiaOrdine = (stepId: string, ordinal: number) =>
    apiFetch<LearningPathStep>(`/v1/learning-path-steps/${stepId}`, {
      method: "PATCH",
      body: { ordinal },
    });

  /**
   * Scambio di due passi in TRE mosse, e non in una.
   *
   * `(percorso, ordine)` è UNICO sul database
   * (`sys_learning_path_steps_path_ordinal_uq`): assegnare a un passo l'ordine
   * di un altro risponde 409, sempre. Quindi il passo che sale parcheggia su
   * un ordine libero, l'altro prende il posto lasciato, e il primo scende
   * nella posizione voluta.
   *
   * Se una delle tre mosse fallisce l'ordine resta coerente ma con un passo
   * parcheggiato in fondo: visibile e correggibile dalla stessa interfaccia,
   * mai un ordine duplicato.
   */
  const riordina = useMutation({
    mutationFn: async (v: { sopra: LearningPathStep; sotto: LearningPathStep }) => {
      const libero = Math.max(...items.map((s) => s.ordinal)) + 1;
      await cambiaOrdine(v.sotto.learningPathStepId, libero);
      await cambiaOrdine(v.sopra.learningPathStepId, v.sotto.ordinal);
      await cambiaOrdine(v.sotto.learningPathStepId, v.sopra.ordinal);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const items = [...(steps.data?.items ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  const errore = add.isError ? add.error : remove.isError ? remove.error : riordina.isError ? riordina.error : null;

  return (
    <Card data-testid="learning-path-steps-panel">
      <CardHeader>
        <CardTitle>
          {t("learning.steps.title")}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {path.name} · {items.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.isLoading && <p className="text-sm text-muted-foreground">{t("common:loading")}</p>}
        {!steps.isLoading && items.length === 0 && (
          <p data-testid="learning-steps-empty" className="text-sm text-muted-foreground">
            {t("learning.steps.empty")}
          </p>
        )}

        {items.length > 0 && (
          <ol className="space-y-2" data-testid="learning-steps-list">
            {items.map((s, i) => (
              <li key={s.learningPathStepId} className="flex flex-wrap items-center gap-3 text-sm" data-testid="learning-step-row">
                <span className="w-8 font-mono text-xs text-muted-foreground">{s.ordinal}</span>
                <NomeModulo id={s.moduleId} />
                {canWrite && i > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid={`step-up-${s.ordinal}`}
                    disabled={riordina.isPending}
                    onClick={() => riordina.mutate({ sopra: items[i - 1]!, sotto: s })}
                  >
                    {t("learning.steps.moveUp")}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid={`step-delete-${s.ordinal}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(s.learningPathStepId)}
                  >
                    {t("learning.steps.remove")}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}

        {canWrite && (
          <div className="flex flex-wrap items-end gap-3 border-t pt-3" data-testid="learning-step-add">
            <div className="min-w-56 flex-1">
              <label htmlFor="step-search" className="mb-1 block text-sm font-medium text-foreground">
                {t("learning.steps.searchModule")}
              </label>
              <Input
                id="step-search"
                data-testid="step-module-search"
                value={cercaModulo}
                onChange={(e) => setCercaModulo(e.target.value)}
                placeholder={t("learning.steps.searchModulePlaceholder")}
              />
            </div>
            <div className="min-w-56 flex-1">
              <label htmlFor="step-module" className="mb-1 block text-sm font-medium text-foreground">
                {t("learning.steps.module")}
              </label>
              <select id="step-module" data-testid="step-module" className={SELECT_CLASS} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
                <option value="">{t("learning.steps.pickModule")}</option>
                {(risultati.data?.items ?? []).map((m) => (
                  <option key={m.learningModuleId} value={m.learningModuleId}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label htmlFor="step-ordinal" className="mb-1 block text-sm font-medium text-foreground">
                {t("learning.steps.ordinal")}
              </label>
              <Input
                id="step-ordinal"
                type="number"
                min="0"
                data-testid="step-ordinal"
                value={ordinal}
                onChange={(e) => setOrdinal(e.target.value)}
                placeholder={t("learning.steps.ordinalAuto")}
              />
            </div>
            <Button type="button" data-testid="step-add-submit" disabled={add.isPending || moduleId === ""} onClick={() => add.mutate()}>
              {add.isPending ? t("common:saving") : t("learning.steps.add")}
            </Button>
          </div>
        )}

        {errore && (
          <p data-testid="learning-steps-error" className="text-sm text-danger">
            {messaggioErrore(errore, t)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
