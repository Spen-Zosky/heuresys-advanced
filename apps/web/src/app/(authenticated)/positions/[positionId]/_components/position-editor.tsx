"use client";

/**
 * Modifica di una posizione (#44 — linea C1).
 *
 * `PATCH /v1/positions/:id` esiste da MVP-1 e nessuna pagina lo chiamava: una
 * posizione si poteva ridisegnare solo da database. Qui si collega.
 *
 * I legami (unità organizzativa, ruolo, riporto, titolare) si scelgono PER
 * NOME da elenchi veri, non incollando un identificativo: è la differenza fra
 * una console per amministratori e un editor di righe di tabella. Il riporto
 * esclude la posizione stessa — un ciclo su sé stessa non è rappresentabile
 * nell'organigramma.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { JobRole, OrganizationUnit, Position, PositionCriticality, User } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";
import { etichettaPersona } from "@/lib/person-label";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lista locale: il web importa TIPI, non valori (convenzione di content/page.tsx).
const CRITICALITIES: readonly PositionCriticality[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const LIST_LIMIT = 200;

interface FormValues {
  title: string;
  organizationUnitId: string;
  jobRoleId: string;
  reportsToPositionId: string;
  ownerUserId: string;
  criticality: string;
  economicWeight: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

export function PositionEditor({ positionId }: { positionId: string }) {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canUpdate = new Set(perms.data?.permissions ?? []).has("position:update");

  const position = useQuery({
    queryKey: ["positions", positionId],
    queryFn: () => apiFetch<Position>(`/v1/positions/${positionId}`),
    enabled: !!positionId,
  });

  // Gli elenchi servono SOLO a chi può scrivere: a un lettore non si fanno
  // pagare quattro chiamate per dei menù che non vedrà.
  const orgUnits = useQuery({
    queryKey: ["organization-units", "picker"],
    queryFn: () => apiFetch<{ items: OrganizationUnit[] }>(`/v1/organization-units?limit=${LIST_LIMIT}`),
    enabled: canUpdate,
  });
  const jobRoles = useQuery({
    queryKey: ["job-roles", "picker"],
    queryFn: () => apiFetch<{ items: JobRole[] }>(`/v1/job-roles?limit=${LIST_LIMIT}`),
    enabled: canUpdate,
  });
  const positions = useQuery({
    queryKey: ["positions", "picker"],
    queryFn: () => apiFetch<{ items: Position[] }>(`/v1/positions?limit=${LIST_LIMIT}`),
    enabled: canUpdate,
  });
  const users = useQuery({
    queryKey: ["users", "picker"],
    queryFn: () => apiFetch<{ items: User[] }>(`/v1/users?limit=${LIST_LIMIT}`),
    enabled: canUpdate,
  });

  const { register, handleSubmit, formState } = useForm<FormValues>({
    values: position.data
      ? {
          title: position.data.title,
          organizationUnitId: position.data.organizationUnitId ?? "",
          jobRoleId: position.data.jobRoleId ?? "",
          reportsToPositionId: position.data.reportsToPositionId ?? "",
          ownerUserId: position.data.ownerUserId ?? "",
          criticality: position.data.criticality ?? "",
          economicWeight:
            position.data.economicWeight === null || position.data.economicWeight === undefined
              ? ""
              : String(position.data.economicWeight),
          isActive: position.data.isActive,
          effectiveFrom: position.data.effectiveFrom ?? "",
          effectiveTo: position.data.effectiveTo ?? "",
        }
      : undefined,
  });

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body: Record<string, unknown> = {
        title: v.title.trim(),
        organizationUnitId: orNull(v.organizationUnitId),
        jobRoleId: orNull(v.jobRoleId),
        reportsToPositionId: orNull(v.reportsToPositionId),
        ownerUserId: orNull(v.ownerUserId),
        criticality: orNull(v.criticality),
        // il peso economico è 0..1 sull'API: stringa vuota = "non impostato",
        // NON zero (che significherebbe "vale niente").
        economicWeight: v.economicWeight.trim() === "" ? null : Number(v.economicWeight),
        isActive: v.isActive,
        effectiveTo: orNull(v.effectiveTo),
      };
      if (v.effectiveFrom.trim() !== "") body.effectiveFrom = v.effectiveFrom.trim();
      return apiFetch<Position>(`/v1/positions/${positionId}`, { method: "PATCH", body });
    },
    onSuccess: (next) => {
      qc.setQueryData(["positions", positionId], next);
      void qc.invalidateQueries({ queryKey: ["positions", "list"] });
    },
  });

  if (position.isLoading || position.isError) return null;

  const errors = formState.errors;
  const saveError = save.isError
    ? isApiError(save.error) && save.error.status === 403
      ? t("positions.detail.edit.forbidden")
      : isApiError(save.error) && save.error.status === 409
        ? t("positions.detail.edit.conflict")
        : t("positions.detail.edit.saveError")
    : null;

  return (
    <Card data-testid="position-editor">
      <CardHeader>
        <CardTitle>{t("positions.detail.edit.cardTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!canUpdate && (
          <p data-testid="position-edit-readonly" className="text-sm text-muted-foreground">
            {t("positions.detail.edit.readOnly")}
          </p>
        )}
        {canUpdate && (
          <form
            data-testid="position-edit-form"
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            noValidate
            onSubmit={(e) => {
              void handleSubmit((v) => save.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div className="md:col-span-2">
              <label htmlFor="pos-title" className="mb-1 block text-sm font-medium text-foreground">
                {t("positions.detail.edit.title")} <span aria-hidden="true">*</span>
              </label>
              <Input
                id="pos-title"
                data-testid="position-edit-title"
                aria-invalid={errors.title !== undefined}
                {...register("title", { required: true, maxLength: 255 })}
              />
              {errors.title && <p className="mt-1 text-xs text-danger">{t("positions.detail.edit.required")}</p>}
            </div>

            <div>
              <label htmlFor="pos-org" className="mb-1 block text-sm font-medium text-foreground">
                {t("positions.detail.edit.orgUnit")}
              </label>
              <select id="pos-org" data-testid="position-edit-orgunit" className={SELECT_CLASS} {...register("organizationUnitId")}>
                <option value="">{t("positions.detail.edit.none")}</option>
                {(orgUnits.data?.items ?? []).map((o) => (
                  <option key={o.organizationUnitId} value={o.organizationUnitId}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pos-role" className="mb-1 block text-sm font-medium text-foreground">
                {t("positions.detail.edit.jobRole")}
              </label>
              <select id="pos-role" data-testid="position-edit-jobrole" className={SELECT_CLASS} {...register("jobRoleId")}>
                <option value="">{t("positions.detail.edit.none")}</option>
                {(jobRoles.data?.items ?? []).map((r) => (
                  <option key={r.jobRoleId} value={r.jobRoleId}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pos-reports" className="mb-1 block text-sm font-medium text-foreground">
                {t("positions.detail.edit.reportsTo")}
              </label>
              <select id="pos-reports" data-testid="position-edit-reportsto" className={SELECT_CLASS} {...register("reportsToPositionId")}>
                <option value="">{t("positions.detail.edit.none")}</option>
                {(positions.data?.items ?? [])
                  .filter((x) => x.positionId !== positionId)
                  .map((x) => (
                    <option key={x.positionId} value={x.positionId}>
                      {x.title}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label htmlFor="pos-owner" className="mb-1 block text-sm font-medium text-foreground">
                {t("positions.detail.edit.owner")}
              </label>
              <select id="pos-owner" data-testid="position-edit-owner" className={SELECT_CLASS} {...register("ownerUserId")}>
                <option value="">{t("positions.detail.edit.none")}</option>
                {/* #198 T7 — il titolare di una posizione non si assegna a un
                    segnaposto senza vederlo: sarebbe un dato falso sull'organigramma. */}
                {(users.data?.items ?? []).map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {etichettaPersona(u, enumLabel)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pos-criticality" className="mb-1 block text-sm font-medium text-foreground">
                {t("positions.detail.edit.criticality")}
              </label>
              <select id="pos-criticality" data-testid="position-edit-criticality" className={SELECT_CLASS} {...register("criticality")}>
                <option value="">{t("positions.detail.edit.none")}</option>
                {CRITICALITIES.map((c) => (
                  <option key={c} value={c}>
                    {enumLabel("positionCriticality", c)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pos-weight" className="mb-1 block text-sm font-medium text-foreground">
                {t("positions.detail.edit.economicWeight")}
              </label>
              <Input
                id="pos-weight"
                type="number"
                step="0.01"
                min="0"
                max="1"
                data-testid="position-edit-weight"
                {...register("economicWeight")}
              />
            </div>

            <div>
              <label htmlFor="pos-from" className="mb-1 block text-sm font-medium text-foreground">
                {t("positions.detail.edit.effectiveFrom")}
              </label>
              <Input id="pos-from" type="date" data-testid="position-edit-from" {...register("effectiveFrom")} />
            </div>

            <div>
              <label htmlFor="pos-to" className="mb-1 block text-sm font-medium text-foreground">
                {t("positions.detail.edit.effectiveTo")}
              </label>
              <Input id="pos-to" type="date" data-testid="position-edit-to" {...register("effectiveTo")} />
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <input
                id="pos-active"
                type="checkbox"
                data-testid="position-edit-active"
                className="h-4 w-4 rounded border-border"
                {...register("isActive")}
              />
              <label htmlFor="pos-active" className="text-sm font-medium text-foreground">
                {t("positions.detail.edit.isActive")}
              </label>
            </div>

            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit" data-testid="position-edit-save" disabled={save.isPending}>
                {save.isPending ? t("common:saving") : t("positions.detail.edit.save")}
              </Button>
              {save.isSuccess && !formState.isDirty && (
                <span data-testid="position-edit-saved" className="text-sm text-muted-foreground">
                  {t("positions.detail.edit.saved")}
                </span>
              )}
              {saveError && (
                <span data-testid="position-edit-error" className="text-sm text-danger">
                  {saveError}
                </span>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
