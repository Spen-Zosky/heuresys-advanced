"use client";

/**
 * Sicurezza degli accessi (ondata 3 degli endpoint senza consumatori, 2026-11-17).
 *
 * - `CodiciDiRecupero` (per sé, in /me/security): quanti codici di recupero restano
 *   (`GET /v1/auth/mfa/recovery-codes`) e la loro rigenerazione (`POST`), che li mostra UNA volta.
 * - `SessioniUtente` (amministrazione, in /users/[userId]): le sessioni aperte di una persona
 *   (`GET /v1/auth/admin/users/:userId/sessions`) e la loro chiusura in blocco
 *   (`POST /v1/auth/admin/revoke-user/:userId`), con `auth:sessions_read` e `auth:revoke_user`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { GenerateRecoveryCodesResponse, RecoveryCodesCountResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";
import { dispositivoLeggibile } from "@/lib/person-label";

export function CodiciDiRecupero() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();
  const [nuovi, setNuovi] = useState<string[] | null>(null);
  const conteggio = useQuery({
    queryKey: ["me", "recovery-codes"],
    queryFn: () => apiFetch<RecoveryCodesCountResponse>("/v1/auth/mfa/recovery-codes"),
  });
  const rigenera = useMutation({
    mutationFn: () => apiFetch<GenerateRecoveryCodesResponse>("/v1/auth/mfa/recovery-codes", { method: "POST", body: {} }),
    onSuccess: (r) => { setNuovi(r.codes); void qc.invalidateQueries({ queryKey: ["me", "recovery-codes"] }); },
  });
  return (
    <Card data-testid="me-recovery-codes">
      <CardHeader><CardTitle>{t("security.recupero.titolo")}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p data-testid="me-recovery-codes-count">
          {conteggio.data ? t("security.recupero.restano", { count: conteggio.data.remaining }) : conteggio.isError ? t("security.recupero.erroreCarica") : t("common:loading")}
        </p>
        <p className="text-xs text-muted-foreground">{t("security.recupero.spiega")}</p>
        <Button type="button" variant="outline" data-testid="me-recovery-codes-generate" disabled={rigenera.isPending}
          onClick={() => { if (window.confirm(t("security.recupero.conferma"))) rigenera.mutate(); }}>
          {rigenera.isPending ? t("security.recupero.generando") : t("security.recupero.genera")}
        </Button>
        {rigenera.isError && <p className="text-danger">{t("security.recupero.errore")}</p>}
        {nuovi && (
          <div data-testid="me-recovery-codes-new" className="space-y-2 rounded-card border border-warning bg-card p-3">
            <p className="font-medium">{t("security.recupero.unaVolta")}</p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
              {nuovi.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <Button type="button" size="sm" variant="outline" onClick={() => setNuovi(null)}>{t("security.recupero.salvati")}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface Sessione { familyId: string; firstIssuedAt: string; lastIssuedAt: string; expiresAt: string; ip: string | null; userAgent: string | null }

export function SessioniUtente({ userId }: { userId: string }) {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const puoLeggere = perms.includes("auth:sessions_read");
  const puoChiudere = perms.includes("auth:revoke_user");
  const sessioni = useQuery({
    queryKey: ["auth", "admin-sessions", userId],
    queryFn: () => apiFetch<{ items: Sessione[]; total: number }>(`/v1/auth/admin/users/${userId}/sessions`),
    enabled: puoLeggere,
  });
  const chiudi = useMutation({
    mutationFn: () => apiFetch(`/v1/auth/admin/revoke-user/${userId}`, { method: "POST", body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["auth", "admin-sessions", userId] }),
  });
  if (!puoLeggere) return null;
  const righe = sessioni.data?.items ?? [];
  return (
    <Card data-testid="user-sessions">
      <CardHeader><CardTitle>{t("users.sessioni.titolo", { count: righe.length })}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {sessioni.isLoading ? <p className="text-muted-foreground">{t("common:loading")}</p> : righe.length === 0 ? (
          <p data-testid="user-sessions-empty" className="text-muted-foreground">{t("users.sessioni.nessuna")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border">
            {righe.map((s) => (
              <li key={s.familyId} data-testid="user-session-row" className="px-4 py-2">
                <span className="font-medium">{dispositivoLeggibile(s.userAgent, (b, so) => t("users.sessioni.dispositivo", { browser: b, sistema: so }))}</span>
                <span className="text-xs text-muted-foreground"> · {t("users.sessioni.ultimo", { data: fmt.dataOra(s.lastIssuedAt) })} · {t("users.sessioni.scade", { data: fmt.dataOra(s.expiresAt) })}</span>
              </li>
            ))}
          </ul>
        )}
        {puoChiudere && righe.length > 0 && (
          <Button type="button" variant="outline" data-testid="user-sessions-revoke" disabled={chiudi.isPending}
            onClick={() => { if (window.confirm(t("users.sessioni.conferma"))) chiudi.mutate(); }}>
            {chiudi.isPending ? t("common:saving") : t("users.sessioni.chiudiTutte")}
          </Button>
        )}
        {chiudi.isSuccess && <p className="text-success">{t("users.sessioni.chiuse")}</p>}
        {chiudi.isError && <p className="text-danger">{t("users.sessioni.errore")}</p>}
      </CardContent>
    </Card>
  );
}
