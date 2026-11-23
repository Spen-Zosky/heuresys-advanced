"use client";

/**
 * Privacy e notifiche della persona (ondata 2 degli endpoint senza consumatori, 2026-11-17).
 * `PATCH /v1/me/notification-preferences`, `POST /v1/me/gdpr/export` e `POST /v1/me/consents`
 * esistevano e nessuna pagina li chiamava: una persona non poteva scegliere come ricevere gli avvisi,
 * scaricare i propri dati (GDPR art. 15 e 20) né dare o togliere un consenso. Ogni scelta è sua e
 * solo sua: le rotte sono `self`, il registro dei consensi si allunga e non si riscrive.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { ConsentStateResponse, NotificationPreferencesResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";

export function PreferenzeNotifiche() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();
  const puo = (useCurrentUserPermissions().data?.permissions ?? []).includes("notification:read:self");
  const pref = useQuery({
    queryKey: ["me", "notification-preferences"],
    queryFn: () => apiFetch<NotificationPreferencesResponse>("/v1/me/notification-preferences"),
    enabled: puo,
  });
  const cambia = useMutation({
    mutationFn: (b: { notificationType: string; inAppEnabled?: boolean; emailEnabled?: boolean }) =>
      apiFetch("/v1/me/notification-preferences", { method: "PATCH", body: b }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["me", "notification-preferences"] }),
  });
  if (!puo) return null;
  return (
    <Card data-testid="me-notification-preferences">
      <CardHeader><CardTitle as="h2">{t("security.privacy.notificheTitolo")}</CardTitle></CardHeader>
      <CardContent>
        {pref.isLoading ? <p className="text-sm text-muted-foreground">{t("common:loading")}</p> : pref.isError ? (
          <p className="text-sm text-danger">{t("security.privacy.erroreCarica")}</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">{t("security.privacy.notificheTitolo")}</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1">{t("security.privacy.tipo")}</th>
                <th className="py-1">{t("security.privacy.nellApp")}</th>
                <th className="py-1">{t("security.privacy.email")}</th>
              </tr>
            </thead>
            <tbody>
              {(pref.data?.items ?? []).map((p) => (
                <tr key={p.notificationType} data-testid="me-notification-row" className="border-t border-border">
                  <td className="py-2">{t(`security.privacy.tipi.${p.notificationType}`)}</td>
                  <td className="py-2">
                    <input type="checkbox" aria-label={`${t(`security.privacy.tipi.${p.notificationType}`)}: ${t("security.privacy.nellApp")}`}
                      data-testid="me-notification-inapp" checked={p.inAppEnabled} disabled={cambia.isPending}
                      onChange={(e) => cambia.mutate({ notificationType: p.notificationType, inAppEnabled: e.target.checked })} />
                  </td>
                  <td className="py-2">
                    <input type="checkbox" aria-label={`${t(`security.privacy.tipi.${p.notificationType}`)}: ${t("security.privacy.email")}`}
                      data-testid="me-notification-email" checked={p.emailEnabled} disabled={cambia.isPending}
                      onChange={(e) => cambia.mutate({ notificationType: p.notificationType, emailEnabled: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {cambia.isError && <p className="mt-2 text-sm text-danger">{t("security.privacy.erroreSalva")}</p>}
      </CardContent>
    </Card>
  );
}

export function ConsensiEDati() {
  const { t } = useTranslation("ess");
  const fmt = useFormat();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const puoConsensi = perms.includes("consent:manage:self");
  const puoEsportare = perms.includes("gdpr:export:self");
  const consensi = useQuery({
    queryKey: ["me", "consents"],
    queryFn: () => apiFetch<ConsentStateResponse>("/v1/me/consents"),
    enabled: puoConsensi,
  });
  const registra = useMutation({
    mutationFn: (b: { purpose: string; action: "GRANT" | "REVOKE" }) => apiFetch("/v1/me/consents", { method: "POST", body: b }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["me", "consents"] }),
  });
  const esporta = useMutation({
    mutationFn: () => apiFetch<unknown>("/v1/me/gdpr/export", { method: "POST", body: {} }),
    onSuccess: (dati) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `i-miei-dati-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
  if (!puoConsensi && !puoEsportare) return null;
  return (
    <Card data-testid="me-privacy">
      <CardHeader><CardTitle as="h2">{t("security.privacy.titolo")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {puoConsensi && (
          <ul className="divide-y divide-border rounded-card border border-border">
            {(consensi.data?.items ?? []).map((c) => (
              <li key={c.purpose} data-testid="me-consent-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
                <span>
                  <span className="font-medium">{t(`security.privacy.finalita.${c.purpose}`)}</span>
                  {c.lastChangedAt && <span className="text-xs text-muted-foreground"> · {t("security.privacy.dal", { data: fmt.dataOra(c.lastChangedAt) })}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={c.granted ? "success" : "secondary"} data-testid="me-consent-state">
                    {c.granted ? t("security.privacy.dato") : t("security.privacy.nonDato")}
                  </Badge>
                  <Button type="button" size="sm" variant="outline" data-testid="me-consent-toggle" disabled={registra.isPending}
                    onClick={() => registra.mutate({ purpose: c.purpose, action: c.granted ? "REVOKE" : "GRANT" })}>
                    {c.granted ? t("security.privacy.togli") : t("security.privacy.dai")}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {registra.isError && <p className="text-sm text-danger">{t("security.privacy.erroreSalva")}</p>}
        {puoEsportare && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" data-testid="me-gdpr-export" disabled={esporta.isPending} onClick={() => esporta.mutate()}>
              {esporta.isPending ? t("security.privacy.esportando") : t("security.privacy.esporta")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("security.privacy.esportaSpiega")}</span>
            {esporta.isSuccess && <span data-testid="me-gdpr-export-ok" className="text-sm text-success">{t("security.privacy.esportato")}</span>}
            {esporta.isError && <span className="text-sm text-danger">{t("security.privacy.erroreEsporta")}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
