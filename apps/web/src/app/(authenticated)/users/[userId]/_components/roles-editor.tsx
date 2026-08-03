"use client";

/**
 * Ruoli di una persona: elenco, assegnazione, revoca (#44 — linea C1).
 *
 * `GET/POST/DELETE /v1/users/:id/roles` esistono da MVP-1 e nessuna pagina li
 * usava: i ruoli si potevano cambiare solo da database. Qui si chiudono.
 *
 * Il permesso di lettura è già quello della scheda (`user:read`); la scrittura
 * chiede `role:assign` — senza, l'elenco resta visibile ma senza comandi.
 * L'ambito del tenant NON si sceglie da qui: il service lo impone in base a
 * chi sta agendo (TENANT_ADMIN → il proprio tenant), quindi non si espone un
 * campo che l'API ignorerebbe.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { RoleCode, RoleGrant } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lista locale: il web importa TIPI, non valori (vedi identity-editor).
// Il tipo `RoleCode` fa da guardia: un codice inventato non compila.
const ROLE_CODES: readonly RoleCode[] = [
  "PLATFORM_ADMIN",
  "TENANT_ADMIN",
  "BLUEPRINT_MANAGER",
  "HRMS_MANAGER",
  "PROCESS_OWNER",
  "MANAGER",
  "USER",
  "READ_ONLY",
  "CEO",
  "TEAM_LEADER",
  "TEAM_MEMBER",
  "ORG_DIRECTOR",
  "WHISTLEBLOWING_CUSTODIAN",
];

const fmtDate = (v: string | null | undefined): string =>
  v ? new Date(v).toLocaleDateString() : "—";

export function RolesEditor({ userId }: { userId: string }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canAssign = new Set(perms.data?.permissions ?? []).has("role:assign");

  const [roleCode, setRoleCode] = useState<RoleCode>("USER");

  const rolesKey = ["users", userId, "roles"] as const;
  const roles = useQuery({
    queryKey: rolesKey,
    queryFn: () => apiFetch<{ items: RoleGrant[] }>(`/v1/users/${userId}/roles`),
    enabled: !!userId,
  });

  const grant = useMutation({
    mutationFn: (code: RoleCode) =>
      apiFetch<RoleGrant>(`/v1/users/${userId}/roles`, { method: "POST", body: { roleCode: code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rolesKey }),
  });

  const revoke = useMutation({
    mutationFn: (grantId: string) =>
      apiFetch<void>(`/v1/users/${userId}/roles/${grantId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rolesKey }),
  });

  const failed = grant.isError ? grant.error : revoke.isError ? revoke.error : null;
  const errorText = failed
    ? isApiError(failed) && failed.status === 403
      ? t("users.detail.roles.forbidden")
      : isApiError(failed) && failed.status === 409
        ? t("users.detail.roles.duplicate")
        : t("users.detail.roles.error")
    : null;

  const items = roles.data?.items ?? [];

  return (
    <Card data-testid="user-roles-editor">
      <CardHeader>
        <CardTitle>
          {t("users.detail.roles.cardTitle")}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {roles.isLoading && <p className="text-sm text-muted-foreground">{t("common:loading")}</p>}

        {!roles.isLoading && items.length === 0 && (
          <p data-testid="user-roles-empty" className="text-sm text-muted-foreground">
            {t("users.detail.roles.empty")}
          </p>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="user-roles-table">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{t("users.detail.roles.colRole")}</th>
                  <th className="py-2 pr-4 font-medium">{t("users.detail.roles.colScope")}</th>
                  <th className="py-2 pr-4 font-medium">{t("users.detail.roles.colGrantedAt")}</th>
                  {canAssign && <th className="py-2 pr-4 font-medium">{t("common:table.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((g) => (
                  <tr key={g.grantId} className="border-b last:border-0" data-testid={`user-role-${g.roleCode}`}>
                    <td className="py-2 pr-4 align-top">{g.roleCode}</td>
                    <td className="py-2 pr-4 align-top text-muted-foreground">
                      {g.tenantId ? t("users.detail.roles.scopeTenant") : t("users.detail.roles.scopePlatform")}
                    </td>
                    <td className="py-2 pr-4 align-top text-muted-foreground">{fmtDate(g.grantedAt)}</td>
                    {canAssign && (
                      <td className="py-2 pr-4 align-top">
                        <Button
                          type="button"
                          variant="outline"
                          data-testid={`user-role-revoke-${g.roleCode}`}
                          disabled={revoke.isPending}
                          onClick={() => revoke.mutate(g.grantId)}
                        >
                          {t("users.detail.roles.revoke")}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canAssign && (
          <div className="flex flex-wrap items-end gap-3" data-testid="user-roles-grant">
            <div className="min-w-56">
              <label htmlFor="user-role-code" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.roles.grantLabel")}
              </label>
              <select
                id="user-role-code"
                data-testid="user-role-select"
                className={SELECT_CLASS}
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value as RoleCode)}
              >
                {ROLE_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              data-testid="user-role-grant"
              disabled={grant.isPending}
              onClick={() => grant.mutate(roleCode)}
            >
              {grant.isPending ? t("common:saving") : t("users.detail.roles.grant")}
            </Button>
            {errorText && (
              <span data-testid="user-roles-error" className="text-sm text-danger">
                {errorText}
              </span>
            )}
          </div>
        )}

        {!canAssign && (
          <p data-testid="user-roles-readonly" className="text-sm text-muted-foreground">
            {t("users.detail.roles.readOnly")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
