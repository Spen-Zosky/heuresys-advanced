"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { QRCodeSVG } from "qrcode.react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import {
  type EnrollMfaResponse,
  type ListMfaFactorsResponse,
  type MfaFactorListItem,
  type VerifyMfaSetupResponse,
} from "@heuresys/shared";
import { apiFetch } from "../../../../lib/api/fetch";

const VerifyCodeFormSchema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/, "Codice TOTP di 6 cifre richiesto"),
});
type VerifyCodeFormValues = z.infer<typeof VerifyCodeFormSchema>;

export default function MeSecurityPage() {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [pendingFactor, setPendingFactor] = useState<EnrollMfaResponse | null>(null);

  const factors = useQuery({
    queryKey: ["me", "mfa", "factors"],
    queryFn: () => apiFetch<ListMfaFactorsResponse>("/v1/auth/mfa/factors"),
  });

  const enroll = useMutation({
    mutationFn: () =>
      apiFetch<EnrollMfaResponse>("/v1/auth/mfa/enroll", {
        method: "POST",
        body: {},
      }),
    onSuccess: (data) => {
      setPendingFactor(data);
      setFeedback(null);
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : "Errore inatteso",
      });
    },
  });

  const verify = useMutation({
    mutationFn: (body: { factorId: string; code: string }) =>
      apiFetch<VerifyMfaSetupResponse>("/v1/auth/mfa/verify-setup", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
      setPendingFactor(null);
      setFeedback({ kind: "ok", msg: "Fattore TOTP verificato e attivo." });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : "Codice non valido",
      });
    },
  });

  const remove = useMutation({
    mutationFn: (factorId: string) =>
      apiFetch<void>(`/v1/auth/mfa/factors/${factorId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
      setFeedback({ kind: "ok", msg: "Fattore rimosso." });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : "Errore rimozione",
      });
    },
  });

  const form = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(VerifyCodeFormSchema),
    defaultValues: { code: "" },
  });

  const onVerify = form.handleSubmit((values) => {
    if (!pendingFactor) return;
    verify.mutate({ factorId: pendingFactor.factorId, code: values.code });
  });

  return (
    <main
      data-testid="me-security-page"
      className="max-w-3xl mx-auto px-6 py-8 space-y-6"
    >
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-security-title">
          Sicurezza account
        </h1>
        <p className="text-sm opacity-70 mt-1">
          Gestione fattori MFA per autenticazione a due fattori.
        </p>
      </header>

      {feedback ? (
        <div
          data-testid={feedback.kind === "ok" ? "me-security-success" : "me-security-error"}
          className={
            feedback.kind === "ok"
              ? "rounded border border-green-600/40 bg-green-50 px-4 py-2 text-sm text-green-900"
              : "rounded border border-red-600/40 bg-red-50 px-4 py-2 text-sm text-red-900"
          }
        >
          {feedback.msg}
        </div>
      ) : null}

      <Card data-testid="me-security-factors-card">
        <CardHeader>
          <CardTitle>
            Fattori attivi{" "}
            <span
              data-testid="me-security-factors-count"
              className="text-sm font-normal opacity-70 ml-2"
            >
              ({factors.data?.total ?? "—"} totali)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {factors.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : factors.data && factors.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-security-factors-empty">
              Nessun fattore configurato. Aggiungi un autenticatore TOTP per
              attivare la protezione a due fattori.
            </div>
          ) : (
            <ul className="divide-y" data-testid="me-security-factors-list">
              {factors.data!.items.map((f: MfaFactorListItem) => (
                <li
                  key={f.factorId}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                  data-testid="me-security-factor-row"
                >
                  <div className="text-sm">
                    <div className="font-medium" data-testid="me-security-factor-kind">
                      {f.kind}
                    </div>
                    <div className="text-xs opacity-70 font-mono">
                      {f.verified ? "verificato" : "in attesa di verifica"} ·{" "}
                      creato {new Date(f.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    data-testid="me-security-factor-delete"
                    onClick={() => {
                      if (confirm(`Rimuovere il fattore ${f.kind}?`)) {
                        remove.mutate(f.factorId);
                      }
                    }}
                  >
                    Rimuovi
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {pendingFactor ? (
        <Card data-testid="me-security-enroll-pending-card">
          <CardHeader>
            <CardTitle>Verifica TOTP in corso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Scansiona il QR con la tua app di autenticazione (Google
              Authenticator, Authy, 1Password, ecc.) e inserisci il codice di
              6 cifre per completare la registrazione.
            </p>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div
                data-testid="me-security-enroll-qr"
                className="rounded border border-border bg-white p-3"
              >
                <QRCodeSVG
                  value={pendingFactor.otpauthUri}
                  size={180}
                  includeMargin={false}
                  level="M"
                />
              </div>
              <div className="text-xs flex-1 space-y-2">
                <p className="opacity-70">
                  Se non puoi scansionare il QR, inserisci manualmente la chiave:
                </p>
                <code
                  data-testid="me-security-enroll-secret"
                  className="block break-all rounded bg-muted px-2 py-1 font-mono"
                >
                  {pendingFactor.secret}
                </code>
              </div>
            </div>

            <form
              onSubmit={onVerify}
              className="space-y-3"
              data-testid="me-security-verify-form"
            >
              <label className="block text-sm">
                <span>Codice TOTP</span>
                <Input
                  {...form.register("code")}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  data-testid="me-security-verify-code"
                  autoComplete="one-time-code"
                  className="mt-1"
                />
                {form.formState.errors.code ? (
                  <span className="text-xs text-red-600">
                    {form.formState.errors.code.message}
                  </span>
                ) : null}
              </label>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  data-testid="me-security-verify-submit"
                  disabled={verify.isPending}
                >
                  {verify.isPending ? "Verifico…" : "Verifica e attiva"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="me-security-enroll-cancel"
                  onClick={() => {
                    setPendingFactor(null);
                    form.reset();
                  }}
                >
                  Annulla
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button
            type="button"
            data-testid="me-security-enroll-button"
            onClick={() => enroll.mutate()}
            disabled={enroll.isPending}
          >
            {enroll.isPending ? "Generazione…" : "Aggiungi autenticatore TOTP"}
          </Button>
        </div>
      )}
    </main>
  );
}
