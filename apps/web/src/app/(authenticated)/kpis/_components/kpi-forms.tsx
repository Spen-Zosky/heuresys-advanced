"use client";

/**
 * KPI: creazione e modifica dal catalogo (#43 — linea C2).
 *
 * `POST`/`PATCH`/`DELETE /v1/kpi-definitions` esistevano da MVP-1 e nessuna
 * pagina li chiamava: un indicatore si definiva o si correggeva solo da
 * database.
 *
 * Come per le competenze: `isGlobal` (indicatore valido per tutti i clienti)
 * lo impone il service e la casella compare solo a chi può davvero usarlo;
 * `code` è immutabile e si mostra disabilitato.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { KpiDefinition, KpiPolarity } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lista locale: il web importa TIPI, non valori.
const POLARITIES: readonly KpiPolarity[] = ["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "TARGET_RANGE"];

interface KpiForm {
  code: string;
  name: string;
  description: string;
  formula: string;
  unit: string;
  polarity: KpiPolarity;
  isGlobal: boolean;
}

const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

function messaggioErrore(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("kpis.form.forbidden");
    if (err.status === 409) return t("kpis.form.duplicate");
  }
  return t("kpis.form.saveError");
}

/* --- creazione ---------------------------------------------------------- */

export function KpiCreator() {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canCreate = perms.has("kpi:create");
  const canGlobal = perms.has("tenant:create") || perms.has("platform:manage");
  // Chiuso di default, come gli altri cataloghi: la pagina si apre per
  // consultare, non per inserire.
  const [aperto, setAperto] = useState(false);

  const { register, handleSubmit, reset } = useForm<KpiForm>({
    defaultValues: {
      code: "", name: "", description: "", formula: "", unit: "",
      polarity: "HIGHER_IS_BETTER", isGlobal: false,
    },
  });

  const create = useMutation({
    mutationFn: (v: KpiForm) =>
      apiFetch<KpiDefinition>("/v1/kpi-definitions", {
        method: "POST",
        body: {
          code: v.code.trim(),
          name: v.name.trim(),
          description: orNull(v.description),
          formula: orNull(v.formula),
          unit: orNull(v.unit),
          polarity: v.polarity,
          isGlobal: canGlobal ? v.isGlobal : false,
        },
      }),
    onSuccess: () => {
      reset({ code: "", name: "", description: "", formula: "", unit: "", polarity: "HIGHER_IS_BETTER", isGlobal: false });
      void qc.invalidateQueries({ queryKey: ["kpi-definitions"] });
    },
  });

  if (!canCreate) return null;

  return (
    <Card data-testid="kpi-creator">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{t("kpis.form.createTitle")}</span>
          <Button type="button" variant="outline" data-testid="kpi-create-toggle" onClick={() => setAperto((v) => !v)}>
            {aperto ? t("kpis.form.close") : t("kpis.form.create")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent hidden={!aperto}>
        <form
          data-testid="kpi-create-form"
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          noValidate
          onSubmit={(e) => {
            void handleSubmit((v) => create.mutateAsync(v).catch(() => undefined))(e);
          }}
        >
          <div>
            <label htmlFor="kpi-code" className="mb-1 block text-sm font-medium text-foreground">
              {t("shared.code")} <span aria-hidden="true">*</span>
            </label>
            <Input id="kpi-code" data-testid="kpi-create-code" {...register("code", { required: true, maxLength: 128 })} />
          </div>
          <div>
            <label htmlFor="kpi-name" className="mb-1 block text-sm font-medium text-foreground">
              {t("shared.name")} <span aria-hidden="true">*</span>
            </label>
            <Input id="kpi-name" data-testid="kpi-create-name" {...register("name", { required: true, maxLength: 255 })} />
          </div>
          <div>
            <label htmlFor="kpi-unit" className="mb-1 block text-sm font-medium text-foreground">
              {t("kpis.cols.unit")}
            </label>
            <Input id="kpi-unit" data-testid="kpi-create-unit" {...register("unit", { maxLength: 64 })} />
          </div>
          <div>
            <label htmlFor="kpi-polarity" className="mb-1 block text-sm font-medium text-foreground">
              {t("kpis.cols.polarity")}
            </label>
            <select id="kpi-polarity" data-testid="kpi-create-polarity" className={SELECT_CLASS} {...register("polarity")}>
              {POLARITIES.map((p) => (
                <option key={p} value={p}>
                  {enumLabel("kpiPolarity", p)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="kpi-formula" className="mb-1 block text-sm font-medium text-foreground">
              {t("kpis.form.formula")}
            </label>
            <Input id="kpi-formula" data-testid="kpi-create-formula" {...register("formula", { maxLength: 2048 })} />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="kpi-desc" className="mb-1 block text-sm font-medium text-foreground">
              {t("kpis.form.description")}
            </label>
            <Input id="kpi-desc" data-testid="kpi-create-description" {...register("description", { maxLength: 2048 })} />
          </div>
          {canGlobal && (
            <div className="flex items-center gap-2 md:col-span-3">
              <input
                id="kpi-global"
                type="checkbox"
                data-testid="kpi-create-global"
                className="h-4 w-4 rounded border-border"
                {...register("isGlobal")}
              />
              <label htmlFor="kpi-global" className="text-sm font-medium text-foreground">
                {t("kpis.form.isGlobal")}
              </label>
            </div>
          )}
          <div className="flex items-center gap-3 md:col-span-3">
            <Button type="submit" data-testid="kpi-create-submit" disabled={create.isPending}>
              {create.isPending ? t("common:saving") : t("kpis.form.create")}
            </Button>
            {create.isError && (
              <span data-testid="kpi-create-error" className="text-sm text-danger">
                {messaggioErrore(create.error, t)}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* --- modifica ----------------------------------------------------------- */

export function KpiEditor({ kpiId, onClose }: { kpiId: string; onClose: () => void }) {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canUpdate = perms.has("kpi:update");

  const kpi = useQuery({
    queryKey: ["kpi-definitions", kpiId],
    queryFn: () => apiFetch<KpiDefinition>(`/v1/kpi-definitions/${kpiId}`),
    enabled: !!kpiId,
  });

  const { register, handleSubmit, formState } = useForm<KpiForm>({
    values: kpi.data
      ? {
          code: kpi.data.code,
          name: kpi.data.name,
          description: kpi.data.description ?? "",
          formula: kpi.data.formula ?? "",
          unit: kpi.data.unit ?? "",
          polarity: kpi.data.polarity,
          isGlobal: kpi.data.isGlobal,
        }
      : undefined,
  });

  const save = useMutation({
    mutationFn: (v: KpiForm) =>
      apiFetch<KpiDefinition>(`/v1/kpi-definitions/${kpiId}`, {
        method: "PATCH",
        body: {
          name: v.name.trim(),
          description: orNull(v.description),
          formula: orNull(v.formula),
          unit: orNull(v.unit),
          polarity: v.polarity,
        },
      }),
    onSuccess: (next) => {
      qc.setQueryData(["kpi-definitions", kpiId], next);
      void qc.invalidateQueries({ queryKey: ["kpi-definitions", "list"] });
    },
  });

  if (kpi.isLoading || kpi.isError) return null;

  return (
    <Card data-testid="kpi-editor">
      <CardHeader>
        <CardTitle>
          {t("kpis.form.editTitle")}
          <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">{kpi.data!.code}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!canUpdate && (
          <p data-testid="kpi-edit-readonly" className="text-sm text-muted-foreground">
            {t("kpis.form.readOnly")}
          </p>
        )}
        {canUpdate && (
          <form
            data-testid="kpi-edit-form"
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
            noValidate
            onSubmit={(e) => {
              void handleSubmit((v) => save.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div>
              <label htmlFor="kpi-edit-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.code")}
              </label>
              <Input id="kpi-edit-code" data-testid="kpi-edit-code" disabled {...register("code")} />
              <p className="mt-1 text-xs text-muted-foreground">{t("kpis.form.codeImmutable")}</p>
            </div>
            <div>
              <label htmlFor="kpi-edit-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="kpi-edit-name" data-testid="kpi-edit-name" {...register("name", { required: true, maxLength: 255 })} />
            </div>
            <div>
              <label htmlFor="kpi-edit-unit" className="mb-1 block text-sm font-medium text-foreground">
                {t("kpis.cols.unit")}
              </label>
              <Input id="kpi-edit-unit" data-testid="kpi-edit-unit" {...register("unit", { maxLength: 64 })} />
            </div>
            <div>
              <label htmlFor="kpi-edit-polarity" className="mb-1 block text-sm font-medium text-foreground">
                {t("kpis.cols.polarity")}
              </label>
              <select id="kpi-edit-polarity" data-testid="kpi-edit-polarity" className={SELECT_CLASS} {...register("polarity")}>
                {POLARITIES.map((p) => (
                  <option key={p} value={p}>
                    {enumLabel("kpiPolarity", p)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="kpi-edit-formula" className="mb-1 block text-sm font-medium text-foreground">
                {t("kpis.form.formula")}
              </label>
              <Input id="kpi-edit-formula" data-testid="kpi-edit-formula" {...register("formula", { maxLength: 2048 })} />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="kpi-edit-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("kpis.form.description")}
              </label>
              <Input id="kpi-edit-desc" data-testid="kpi-edit-description" {...register("description", { maxLength: 2048 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-3">
              <Button type="submit" data-testid="kpi-edit-save" disabled={save.isPending}>
                {save.isPending ? t("common:saving") : t("kpis.form.save")}
              </Button>
              <Button type="button" variant="outline" data-testid="kpi-edit-close" onClick={onClose}>
                {t("kpis.form.close")}
              </Button>
              {save.isSuccess && !formState.isDirty && (
                <span data-testid="kpi-edit-saved" className="text-sm text-muted-foreground">
                  {t("kpis.form.saved")}
                </span>
              )}
              {save.isError && (
                <span data-testid="kpi-edit-error" className="text-sm text-danger">
                  {messaggioErrore(save.error, t)}
                </span>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
