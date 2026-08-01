"use client";

/**
 * Competenze: creazione e modifica dal catalogo (#43 — linea C2).
 *
 * `POST` e `PATCH /v1/skills` esistevano da MVP-1 e nessuna pagina li
 * chiamava: una competenza si creava o si correggeva solo da database, su un
 * catalogo di ~14.000 voci.
 *
 * Due autorità che restano all'API e che qui NON si fingono:
 *  - `isGlobal` (competenza valida per tutti i clienti) lo può imporre solo
 *    un amministratore di piattaforma: il service lo forza a falso per
 *    chiunque altro. Il campo compare quindi solo a chi può davvero usarlo.
 *  - `code` è immutabile: `UpdateSkillBody` non lo prevede. In modifica si
 *    mostra disabilitato invece di far credere che si possa cambiare.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { Skill, SkillCategory } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const LIST_LIMIT = 200;

interface SkillForm {
  code: string;
  name: string;
  description: string;
  categoryId: string;
  escoUri: string;
  isGlobal: boolean;
}

const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

function messaggioErrore(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("skills.form.forbidden");
    if (err.status === 409) return t("skills.form.duplicate");
  }
  return t("skills.form.saveError");
}

/** Le categorie servono a entrambi i form: si caricano una volta sola. */
function useCategorie(enabled: boolean) {
  return useQuery({
    queryKey: ["skill-categories", "picker"],
    queryFn: () => apiFetch<{ items: SkillCategory[] }>(`/v1/skill-categories?limit=${LIST_LIMIT}`),
    enabled,
  });
}

function OpzioniCategoria({ items }: { items: SkillCategory[] }) {
  return (
    <>
      {items.map((c) => (
        <option key={c.skillCategoryId} value={c.skillCategoryId}>
          {c.name}
        </option>
      ))}
    </>
  );
}

/* --- creazione ---------------------------------------------------------- */

