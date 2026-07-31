"use client";

/**
 * Creazione, modifica e spostamento di un'unità organizzativa (#44 — linea C1).
 *
 * `POST` e `PATCH /v1/organization-units` esistono da MVP-1 e nessuna pagina
 * li chiamava: l'organigramma si poteva ridisegnare solo da database.
 *
 * NOTA DI SICUREZZA STRUTTURALE — l'API **non** impedisce i cicli: né il
 * service, né il repository, né un vincolo sul database controllano che il
 * nuovo genitore non sia una discendente. Spostare un'unità sotto una propria
 * discendente staccherebbe un anello dall'albero, e le viste ricorsive
 * girerebbero a vuoto. Finché la protezione non esiste a monte, la costruisce
 * qui il selettore: dai genitori possibili si tolgono l'unità stessa e tutta
 * la sua discendenza. È una difesa lato interfaccia, non una garanzia: un
 * chiamante diretto dell'API può ancora creare il ciclo.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { OrganizationUnit, User } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lista locale: il web importa TIPI, non valori. Allineata al dominio i18n
// `common.enums.orgUnitType` usato dalla tabella.
const OU_TYPES = ["HEADQUARTERS", "DIVISION", "DEPARTMENT", "OFFICE", "TEAM"] as const;

const LIST_LIMIT = 200;

const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

/** Le unità che NON possono fare da genitore a `ouId`: sé stessa e la sua discendenza. */
function vietateComeGenitore(tutte: OrganizationUnit[], ouId: string): Set<string> {
  const figliDi = new Map<string | null, OrganizationUnit[]>();
  for (const o of tutte) {
    const k = o.parentId;
    const arr = figliDi.get(k);
    if (arr) arr.push(o);
    else figliDi.set(k, [o]);
  }
  const vietate = new Set<string>([ouId]);
  const coda = [ouId];
  while (coda.length > 0) {
    const corrente = coda.pop()!;
    for (const figlio of figliDi.get(corrente) ?? []) {
      if (!vietate.has(figlio.organizationUnitId)) {
        vietate.add(figlio.organizationUnitId);
        coda.push(figlio.organizationUnitId);
      }
    }
  }
  return vietate;
}

/** Elenchi condivisi dai due form (genitori possibili + responsabili). */
function usePickers(enabled: boolean) {
  const orgUnits = useQuery({
    queryKey: ["organization-units", "picker"],
    queryFn: () => apiFetch<{ items: OrganizationUnit[] }>(`/v1/organization-units?limit=${LIST_LIMIT}`),
    enabled,
  });
  const users = useQuery({
    queryKey: ["users", "picker"],
    queryFn: () => apiFetch<{ items: User[] }>(`/v1/users?limit=${LIST_LIMIT}`),
    enabled,
  });
  return { orgUnits, users };
}

interface CommonFields {
  name: string;
  type: string;
  parentId: string;
  managerUserId: string;
  isActive: boolean;
}
interface CreateFields extends CommonFields {
  code: string;
}

function messaggioErrore(
  err: unknown,
  t: (k: string) => string,
): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("organization.form.forbidden");
    if (err.status === 409) return t("organization.form.duplicate");
  }
  return t("organization.form.saveError");
}

/* --- creazione ---------------------------------------------------------- */

