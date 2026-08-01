"use client";

/**
 * Moduli formativi: creazione e modifica dal catalogo (#43 — linea C2).
 *
 * `POST`/`PATCH`/`DELETE /v1/learning-modules` esistevano da MVP-1 e nessuna
 * pagina li chiamava: un corso si inseriva a catalogo solo da database.
 *
 * Stesse due autorità lasciate all'API degli altri cataloghi: `isGlobal` lo
 * impone il service (la casella compare solo a chi può usarla) e `code` è
 * immutabile (mostrato disabilitato).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { LearningDelivery, LearningKind, LearningModule } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Liste locali: il web importa TIPI, non valori.
const KINDS: readonly LearningKind[] = [
  "COURSE", "MICRO_LESSON", "LAB", "WORKSHOP", "CERTIFICATION_PREP", "COACHING",
];
const DELIVERIES: readonly LearningDelivery[] = ["SELF_PACED", "INSTRUCTOR_LED", "BLENDED", "ON_THE_JOB"];

interface ModuleForm {
  code: string;
  title: string;
  description: string;
  kind: LearningKind;
  delivery: LearningDelivery;
  durationMinutes: string;
  isGlobal: boolean;
}

const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

function messaggioErrore(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("learning.form.forbidden");
    if (err.status === 409) return t("learning.form.duplicate");
  }
  return t("learning.form.saveError");
}

/** Durata: campo vuoto = "non indicata" (null), NON zero — che direbbe
 *  "dura zero minuti". Il numero si invia come numero, non come stringa. */
const durata = (v: string): number | null => (v.trim() === "" ? null : Number(v));

/* --- creazione ---------------------------------------------------------- */