export function SkillCreator() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canCreate = perms.has("skill:create");
  // Solo chi amministra la piattaforma può creare una competenza globale: il
  // service lo impone comunque, qui si evita di mostrare una leva finta.
  const canGlobal = perms.has("tenant:create") || perms.has("platform:manage");
  const categorie = useCategorie(canCreate);

  const { register, handleSubmit, reset } = useForm<SkillForm>({
    defaultValues: { code: "", name: "", description: "", categoryId: "", escoUri: "", isGlobal: false },
  });

  const create = useMutation({
    mutationFn: (v: SkillForm) =>
      apiFetch<Skill>("/v1/skills", {
        method: "POST",
        body: {
          code: v.code.trim(),
          name: v.name.trim(),
          description: orNull(v.description),
          categoryId: orNull(v.categoryId),
          escoUri: orNull(v.escoUri),
          isGlobal: canGlobal ? v.isGlobal : false,
        },
      }),
    onSuccess: () => {
      reset({ code: "", name: "", description: "", categoryId: "", escoUri: "", isGlobal: false });
      void qc.invalidateQueries({ queryKey: ["skills"] });
    },
  });

  if (!canCreate) return null;

  return (
    <Card data-testid="skill-creator">
      <CardHeader>
        <CardTitle>{t("skills.form.createTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          data-testid="skill-create-form"
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          noValidate
          onSubmit={(e) => {
            void handleSubmit((v) => create.mutateAsync(v).catch(() => undefined))(e);
          }}
        >
          <div>
            <label htmlFor="skill-code" className="mb-1 block text-sm font-medium text-foreground">
              {t("shared.code")} <span aria-hidden="true">*</span>
            </label>
            <Input id="skill-code" data-testid="skill-create-code" {...register("code", { required: true, maxLength: 128 })} />
          </div>
          <div>
            <label htmlFor="skill-name" className="mb-1 block text-sm font-medium text-foreground">
              {t("shared.name")} <span aria-hidden="true">*</span>
            </label>
            <Input id="skill-name" data-testid="skill-create-name" {...register("name", { required: true, maxLength: 255 })} />
          </div>
          <div>
            <label htmlFor="skill-category" className="mb-1 block text-sm font-medium text-foreground">
              {t("skills.form.category")}
            </label>
            <select id="skill-category" data-testid="skill-create-category" className={SELECT_CLASS} {...register("categoryId")}>
              <option value="">{t("skills.form.none")}</option>
              <OpzioniCategoria items={categorie.data?.items ?? []} />
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="skill-desc" className="mb-1 block text-sm font-medium text-foreground">
              {t("skills.form.description")}
            </label>
            <Input id="skill-desc" data-testid="skill-create-description" {...register("description", { maxLength: 2048 })} />
          </div>
          <div>
            <label htmlFor="skill-esco" className="mb-1 block text-sm font-medium text-foreground">
              {t("skills.form.escoUri")}
            </label>
            <Input id="skill-esco" data-testid="skill-create-esco" {...register("escoUri", { maxLength: 1024 })} />
          </div>
          {canGlobal && (
            <div className="flex items-center gap-2 md:col-span-3">
              <input
                id="skill-global"
                type="checkbox"
                data-testid="skill-create-global"
                className="h-4 w-4 rounded border-border"
                {...register("isGlobal")}
              />
              <label htmlFor="skill-global" className="text-sm font-medium text-foreground">
                {t("skills.form.isGlobal")}
              </label>
            </div>
          )}
          <div className="flex items-center gap-3 md:col-span-3">
            <Button type="submit" data-testid="skill-create-submit" disabled={create.isPending}>
              {create.isPending ? t("common:saving") : t("skills.form.create")}
            </Button>
            {create.isError && (
              <span data-testid="skill-create-error" className="text-sm text-danger">
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

export function SkillEditor({ skillId, onClose }: { skillId: string; onClose: () => void }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const perms = new Set(useCurrentUserPermissions().data?.permissions ?? []);
  const canUpdate = perms.has("skill:update");
  const categorie = useCategorie(true);

  const skill = useQuery({
    queryKey: ["skills", skillId],
    queryFn: () => apiFetch<Skill>(`/v1/skills/${skillId}`),
    enabled: !!skillId,
  });

  const { register, handleSubmit, formState } = useForm<SkillForm>({
    values: skill.data
      ? {
          code: skill.data.code,
          name: skill.data.name,
          description: skill.data.description ?? "",
          categoryId: skill.data.categoryId ?? "",
          escoUri: skill.data.escoUri ?? "",
          isGlobal: skill.data.isGlobal,
        }
      : undefined,
  });

  const save = useMutation({
    mutationFn: (v: SkillForm) =>
      apiFetch<Skill>(`/v1/skills/${skillId}`, {
        method: "PATCH",
        body: {
          name: v.name.trim(),
          description: orNull(v.description),
          categoryId: orNull(v.categoryId),
          escoUri: orNull(v.escoUri),
        },
      }),
    onSuccess: (next) => {
      qc.setQueryData(["skills", skillId], next);
      void qc.invalidateQueries({ queryKey: ["skills", "list"] });
    },
  });

  if (skill.isLoading || skill.isError) return null;

  return (
    <Card data-testid="skill-editor">
      <CardHeader>
        <CardTitle>
          {t("skills.form.editTitle")}
          <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">{skill.data!.code}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!canUpdate && (
          <p data-testid="skill-edit-readonly" className="text-sm text-muted-foreground">
            {t("skills.form.readOnly")}
          </p>
        )}
        {canUpdate && (
          <form
            data-testid="skill-edit-form"
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
            noValidate
            onSubmit={(e) => {
              void handleSubmit((v) => save.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div>
              <label htmlFor="skill-edit-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.code")}
              </label>
              <Input id="skill-edit-code" data-testid="skill-edit-code" disabled {...register("code")} />
              <p className="mt-1 text-xs text-muted-foreground">{t("skills.form.codeImmutable")}</p>
            </div>
            <div>
              <label htmlFor="skill-edit-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("shared.name")} <span aria-hidden="true">*</span>
              </label>
              <Input id="skill-edit-name" data-testid="skill-edit-name" {...register("name", { required: true, maxLength: 255 })} />
            </div>
            <div>
              <label htmlFor="skill-edit-category" className="mb-1 block text-sm font-medium text-foreground">
                {t("skills.form.category")}
              </label>
              <select id="skill-edit-category" data-testid="skill-edit-category" className={SELECT_CLASS} {...register("categoryId")}>
                <option value="">{t("skills.form.none")}</option>
                <OpzioniCategoria items={categorie.data?.items ?? []} />
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="skill-edit-desc" className="mb-1 block text-sm font-medium text-foreground">
                {t("skills.form.description")}
              </label>
              <Input id="skill-edit-desc" data-testid="skill-edit-description" {...register("description", { maxLength: 2048 })} />
            </div>
            <div>
              <label htmlFor="skill-edit-esco" className="mb-1 block text-sm font-medium text-foreground">
                {t("skills.form.escoUri")}
              </label>
              <Input id="skill-edit-esco" data-testid="skill-edit-esco" {...register("escoUri", { maxLength: 1024 })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-3">
              <Button type="submit" data-testid="skill-edit-save" disabled={save.isPending}>
                {save.isPending ? t("common:saving") : t("skills.form.save")}
              </Button>
              <Button type="button" variant="outline" data-testid="skill-edit-close" onClick={onClose}>
                {t("skills.form.close")}
              </Button>
              {save.isSuccess && !formState.isDirty && (
                <span data-testid="skill-edit-saved" className="text-sm text-muted-foreground">
                  {t("skills.form.saved")}
                </span>
              )}
              {save.isError && (
                <span data-testid="skill-edit-error" className="text-sm text-danger">
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
