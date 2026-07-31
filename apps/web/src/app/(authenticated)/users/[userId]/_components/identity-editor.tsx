"use client";

/**
 * Modifica dell'anagrafica di una persona (#44 — linea C1).
 *
 * La scheda persona raccontava i 36 mesi contenuti nel database ma non
 * lasciava cambiare nulla: l'API `PATCH /v1/users/:id` esiste da MVP-1 e
 * nessuna pagina la chiamava. Questo è il pezzo che la collega.
 *
 * Il cancello è doppio e volutamente ridondante: qui si nasconde il form a
 * chi non ha `user:update`, ma l'autorità resta il service (che rifiuta anche
 * i campi privilegiati inviati da MANAGER/USER — NON_PRIVILEGED_UPDATABLE_FIELDS).
 * Se l'API dice 403, lo si mostra: non si finge che il salvataggio sia andato.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { User, UserStatus, UserType } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Liste locali: apps/web importa TIPI da @heuresys/shared, non valori (stessa
// convenzione di content/page.tsx). Il tipo le tiene allineate allo schema —
// aggiungere un valore là e non qui non compila.
const USER_STATUSES: readonly UserStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING_VERIFICATION",
  "DEACTIVATED",
];
const USER_TYPES: readonly UserType[] = ["STANDARD", "GENERATED_INCUMBENT", "SERVICE"];

interface FormValues {
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  externalCode: string;
  status: UserStatus;
  type: UserType;
  locale: string;
  timezone: string;
}

/** Stringa vuota nel form = "nessun valore" nel database, non "". */
const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());

export function IdentityEditor({ userId }: { userId: string }) {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canUpdate = new Set(perms.data?.permissions ?? []).has("user:update");

  // L'anagrafica grezza sta su GET /v1/users/:id: il dossier è una vista
  // narrativa e non porta i campi tecnici (externalCode, type, locale…).
  const user = useQuery({
    queryKey: ["users", userId],
    queryFn: () => apiFetch<User>(`/v1/users/${userId}`),
    enabled: !!userId,
  });

  const { register, handleSubmit, formState } = useForm<FormValues>({
    values: user.data
      ? {
          displayName: user.data.displayName,
          firstName: user.data.firstName ?? "",
          lastName: user.data.lastName ?? "",
          email: user.data.email,
          externalCode: user.data.externalCode ?? "",
          status: user.data.status,
          type: user.data.type,
          locale: user.data.locale ?? "",
          timezone: user.data.timezone ?? "",
        }
      : undefined,
  });

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      apiFetch<User>(`/v1/users/${userId}`, {
        method: "PATCH",
        body: {
          displayName: v.displayName.trim(),
          firstName: orNull(v.firstName),
          lastName: orNull(v.lastName),
          email: v.email.trim(),
          externalCode: orNull(v.externalCode),
          status: v.status,
          type: v.type,
          locale: orNull(v.locale),
          timezone: orNull(v.timezone),
        },
      }),
    onSuccess: (next) => {
      qc.setQueryData(["users", userId], next);
      // Il dossier ripete nome ed email nell'intestazione: va rinfrescato,
      // altrimenti la pagina mostra il vecchio nome sopra il nuovo modulo.
      void qc.invalidateQueries({ queryKey: ["users", userId, "dossier"] });
      void qc.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });

  if (user.isLoading) return null;
  if (user.isError) return null;

  const errors = formState.errors;
  const saveError = save.isError
    ? isApiError(save.error) && save.error.status === 403
      ? t("users.detail.edit.forbidden")
      : t("users.detail.edit.saveError")
    : null;

  return (
    <Card data-testid="user-identity-editor">
      <CardHeader>
        <CardTitle>{t("users.detail.edit.cardTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!canUpdate && (
          <p data-testid="user-identity-readonly" className="text-sm text-muted-foreground">
            {t("users.detail.edit.readOnly")}
          </p>
        )}
        {canUpdate && (
          <form
            data-testid="user-identity-form"
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            noValidate
            onSubmit={(e) => {
              void handleSubmit((v) => save.mutateAsync(v).catch(() => undefined))(e);
            }}
          >
            <div className="md:col-span-2">
              <label htmlFor="user-displayName" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.edit.displayName")} <span aria-hidden="true">*</span>
              </label>
              <Input
                id="user-displayName"
                data-testid="user-edit-displayName"
                aria-invalid={errors.displayName !== undefined}
                {...register("displayName", { required: true, maxLength: 255 })}
              />
              {errors.displayName && (
                <p className="mt-1 text-xs text-danger">{t("users.detail.edit.required")}</p>
              )}
            </div>

            <div>
              <label htmlFor="user-firstName" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.edit.firstName")}
              </label>
              <Input id="user-firstName" data-testid="user-edit-firstName" {...register("firstName", { maxLength: 128 })} />
            </div>

            <div>
              <label htmlFor="user-lastName" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.edit.lastName")}
              </label>
              <Input id="user-lastName" data-testid="user-edit-lastName" {...register("lastName", { maxLength: 128 })} />
            </div>

            <div>
              <label htmlFor="user-email" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.edit.email")} <span aria-hidden="true">*</span>
              </label>
              <Input
                id="user-email"
                type="email"
                data-testid="user-edit-email"
                aria-invalid={errors.email !== undefined}
                {...register("email", { required: true, maxLength: 254 })}
              />
              {errors.email && <p className="mt-1 text-xs text-danger">{t("users.detail.edit.required")}</p>}
            </div>

            <div>
              <label htmlFor="user-externalCode" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.edit.externalCode")}
              </label>
              <Input id="user-externalCode" data-testid="user-edit-externalCode" {...register("externalCode", { maxLength: 64 })} />
            </div>

            <div>
              <label htmlFor="user-status" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.edit.status")}
              </label>
              <select id="user-status" data-testid="user-edit-status" className={SELECT_CLASS} {...register("status")}>
                {USER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {enumLabel("userStatus", s)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="user-type" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.edit.type")}
              </label>
              <select id="user-type" data-testid="user-edit-type" className={SELECT_CLASS} {...register("type")}>
                {USER_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {enumLabel("userType", x)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="user-locale" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.edit.locale")}
              </label>
              <Input id="user-locale" data-testid="user-edit-locale" {...register("locale", { maxLength: 16 })} />
            </div>

            <div>
              <label htmlFor="user-timezone" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.edit.timezone")}
              </label>
              <Input id="user-timezone" data-testid="user-edit-timezone" {...register("timezone", { maxLength: 64 })} />
            </div>

            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit" data-testid="user-edit-save" disabled={save.isPending}>
                {save.isPending ? t("common:saving") : t("users.detail.edit.save")}
              </Button>
              {save.isSuccess && !formState.isDirty && (
                <span data-testid="user-edit-saved" className="text-sm text-muted-foreground">
                  {t("users.detail.edit.saved")}
                </span>
              )}
              {saveError && (
                <span data-testid="user-edit-error" className="text-sm text-danger">
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
