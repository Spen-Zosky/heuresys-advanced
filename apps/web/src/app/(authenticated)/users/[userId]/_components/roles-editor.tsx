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
 *
 * ADR-0050 D4 (mig 000475): un mandato forte (MANDATE_ROLE_CODES) non si assegna né si revoca
 * con un clic. Si propone un atto, con motivo e data di revisione, e lo decide un secondo
 * titolare dalla pagina Ruoli (/admin/roles). Le concessioni di mandato nate prima dell'atto si
 * riconoscono (nessun atto) e si propongono per la riconferma da qui.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import {
  MANDATE_REVIEW_MAX_DAYS,
  MANDATE_ROLE_CODES,
  type MandateAct,
  type MandateActKind,
  type RoleCode,
  type RoleGrant,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUser, useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";
import { codiceInParole } from "@/lib/enum-labels";

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
  "BRANCH_MANAGER",
  "PLATFORM_OPERATOR",
  "SALES",
  "DPO",
  "SECURITY_ADMIN",
  "TAXONOMY_STEWARD",
  "RECRUITER",
  "HIRING_MANAGER",
  "IMPLEMENTATION_CONSULTANT",
  "PEOPLE_MANAGER",
  "DATA_STEWARD",
];

const MANDATI = new Set<RoleCode>(MANDATE_ROLE_CODES);