export function OrgUnitCreator() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canCreate = new Set(perms.data?.permissions ?? []).has("organization_unit:create");
  const { orgUnits, users } = usePickers(canCreate);

  const { register, handleSubmit, reset, formState } = useForm<CreateFields>({
    defaultValues: { code: "", name: "", type: "", parentId: "", managerUserId: "", isActive: true },
  });

  const create = useMutation({
    mutationFn: (v: CreateFields) =>
      apiFetch<OrganizationUnit>("/v1/organization-units", {
        method: "POST",
        body: {
          code: v.code.trim(),
          name: v.name.trim(),
          type: orNull(v.type),
          parentId: orNull(v.parentId),
          managerUserId: orNull(v.managerUserId),
          isActive: v.isActive,
        },
      }),
    onSuccess: () => {
      reset({ code: "", name: "", type: "", parentId: "", managerUserId: "", isActive: true });
      void qc.invalidateQueries({ queryKey: ["organization-units"] });
    },
  });

  if (!canCreate) return null;
  const errors = formState.errors;

  return (
    <Card data-testid="orgunit-creator">
      <CardHeader>
        <CardTitle>{t("organization.form.createTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          data-testid="orgunit-create-form"
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
          noValidate
          onSubmit={(e) => {
            void handleSubmit((v) => create.mutateAsync(v).catch(() => undefined))(e);
          }}
        >
          <div>
            <label htmlFor="ou-code" className="mb-1 block text-sm font-medium text-foreground">
              {t("organization.form.code")} <span aria-hidden="true">*</span>
            </label>
            <Input
              id="ou-code"
              data-testid="orgunit-create-code"
              aria-invalid={errors.code !== undefined}
              {...register("code", { required: true, maxLength: 64 })}
            />
            {errors.code && <p className="mt-1 text-xs text-danger">{t("organization.form.required")}</p>}
          </div>

          <div>
            <label htmlFor="ou-name" className="mb-1 block text-sm font-medium text-foreground">
              {t("organization.form.name")} <span aria-hidden="true">*</span>
            </label>
            <Input
              id="ou-name"
              data-testid="orgunit-create-name"
              aria-invalid={errors.name !== undefined}
              {...register("name", { required: true, maxLength: 255 })}
            />
            {errors.name && <p className="mt-1 text-xs text-danger">{t("organization.form.required")}</p>}
          </div>

          <div>
            <label htmlFor="ou-type" className="mb-1 block text-sm font-medium text-foreground">
              {t("organization.form.type")}
            </label>
            <select id="ou-type" data-testid="orgunit-create-type" className={SELECT_CLASS} {...register("type")}>
              <option value="">{t("organization.form.none")}</option>
              {OU_TYPES.map((x) => (
                <option key={x} value={x}>
                  {enumLabel("orgUnitType", x)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ou-parent" className="mb-1 block text-sm font-medium text-foreground">
              {t("organization.form.parent")}
            </label>
            <select id="ou-parent" data-testid="orgunit-create-parent" className={SELECT_CLASS} {...register("parentId")}>
              <option value="">{t("organization.form.noParent")}</option>
              {(orgUnits.data?.items ?? []).map((o) => (
                <option key={o.organizationUnitId} value={o.organizationUnitId}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ou-manager" className="mb-1 block text-sm font-medium text-foreground">
              {t("organization.form.manager")}
            </label>
            <select id="ou-manager" data-testid="orgunit-create-manager" className={SELECT_CLASS} {...register("managerUserId")}>
              <option value="">{t("organization.form.none")}</option>
              {(users.data?.items ?? []).map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" data-testid="orgunit-create-submit" disabled={create.isPending}>
              {create.isPending ? t("common:saving") : t("organization.form.create")}
            </Button>
            {create.isError && (
              <span data-testid="orgunit-create-error" className="text-sm text-danger">
                {messaggioErrore(create.error, t)}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* --- modifica / spostamento --------------------------------------------- */

export function OrgUnitEditor({ ouId, onClose }: { ouId: string; onClose: () => void }) {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canUpdate = new Set(perms.data?.permissions ?? []).has("organization_unit:update");
  const { orgUnits, users } = usePickers(true);

  const ou = useQuery({
    queryKey: ["organization-units", ouId],
    queryFn: () => apiFetch<OrganizationUnit>(`/v1/organization-units/${ouId}`),
    enabled: !!ouId,
  });

  const { register, handleSubmit, formState } = useForm<CommonFields>({
    values: ou.data
      ? {
          name: ou.data.name,
          type: ou.data.type ?? "",
          parentId: ou.data.parentId ?? "",
          managerUserId: ou.data.managerUserId ?? "",
          isActive: ou.data.isActive,
        }
      : undefined,
  });

  const save = useMutation({
    mutationFn: (v: CommonFields) =>
      apiFetch<OrganizationUnit>(`/v1/organization-units/${ouId}`, {
        method: "PATCH",
        body: {
          name: v.name.trim(),
          type: orNull(v.type),
          parentId: orNull(v.parentId),
          managerUserId: orNull(v.managerUserId),
          isActive: v.isActive,
        },
      }),
    onSuccess: (next) => {
      qc.setQueryData(["organization-units", ouId], next);
      void qc.invalidateQueries({ queryKey: ["organization-units"] });
    },
  });

  if (ou.isLoading || ou.isError) return null;

  // Vedi la nota in testa al file: l'API non protegge dai cicli, quindi il
  // selettore non offre nemmeno la possibilità di crearne uno.
  const vietate = vietateComeGenitore(orgUnits.data?.items ?? [], ouId);
  const errors = formState.errors;

  return (
    <Card data-testid="orgunit-editor">
      <CardHeader>
        <CardTitle>
          {t("organization.form.editTitle")}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{ou.data!.code}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!canUpdate && (
          <p data-testid="orgunit-edit-readonly" className="text-sm text-muted-foreground">
            {t("organization.form.readOnly")}
          </p>
        )}
        {canUpdate && (
          <form
            data-testid="orgunit-edit-form"
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            noValidate
            onSubmit={(e) => {
              void handleSubmit((v) => save.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div className="md:col-span-2">
              <label htmlFor="ou-edit-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("organization.form.name")} <span aria-hidden="true">*</span>
              </label>
              <Input
                id="ou-edit-name"
                data-testid="orgunit-edit-name"
                aria-invalid={errors.name !== undefined}
                {...register("name", { required: true, maxLength: 255 })}
              />
              {errors.name && <p className="mt-1 text-xs text-danger">{t("organization.form.required")}</p>}
            </div>

            <div>
              <label htmlFor="ou-edit-type" className="mb-1 block text-sm font-medium text-foreground">
                {t("organization.form.type")}
              </label>
              <select id="ou-edit-type" data-testid="orgunit-edit-type" className={SELECT_CLASS} {...register("type")}>
                <option value="">{t("organization.form.none")}</option>
                {OU_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {enumLabel("orgUnitType", x)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ou-edit-parent" className="mb-1 block text-sm font-medium text-foreground">
                {t("organization.form.parent")}
              </label>
              <select id="ou-edit-parent" data-testid="orgunit-edit-parent" className={SELECT_CLASS} {...register("parentId")}>
                <option value="">{t("organization.form.noParent")}</option>
                {(orgUnits.data?.items ?? [])
                  .filter((o) => !vietate.has(o.organizationUnitId))
                  .map((o) => (
                    <option key={o.organizationUnitId} value={o.organizationUnitId}>
                      {o.name}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">{t("organization.form.parentHint")}</p>
            </div>

            <div>
              <label htmlFor="ou-edit-manager" className="mb-1 block text-sm font-medium text-foreground">
                {t("organization.form.manager")}
              </label>
              <select id="ou-edit-manager" data-testid="orgunit-edit-manager" className={SELECT_CLASS} {...register("managerUserId")}>
                <option value="">{t("organization.form.none")}</option>
                {(users.data?.items ?? []).map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="ou-edit-active"
                type="checkbox"
                data-testid="orgunit-edit-active"
                className="h-4 w-4 rounded border-border"
                {...register("isActive")}
              />
              <label htmlFor="ou-edit-active" className="text-sm font-medium text-foreground">
                {t("organization.form.isActive")}
              </label>
            </div>

            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit" data-testid="orgunit-edit-save" disabled={save.isPending}>
                {save.isPending ? t("common:saving") : t("organization.form.save")}
              </Button>
              <Button type="button" variant="outline" data-testid="orgunit-edit-close" onClick={onClose}>
                {t("organization.form.close")}
              </Button>
              {save.isSuccess && !formState.isDirty && (
                <span data-testid="orgunit-edit-saved" className="text-sm text-muted-foreground">
                  {t("organization.form.saved")}
                </span>
              )}
              {save.isError && (
                <span data-testid="orgunit-edit-error" className="text-sm text-danger">
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