export function LearningModuleCreator() {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canCreate = perms.has("learning:create");
  const canGlobal = perms.has("tenant:create") || perms.has("platform:manage");
  // Chiuso di default, come gli altri cataloghi.
  const [aperto, setAperto] = useState(false);

  const { register, handleSubmit, reset } = useForm<ModuleForm>({
    defaultValues: {
      code: "", title: "", description: "", kind: "COURSE",
      delivery: "SELF_PACED", durationMinutes: "", isGlobal: false,
    },
  });

  const create = useMutation({
    mutationFn: (v: ModuleForm) =>
      apiFetch<LearningModule>("/v1/learning-modules", {
        method: "POST",
        body: {
          code: v.code.trim(),
          title: v.title.trim(),
          description: orNull(v.description),
          kind: v.kind,
          delivery: v.delivery,
          durationMinutes: durata(v.durationMinutes),
          isGlobal: canGlobal ? v.isGlobal : false,
        },
      }),
    onSuccess: () => {
      reset({ code: "", title: "", description: "", kind: "COURSE", delivery: "SELF_PACED", durationMinutes: "", isGlobal: false });
      void qc.invalidateQueries({ queryKey: ["learning-modules"] });
    },
  });

  if (!canCreate) return null;

  return (
    <Card data-testid="learning-creator">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{t("learning.form.createTitle")}</span>
          <Button type="button" variant="outline" data-testid="learning-create-toggle" onClick={() => setAperto((v) => !v)}>
            {aperto ? t("learning.form.close") : t("learning.form.create")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent hidden={!aperto}>
        <form
          data-testid="learning-create-form"
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          noValidate
          onSubmit={(e) => {
            void handleSubmit((v) => create.mutateAsync(v).catch(() => undefined))(e);
          }}
        >
          <div>
            <label htmlFor="lm-code" className="mb-1 block text-sm font-medium text-foreground">
              {t("shared.code")} <span aria-hidden="true">*</span>
            </label>
            <Input id="lm-code" data-testid="learning-create-code" {...register("code", { required: true, maxLength: 128 })} />
          </div>
          <div>
            <label htmlFor="lm-title" className="mb-1 block text-sm font-medium text-foreground">
              {t("shared.name")} <span aria-hidden="true">*</span>
            </label>
            <Input id="lm-title" data-testid="learning-create-title" {...register("title", { required: true, maxLength: 255 })} />
          </div>
          <div>
            <label htmlFor="lm-duration" className="mb-1 block text-sm font-medium text-foreground">
              {t("learning.cols.duration")}
            </label>
            <Input id="lm-duration" type="number" min="0" data-testid="learning-create-duration" {...register("durationMinutes")} />
          </div>
          <div>
            <label htmlFor="lm-kind" className="mb-1 block text-sm font-medium text-foreground">
              {t("learning.form.kind")}
            </label>
            <select id="lm-kind" data-testid="learning-create-kind" className={SELECT_CLASS} {...register("kind")}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {enumLabel("learningKind", k)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lm-delivery" className="mb-1 block text-sm font-medium text-foreground">
              {t("learning.form.delivery")}
            </label>
            <select id="lm-delivery" data-testid="learning-create-delivery" className={SELECT_CLASS} {...register("delivery")}>
              {DELIVERIES.map((d) => (
                <option key={d} value={d}>
                  {enumLabel("learningDelivery", d)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label htmlFor="lm-desc" className="mb-1 block text-sm font-medium text-foreground">
              {t("learning.form.description")}
            </label>
            <Input id="lm-desc" data-testid="learning-create-description" {...register("description", { maxLength: 4096 })} />
          </div>
          {canGlobal && (
            <div className="flex items-center gap-2 md:col-span-3">
              <input
                id="lm-global"
                type="checkbox"
                data-testid="learning-create-global"
                className="h-4 w-4 rounded border-border"
                {...register("isGlobal")}
              />
              <label htmlFor="lm-global" className="text-sm font-medium text-foreground">
                {t("learning.form.isGlobal")}
              </label>
            </div>
          )}
          <div className="flex items-center gap-3 md:col-span-3">
            <Button type="submit" data-testid="learning-create-submit" disabled={create.isPending}>
              {create.isPending ? t("common:saving") : t("learning.form.create")}
            </Button>
            {create.isError && (
              <span data-testid="learning-create-error" className="text-sm text-danger">
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

export function LearningModuleEditor({ moduleId, onClose }: { moduleId: string; onClose: () => void }) {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canUpdate = perms.has("learning:update");

  const modulo = useQuery({
    queryKey: ["learning-modules", moduleId],
    queryFn: () => apiFetch<LearningModule>(`/v1/learning-modules/${moduleId}`),
    enabled: !!moduleId,
  });

  const { register, handleSubmit, formState } = useForm<ModuleForm>({
    values: modulo.data
      ? {
          code: modulo.data.code,
          title: modulo.data.title,
          description: modulo.data.description ?? "",
          kind: modulo.data.kind,
          delivery: modulo.data.delivery,
          durationMinutes:
            modulo.data.durationMinutes === null || modulo.data.durationMinutes === undefined
              ? ""
              : String(modulo.data.durationMinutes),
          isGlobal: modulo.data.isGlobal,
        }
      : undefined,
  });

  const save = useMutation({
    mutationFn: (v: ModuleForm) =>
      apiFetch<LearningModule>(`/v1/learning-modules/${moduleId}`, {
        method: "PATCH",
        body: {
          title: v.title.trim(),
          description: orNull(v.description),
          kind: v.kind,
          delivery: v.delivery,
          durationMinutes: durata(v.durationMinutes),
        },
      }),
    onSuccess: (next) => {
      qc.setQueryData(["learning-modules", moduleId], next);
      void qc.invalidateQueries({ queryKey: ["learning-modules", "list"] });
    },
  });

  if (modulo.isLoading || modulo.isError) return null;

  return (
    <Card data-testid="learning-editor">
      <CardHeader>
        <CardTitle>
          {t("learning.form.editTitle")}
          <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">{modulo.data!.code}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!canUpdate && (
          <p data-testid="learning-edit-readonly" className="text-sm text-muted-foreground">
            {t("learning.form.readOnly")}
          </p>
        )}
        {canUpdate && (
          <form
            data-testid="learning-edit-form"
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
            noValidate
            onSubmit={(e) => {
              void handleSubmit((v) => save.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div>
              <label htmlFor="lm-edit-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.code")}
              </label>
              <Input id="lm-edit-code" data-testid="learning-edit-code" disabled {...register("code")} />
              <p className="mt-1 text-xs text-muted-foreground">{t("learning.form.codeImmutable")}</p>
            </div>
            <div>
              <label htmlFor="lm-edit-title" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="lm-edit-title" data-testid="learning-edit-title" {...register("title", { required: true, maxLength: 255 })} />
            </div>
            <div>
              <label htmlFor="lm-edit-duration" className="mb-1 block text-sm font-medium text-foreground">
                {t("learning.cols.duration")}
              </label>
              <Input id="lm-edit-duration" type="number" min="0" data-testid="learning-edit-duration" {...register("durationMinutes")} />
            </div>
            <div>
              <label htmlFor="lm-edit-kind" className="mb-1 block text-sm font-medium text-foreground">
                {t("learning.form.kind")}
              </label>
              <select id="lm-edit-kind" data-testid="learning-edit-kind" className={SELECT_CLASS} {...register("kind")}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {enumLabel("learningKind", k)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lm-edit-delivery" className="mb-1 block text-sm font-medium text-foreground">
                {t("learning.form.delivery")}
              </label>
              <select id="lm-edit-delivery" data-testid="learning-edit-delivery" className={SELECT_CLASS} {...register("delivery")}>
                {DELIVERIES.map((d) => (
                  <option key={d} value={d}>
                    {enumLabel("learningDelivery", d)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label htmlFor="lm-edit-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("learning.form.description")}
              </label>
              <Input id="lm-edit-desc" data-testid="learning-edit-description" {...register("description", { maxLength: 4096 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-3">
              <Button type="submit" data-testid="learning-edit-save" disabled={save.isPending}>
                {save.isPending ? t("common:saving") : t("learning.form.save")}
              </Button>
              <Button type="button" variant="outline" data-testid="learning-edit-close" onClick={onClose}>
                {t("learning.form.close")}
              </Button>
              {save.isSuccess && !formState.isDirty && (
                <span data-testid="learning-edit-saved" className="text-sm text-muted-foreground">
                  {t("learning.form.saved")}
                </span>
              )}
              {save.isError && (
                <span data-testid="learning-edit-error" className="text-sm text-danger">
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