function fraGiorni(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/** L'atto che si sta scrivendo: GRANT dal selettore, REVOKE e CONFIRM da una riga. */
interface Bozza {
  kind: MandateActKind;
  roleCode: RoleCode;
  grantId?: string;
}

export function RolesEditor({ userId }: { userId: string }) {
  const { t } = useTranslation("admin");
  const f = useFormat();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canAssign = new Set(perms.data?.permissions ?? []).has("role:assign");
  // S-6 (piano interfacce 2026-11-03, D-28): l'API rende i ruoli di una persona solo a chi
  // li puo' concedere (role:assign) o alla persona stessa, e a tutti gli altri risponde 404.
  // Prima la scheda chiedeva comunque e restava con un riquadro rotto; ora non chiede e il
  // riquadro non compare.
  const me = useCurrentUser();
  const canSeeRoles = canAssign || me.data?.userId === userId;

  const [roleCode, setRoleCode] = useState<RoleCode>("USER");
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [motivo, setMotivo] = useState("");
  const [revisione, setRevisione] = useState(fraGiorni(180));

  const rolesKey = ["users", userId, "roles"] as const;
  const roles = useQuery({
    queryKey: rolesKey,
    queryFn: () => apiFetch<{ items: RoleGrant[] }>(`/v1/users/${userId}/roles`),
    enabled: !!userId && canSeeRoles,
  });

  const grant = useMutation({
    mutationFn: (code: RoleCode) =>
      apiFetch<RoleGrant>(`/v1/users/${userId}/roles`, { method: "POST", body: { roleCode: code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rolesKey }),
  });

  const actsKey = ["mandate-acts", "pending", userId] as const;
  const acts = useQuery({
    queryKey: actsKey,
    queryFn: () =>
      apiFetch<{ items: MandateAct[] }>(`/v1/mandate-acts?status=PENDING&userId=${encodeURIComponent(userId)}`),
    enabled: !!userId && canAssign,
  });

  const propose = useMutation({
    mutationFn: (b: Bozza) =>
      apiFetch<MandateAct>("/v1/mandate-acts", {
        method: "POST",
        body: {
          kind: b.kind,
          userId,
          ...(b.kind === "GRANT" ? { roleCode: b.roleCode } : { grantId: b.grantId }),
          reason: motivo.trim(),
          ...(b.kind === "REVOKE" ? {} : { reviewBy: revisione }),
        },
      }),
    onSuccess: () => {
      setBozza(null);
      setMotivo("");
      void qc.invalidateQueries({ queryKey: actsKey });
    },
  });

  const withdraw = useMutation({
    mutationFn: (actId: string) => apiFetch<MandateAct>(`/v1/mandate-acts/${actId}/withdraw`, { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: actsKey }),
  });

  const apriBozza = (b: Bozza) => {
    propose.reset();
    setMotivo("");
    setRevisione(fraGiorni(180));
    setBozza(b);
  };

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

  // ADR-0050 D4: il codice d'errore dell'API dice perché l'atto non è nato; lo si mostra in parole.
  const actFailed = propose.isError ? propose.error : withdraw.isError ? withdraw.error : null;
  const actErrorText = actFailed
    ? isApiError(actFailed)
      ? actFailed.message
      : t("users.detail.roles.error")
    : null;
  const pending = acts.data?.items ?? [];
  const motivoValido = motivo.trim().length >= 10;

  const items = roles.data?.items ?? [];

  if (!canSeeRoles) return null;

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
                  <th className="py-2 pr-4 font-medium">{t("users.detail.roles.colReview")}</th>
                  {canAssign && <th className="py-2 pr-4 font-medium">{t("common:table.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((g) => (
                  <tr key={g.grantId} className="border-b last:border-0" data-testid={`user-role-${g.roleCode}`}>
                    <td className="py-2 pr-4 align-top" title={g.roleCode}>{t(`shell:roles.${g.roleCode}`, { defaultValue: codiceInParole(g.roleCode) })}</td>
                    <td className="py-2 pr-4 align-top text-muted-foreground">
                      {g.tenantId ? t("users.detail.roles.scopeTenant") : t("users.detail.roles.scopePlatform")}
                    </td>
                    <td className="py-2 pr-4 align-top text-muted-foreground">{f.data(g.grantedAt)}</td>
                    <td className="py-2 pr-4 align-top text-muted-foreground" data-testid={`user-role-review-${g.roleCode}`}>
                      {!MANDATI.has(g.roleCode)
                        ? "—"
                        : g.actId && g.reviewBy
                          ? f.data(g.reviewBy)
                          : <Badge variant="outline">{t("users.detail.roles.act.toConfirm")}</Badge>}
                    </td>
                    {canAssign && (
                      <td className="py-2 pr-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {MANDATI.has(g.roleCode) ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                data-testid={`user-role-propose-revoke-${g.roleCode}`}
                                onClick={() => apriBozza({ kind: "REVOKE", roleCode: g.roleCode, grantId: g.grantId })}
                              >
                                {t("users.detail.roles.act.proposeRevoke")}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                data-testid={`user-role-propose-confirm-${g.roleCode}`}
                                onClick={() => apriBozza({ kind: "CONFIRM", roleCode: g.roleCode, grantId: g.grantId })}
                              >
                                {t("users.detail.roles.act.proposeConfirm")}
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              data-testid={`user-role-revoke-${g.roleCode}`}
                              disabled={revoke.isPending}
                              onClick={() => revoke.mutate(g.grantId)}
                            >
                              {t("users.detail.roles.revoke")}
                            </Button>
                          )}
                        </div>
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
              onClick={() =>
                MANDATI.has(roleCode) ? apriBozza({ kind: "GRANT", roleCode }) : grant.mutate(roleCode)
              }
            >
              {grant.isPending
                ? t("common:saving")
                : MANDATI.has(roleCode)
                  ? t("users.detail.roles.act.proposeGrant")
                  : t("users.detail.roles.grant")}
            </Button>
            {errorText && (
              <span data-testid="user-roles-error" className="text-sm text-danger">
                {errorText}
              </span>
            )}
          </div>
        )}

        {canAssign && MANDATI.has(roleCode) && !bozza && (
          <p className="text-sm text-muted-foreground" data-testid="user-roles-mandate-hint">
            {t("users.detail.roles.act.hint")}
          </p>
        )}

        {canAssign && bozza && (
          <div className="space-y-3 rounded-control border border-border p-4" data-testid="user-roles-act-form">
            <p className="text-sm font-medium text-foreground">
              {t(`users.detail.roles.act.title.${bozza.kind}`, {
                role: t(`shell:roles.${bozza.roleCode}`, { defaultValue: codiceInParole(bozza.roleCode) }),
              })}
            </p>
            <div>
              <label htmlFor="user-role-act-reason" className="mb-1 block text-sm font-medium text-foreground">
                {t("users.detail.roles.act.reason")}
              </label>
              <Input
                id="user-role-act-reason"
                data-testid="user-role-act-reason"
                value={motivo}
                maxLength={2000}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("users.detail.roles.act.reasonHint")}</p>
            </div>
            {bozza.kind !== "REVOKE" && (
              <div className="max-w-56">
                <label htmlFor="user-role-act-review" className="mb-1 block text-sm font-medium text-foreground">
                  {t("users.detail.roles.act.reviewBy")}
                </label>
                <Input
                  id="user-role-act-review"
                  data-testid="user-role-act-review"
                  type="date"
                  min={fraGiorni(1)}
                  max={fraGiorni(MANDATE_REVIEW_MAX_DAYS)}
                  value={revisione}
                  onChange={(e) => setRevisione(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                data-testid="user-role-act-submit"
                disabled={propose.isPending || !motivoValido}
                onClick={() => propose.mutate(bozza)}
              >
                {propose.isPending ? t("common:saving") : t("users.detail.roles.act.submit")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setBozza(null)}>
                {t("users.detail.roles.act.cancel")}
              </Button>
            </div>
          </div>
        )}

        {propose.isSuccess && !bozza && (
          <p className="text-sm text-muted-foreground" data-testid="user-roles-act-sent">
            {t("users.detail.roles.act.sent")}
          </p>
        )}
        {actErrorText && (
          <p data-testid="user-roles-act-error" className="text-sm text-danger">
            {actErrorText}
          </p>
        )}

        {canAssign && pending.length > 0 && (
          <div className="space-y-2" data-testid="user-roles-pending">
            <p className="text-sm font-medium text-foreground">{t("users.detail.roles.act.pendingTitle")}</p>
            <ul className="space-y-2">
              {pending.map((a) => (
                <li key={a.actId} className="flex flex-wrap items-center gap-3 text-sm" data-testid={`user-role-pending-${a.actId}`}>
                  <Badge variant="secondary">{t(`users.detail.roles.act.kind.${a.kind}`)}</Badge>
                  <span>{t(`shell:roles.${a.roleCode}`, { defaultValue: codiceInParole(a.roleCode) })}</span>
                  <span className="text-muted-foreground">
                    {t("users.detail.roles.act.proposedBy", { who: a.proposedByDisplayName ?? "—", when: f.data(a.proposedAt) })}
                  </span>
                  {a.proposedBy === me.data?.userId && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={withdraw.isPending}
                      data-testid={`user-role-pending-withdraw-${a.actId}`}
                      onClick={() => withdraw.mutate(a.actId)}
                    >
                      {t("users.detail.roles.act.withdraw")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
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
