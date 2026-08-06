"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
} from "@heuresys/ui";
import {
  type EnrollMfaResponse,
  type ListMfaFactorsResponse,
  type MfaFactorListItem,
  type VerifyMfaSetupResponse,
  type EnrollEmailOtpResponse,
  type VerifyEmailOtpSetupResponse,
  type ResendEmailOtpResponse,
  type EnrollSmsOtpResponse,
  type VerifySmsOtpSetupResponse,
  type ResendSmsOtpResponse,
  type ConfirmEnrollResponse,
  type ResendEnrollConfirmResponse,
  type WebauthnRegistrationVerifyResponse,
  type ActiveSession,
  type ListActiveSessionsResponse,
  type CurrentSessionResponse,
} from "@heuresys/shared";
import { apiFetch } from "../../../../lib/api/fetch";
import { isApiError } from "../../../../lib/api/errors";
import { useEnumLabel } from "@/lib/enum-labels";

// Stable no-op subscribe for useSyncExternalStore reads of immutable browser capabilities.
const subscribeNever = () => () => {};

type SecI18n = (key: string) => string;
function buildVerifyCodeSchema(t: SecI18n) {
  return z.object({
    code: z.string().regex(/^\d{6}$/, t("security.codeRequired")),
  });
}
type VerifyCodeFormValues = z.infer<ReturnType<typeof buildVerifyCodeSchema>>;

export default function MeSecurityPage() {
  const { t } = useTranslation("ess");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [pendingFactor, setPendingFactor] = useState<EnrollMfaResponse | null>(null);
  const [pendingEmailOtp, setPendingEmailOtp] = useState<EnrollEmailOtpResponse | null>(null);
  // SMS_OTP: phone prompt -> pending code verify (mirrors the EMAIL_OTP card).
  const [smsPrompt, setSmsPrompt] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [pendingSmsOtp, setPendingSmsOtp] = useState<EnrollSmsOtpResponse | null>(null);
  // TOFU v2: factor passed its possession proof but awaits the out-of-band
  // email confirmation (first self-owned factor, confirm mode ON server-side).
  const [pendingConfirm, setPendingConfirm] = useState<{ factorId: string; emailHint: string } | null>(null);

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
        msg: err instanceof Error ? err.message : t("security.errorUnexpected"),
      });
    },
  });

  const verify = useMutation({
    mutationFn: (body: { factorId: string; code: string }) =>
      apiFetch<VerifyMfaSetupResponse>("/v1/auth/mfa/verify-setup", {
        method: "POST",
        body,
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
      setPendingFactor(null);
      if (!data.verified) {
        // TOFU v2: out-of-band email confirmation required before activation.
        setPendingConfirm({ factorId: data.factorId, emailHint: data.emailHint });
        setFeedback(null);
        return;
      }
      setFeedback({ kind: "ok", msg: t("security.verifiedActive") });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : t("security.errorInvalidCode"),
      });
    },
  });

  const remove = useMutation({
    mutationFn: (factorId: string) =>
      apiFetch<void>(`/v1/auth/mfa/factors/${factorId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
      setFeedback({ kind: "ok", msg: t("security.factorRemoved") });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : t("security.errorRemove"),
      });
    },
  });

  /**
   * Annullare un arruolamento CANCELLA il fattore pendente sul server.
   *
   * Prima l'annulla era solo di facciata (`setPendingFactor(null)` e basta): la
   * riga restava, e chi annullava si ritrovava in lista un fattore «in attesa
   * di verifica» che credeva di non aver mai creato. Misurato in S1047 (#152):
   * 26 fattori TOTP mai verificati accumulati in produzione, uno strato per
   * ogni corsa degli E2E — che premono esattamente questo pulsante.
   *
   * Silenziosa di proposito: `remove` esiste già ma annuncia «fattore rimosso»,
   * che qui sarebbe fuori luogo — l'utente sta annullando, non rimuovendo. E un
   * fallimento non deve bloccare la chiusura del riquadro: chi ha chiesto di
   * annullare ha diritto di vederlo chiuso, e un fattore non verificato non
   * concede alcun accesso.
   */
  const cancelPending = useMutation({
    mutationFn: (factorId: string) =>
      apiFetch<void>(`/v1/auth/mfa/factors/${factorId}`, { method: "DELETE" }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
    },
  });

  // --- EMAIL_OTP enrollment ---
  const enrollEmail = useMutation({
    mutationFn: () =>
      apiFetch<EnrollEmailOtpResponse>("/v1/auth/mfa/email-otp/enroll", {
        method: "POST",
        body: {},
      }),
    onSuccess: (data) => {
      setPendingEmailOtp(data);
      setPendingFactor(null);
      setFeedback(null);
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : t("security.errorUnexpected"),
      });
    },
  });

  const verifyEmail = useMutation({
    mutationFn: (body: { factorId: string; code: string }) =>
      apiFetch<VerifyEmailOtpSetupResponse>("/v1/auth/mfa/email-otp/verify-setup", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
      setPendingEmailOtp(null);
      setFeedback({ kind: "ok", msg: t("security.emailVerifiedActive") });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : t("security.errorInvalidCode"),
      });
    },
  });

  const resendEmail = useMutation({
    mutationFn: (factorId: string) =>
      apiFetch<ResendEmailOtpResponse>("/v1/auth/mfa/email-otp/resend", {
        method: "POST",
        body: { factorId },
      }),
    onSuccess: () => {
      setFeedback({ kind: "ok", msg: t("security.emailResent") });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : t("security.errorResend"),
      });
    },
  });

  // --- SMS_OTP enrollment (code-only slice; server gates on a real provider) ---
  const enrollSms = useMutation({
    mutationFn: (phoneNumber: string) =>
      apiFetch<EnrollSmsOtpResponse>("/v1/auth/mfa/sms-otp/enroll", {
        method: "POST",
        body: { phoneNumber },
      }),
    onSuccess: (data) => {
      setPendingSmsOtp(data);
      setSmsPrompt(false);
      setPendingFactor(null);
      setPendingEmailOtp(null);
      setFeedback(null);
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
    },
    onError: (err) => {
      setSmsPrompt(false);
      setFeedback({
        kind: "err",
        msg:
          isApiError(err) && err.code === "SMS_NOT_CONFIGURED"
            ? t("security.smsNotConfigured")
            : err instanceof Error
              ? err.message
              : t("security.errorUnexpected"),
      });
    },
  });

  const verifySms = useMutation({
    mutationFn: (body: { factorId: string; code: string }) =>
      apiFetch<VerifySmsOtpSetupResponse>("/v1/auth/mfa/sms-otp/verify-setup", {
        method: "POST",
        body,
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
      setPendingSmsOtp(null);
      if (!data.verified) {
        setPendingConfirm({ factorId: data.factorId, emailHint: data.emailHint });
        setFeedback(null);
        return;
      }
      setFeedback({ kind: "ok", msg: t("security.smsVerifiedActive") });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : t("security.errorInvalidCode"),
      });
    },
  });

  // --- TOFU v2: out-of-band enroll confirmation ---
  const confirmEnroll = useMutation({
    mutationFn: (body: { factorId: string; code: string }) =>
      apiFetch<ConfirmEnrollResponse>("/v1/auth/mfa/enroll-confirm", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
      setPendingConfirm(null);
      setFeedback({ kind: "ok", msg: t("security.confirmVerifiedActive") });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : t("security.errorInvalidCode"),
      });
    },
  });

  const resendConfirm = useMutation({
    mutationFn: (factorId: string) =>
      apiFetch<ResendEnrollConfirmResponse>("/v1/auth/mfa/enroll-confirm/resend", {
        method: "POST",
        body: { factorId },
      }),
    onSuccess: () => {
      setFeedback({ kind: "ok", msg: t("security.emailResent") });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : t("security.errorResend"),
      });
    },
  });

  const resendSms = useMutation({
    mutationFn: (factorId: string) =>
      apiFetch<ResendSmsOtpResponse>("/v1/auth/mfa/sms-otp/resend", {
        method: "POST",
        body: { factorId },
      }),
    onSuccess: () => {
      setFeedback({ kind: "ok", msg: t("security.smsResent") });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : t("security.errorResend"),
      });
    },
  });

  // --- Active sessions (MVP-4 §2.5) — refresh-token families. The current family is
  // resolved via /v1/auth/sessions/current (access JWT `fam` claim). ---
  const sessions = useQuery({
    queryKey: ["me", "sessions"],
    queryFn: () => apiFetch<ListActiveSessionsResponse>("/v1/me/security/sessions"),
  });
  const current = useQuery({
    queryKey: ["auth", "session", "current"],
    queryFn: () => apiFetch<CurrentSessionResponse>("/v1/auth/sessions/current"),
  });
  const currentFamilyId = current.data?.familyId ?? null;

  const revokeSession = useMutation({
    mutationFn: (familyId: string) => apiFetch<{ revoked: true }>(`/v1/me/security/sessions/${familyId}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["me", "sessions"] }); setFeedback({ kind: "ok", msg: t("security.sessions.revokedOk") }); },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("security.errorUnexpected") }),
  });
  const revokeOthers = useMutation({
    mutationFn: () => apiFetch<{ revokedFamilies: number }>("/v1/me/security/sessions/revoke-others", { method: "POST", body: { currentFamilyId } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["me", "sessions"] }); setFeedback({ kind: "ok", msg: t("security.sessions.revokedOthersOk") }); },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("security.errorUnexpected") }),
  });

  // --- WebAuthn passkey enrollment (MVP-4 §2.5) ---
  // Gated by secure-context: localhost is exempt, but a plain-HTTP non-localhost
  // origin disables the WebAuthn JS API entirely → show an "unavailable" note there
  // instead of a broken button (passkeys need HTTPS on PROD until TLS lands).
  // useSyncExternalStore (never-firing subscribe): the capability is fixed for the page's
  // lifetime; server snapshot=false keeps SSR/hydration consistent without a setState-in-effect.
  const passkeySupported = useSyncExternalStore(
    subscribeNever,
    () => window.isSecureContext && typeof window.PublicKeyCredential !== "undefined",
    () => false,
  );
  const enrollPasskey = useMutation({
    mutationFn: async () => {
      const opt = await apiFetch<{ factorId: string; options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>(
        "/v1/auth/mfa/webauthn/registration/options",
        { method: "POST", body: {} },
      );
      const attResp = await startRegistration({ optionsJSON: opt.options });
      return apiFetch<WebauthnRegistrationVerifyResponse>(
        "/v1/auth/mfa/webauthn/registration/verify",
        {
          method: "POST",
          body: { factorId: opt.factorId, response: attResp, deviceLabel: "Passkey" },
        },
      );
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
      if (!data.verified) {
        // TOFU v2: passkey registered but pending the out-of-band email confirm.
        setPendingConfirm({ factorId: data.factorId, emailHint: data.emailHint });
        setFeedback(null);
        return;
      }
      setFeedback({ kind: "ok", msg: t("security.passkeyEnrolled") });
    },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("security.errorPasskey") }),
  });

  const verifyCodeSchema = useMemo(() => buildVerifyCodeSchema(t), [t]);
  const form = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: "" },
  });

  const onVerify = form.handleSubmit((values) => {
    if (!pendingFactor) return;
    verify.mutate({ factorId: pendingFactor.factorId, code: values.code });
  });

  const emailForm = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: "" },
  });

  const onVerifyEmail = emailForm.handleSubmit((values) => {
    if (!pendingEmailOtp) return;
    verifyEmail.mutate({ factorId: pendingEmailOtp.factorId, code: values.code });
  });

  const smsForm = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: "" },
  });

  const onVerifySms = smsForm.handleSubmit((values) => {
    if (!pendingSmsOtp) return;
    verifySms.mutate({ factorId: pendingSmsOtp.factorId, code: values.code });
  });

  const confirmForm = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: "" },
  });

  const onConfirmEnroll = confirmForm.handleSubmit((values) => {
    if (!pendingConfirm) return;
    confirmEnroll.mutate({ factorId: pendingConfirm.factorId, code: values.code });
  });

  return (
    <main
      data-testid="me-security-page"
      className="mx-auto max-w-3xl space-y-6 px-6 py-8"
    >
      <PageHeader
        data-testid="me-security-title"
        title={t("security.title")}
        description={t("security.description")}
        badges={
          <Badge variant="secondary" data-testid="me-security-factors-count">
            {t("security.count", { count: factors.data?.total ?? "—" })}
          </Badge>
        }
      />

      {feedback ? (
        <div
          data-testid={feedback.kind === "ok" ? "me-security-success" : "me-security-error"}
          className={
            feedback.kind === "ok"
              ? "rounded-card border border-success/40 bg-success/10 px-4 py-2 text-sm text-success"
              : "rounded-card border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger"
          }
        >
          {feedback.msg}
        </div>
      ) : null}

      <Card data-testid="me-security-factors-card">
        <CardHeader>
          <CardTitle>{t("security.factorsCardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {factors.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">{t("common:loading")}</div>
          ) : factors.data && factors.data.items.length === 0 ? (
            <div
              className="p-6 text-sm text-muted-foreground"
              data-testid="me-security-factors-empty"
            >
              {t("security.factorsEmpty")}
            </div>
          ) : (
            <ul className="divide-y divide-border" data-testid="me-security-factors-list">
              {factors.data!.items.map((f: MfaFactorListItem) => (
                <li
                  key={f.factorId}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  data-testid="me-security-factor-row"
                >
                  <div className="text-sm">
                    <div
                      className="font-medium text-foreground"
                      data-testid="me-security-factor-kind"
                    >
                      {enumLabel("mfaKind", f.kind)}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {f.verified ? t("security.verified") : t("security.pendingVerification")} ·{" "}
                      {t("security.createdAt", { date: new Date(f.createdAt).toLocaleDateString() })}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-danger"
                    data-testid="me-security-factor-delete"
                    onClick={() => {
                      if (confirm(t("security.removeConfirm", { kind: enumLabel("mfaKind", f.kind) }))) {
                        remove.mutate(f.factorId);
                      }
                    }}
                  >
                    {t("security.remove")}
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
            <CardTitle>{t("security.pendingCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {t("security.pendingInstruction")}
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
              <div className="flex-1 space-y-2 text-xs">
                <p className="text-muted-foreground">
                  {t("security.manualKeyHint")}
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
                <span>{t("security.totpCodeLabel")}</span>
                <Input
                  {...form.register("code")}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t("security.totpCodePlaceholder")}
                  data-testid="me-security-verify-code"
                  autoComplete="one-time-code"
                  className="mt-1"
                />
                {form.formState.errors.code ? (
                  <span className="text-xs text-danger">
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
                  {verify.isPending ? t("security.verifying") : t("security.verifySubmit")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="me-security-enroll-cancel"
                  onClick={() => {
                    if (pendingFactor) cancelPending.mutate(pendingFactor.factorId);
                    setPendingFactor(null);
                    form.reset();
                  }}
                >
                  {t("security.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : pendingEmailOtp ? (
        <Card data-testid="me-security-emailotp-pending-card">
          <CardHeader>
            <CardTitle>{t("security.emailPendingCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm" data-testid="me-security-emailotp-hint">
              {t("security.emailPendingInstruction", { email: pendingEmailOtp.emailHint })}
            </p>

            <form
              onSubmit={onVerifyEmail}
              className="space-y-3"
              data-testid="me-security-emailotp-verify-form"
            >
              <label className="block text-sm">
                <span>{t("security.emailCodeLabel")}</span>
                <Input
                  {...emailForm.register("code")}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t("security.totpCodePlaceholder")}
                  data-testid="me-security-emailotp-verify-code"
                  autoComplete="one-time-code"
                  className="mt-1"
                />
                {emailForm.formState.errors.code ? (
                  <span className="text-xs text-danger">
                    {emailForm.formState.errors.code.message}
                  </span>
                ) : null}
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  data-testid="me-security-emailotp-verify-submit"
                  disabled={verifyEmail.isPending}
                >
                  {verifyEmail.isPending ? t("security.verifying") : t("security.verifySubmit")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="me-security-emailotp-resend"
                  disabled={resendEmail.isPending}
                  onClick={() => resendEmail.mutate(pendingEmailOtp.factorId)}
                >
                  {resendEmail.isPending ? t("security.emailResending") : t("security.emailResend")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="me-security-emailotp-cancel"
                  onClick={() => {
                    cancelPending.mutate(pendingEmailOtp.factorId);
                    setPendingEmailOtp(null);
                    emailForm.reset();
                  }}
                >
                  {t("security.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : pendingConfirm ? (
        <Card data-testid="me-security-confirm-card">
          <CardHeader>
            <CardTitle>{t("security.confirmCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm" data-testid="me-security-confirm-hint">
              {t("security.confirmInstruction", { email: pendingConfirm.emailHint })}
            </p>

            <form
              onSubmit={onConfirmEnroll}
              className="space-y-3"
              data-testid="me-security-confirm-form"
            >
              <label className="block text-sm">
                <span>{t("security.confirmCodeLabel")}</span>
                <Input
                  {...confirmForm.register("code")}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t("security.totpCodePlaceholder")}
                  data-testid="me-security-confirm-code"
                  autoComplete="one-time-code"
                  className="mt-1"
                />
                {confirmForm.formState.errors.code ? (
                  <span className="text-xs text-danger">
                    {confirmForm.formState.errors.code.message}
                  </span>
                ) : null}
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  data-testid="me-security-confirm-submit"
                  disabled={confirmEnroll.isPending}
                >
                  {confirmEnroll.isPending ? t("security.verifying") : t("security.verifySubmit")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="me-security-confirm-resend"
                  disabled={resendConfirm.isPending}
                  onClick={() => resendConfirm.mutate(pendingConfirm.factorId)}
                >
                  {resendConfirm.isPending ? t("security.emailResending") : t("security.emailResend")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="me-security-confirm-cancel"
                  onClick={() => {
                    setPendingConfirm(null);
                    confirmForm.reset();
                  }}
                >
                  {t("security.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : pendingSmsOtp ? (
        <Card data-testid="me-security-smsotp-pending-card">
          <CardHeader>
            <CardTitle>{t("security.smsPendingCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm" data-testid="me-security-smsotp-hint">
              {t("security.smsPendingInstruction", { phone: pendingSmsOtp.phoneHint })}
            </p>

            <form
              onSubmit={onVerifySms}
              className="space-y-3"
              data-testid="me-security-smsotp-verify-form"
            >
              <label className="block text-sm">
                <span>{t("security.smsCodeLabel")}</span>
                <Input
                  {...smsForm.register("code")}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t("security.totpCodePlaceholder")}
                  data-testid="me-security-smsotp-verify-code"
                  autoComplete="one-time-code"
                  className="mt-1"
                />
                {smsForm.formState.errors.code ? (
                  <span className="text-xs text-danger">
                    {smsForm.formState.errors.code.message}
                  </span>
                ) : null}
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  data-testid="me-security-smsotp-verify-submit"
                  disabled={verifySms.isPending}
                >
                  {verifySms.isPending ? t("security.verifying") : t("security.verifySubmit")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="me-security-smsotp-resend"
                  disabled={resendSms.isPending}
                  onClick={() => resendSms.mutate(pendingSmsOtp.factorId)}
                >
                  {resendSms.isPending ? t("security.smsResending") : t("security.smsResend")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="me-security-smsotp-cancel"
                  onClick={() => {
                    setPendingSmsOtp(null);
                    smsForm.reset();
                  }}
                >
                  {t("security.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : smsPrompt ? (
        <Card data-testid="me-security-sms-phone-card">
          <CardHeader>
            <CardTitle>{t("security.smsPhoneCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enrollSms.mutate(smsPhone.trim());
              }}
              className="space-y-3"
              data-testid="me-security-sms-phone-form"
            >
              <label className="block text-sm">
                <span>{t("security.smsPhoneLabel")}</span>
                <Input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+393331234567"
                  data-testid="me-security-sms-phone-input"
                  className="mt-1"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value.replace(/[^\d+]/g, ""))}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  data-testid="me-security-sms-phone-submit"
                  disabled={enrollSms.isPending || !/^\+[1-9]\d{6,14}$/.test(smsPhone)}
                >
                  {enrollSms.isPending ? t("security.enrolling") : t("security.smsSend")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="me-security-sms-phone-cancel"
                  onClick={() => {
                    setSmsPrompt(false);
                    setSmsPhone("");
                  }}
                >
                  {t("security.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            data-testid="me-security-smsotp-enroll-button"
            onClick={() => setSmsPrompt(true)}
            disabled={enrollSms.isPending}
          >
            {t("security.smsEnrollButton")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-testid="me-security-emailotp-enroll-button"
            onClick={() => enrollEmail.mutate()}
            disabled={enrollEmail.isPending}
          >
            {enrollEmail.isPending ? t("security.enrolling") : t("security.emailEnrollButton")}
          </Button>
          <Button
            type="button"
            data-testid="me-security-enroll-button"
            onClick={() => enroll.mutate()}
            disabled={enroll.isPending}
          >
            {enroll.isPending ? t("security.enrolling") : t("security.enrollButton")}
          </Button>
          {passkeySupported ? (
            <Button
              type="button"
              variant="secondary"
              data-testid="me-security-passkey-enroll-button"
              onClick={() => enrollPasskey.mutate()}
              disabled={enrollPasskey.isPending}
            >
              {enrollPasskey.isPending ? t("security.enrolling") : t("security.passkeyEnrollButton")}
            </Button>
          ) : (
            <span data-testid="me-security-passkey-unsupported" className="self-center text-xs text-muted-foreground">
              {t("security.passkeyUnsupported")}
            </span>
          )}
        </div>
      )}

      <Card data-testid="me-security-sessions-card">
        <CardHeader>
          <CardTitle>{t("security.sessions.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
          ) : (sessions.data?.items.length ?? 0) === 0 ? (
            <p data-testid="me-security-sessions-empty" className="text-sm text-muted-foreground">{t("security.sessions.empty")}</p>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-card border border-border" data-testid="me-security-sessions-list">
                {(sessions.data?.items ?? []).map((s: ActiveSession) => {
                  const isCurrent = s.familyId === currentFamilyId;
                  return (
                    <li key={s.familyId} data-testid="me-security-session-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div>
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <span>{s.ip ?? t("security.sessions.unknownDevice")}</span>
                          {isCurrent && <Badge variant="outline" className="border-success text-success" data-testid="me-security-session-current-badge">{t("security.sessions.thisDevice")}</Badge>}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {(s.userAgent ?? t("security.sessions.unknownDevice")).slice(0, 60)} · {t("security.sessions.lastSeen", { date: new Date(s.lastIssuedAt).toLocaleString() })}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-danger"
                        data-testid="me-security-session-revoke"
                        disabled={isCurrent || revokeSession.isPending}
                        onClick={() => revokeSession.mutate(s.familyId)}
                      >
                        {t("security.sessions.revoke")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="me-security-sessions-revoke-others"
                  disabled={revokeOthers.isPending}
                  onClick={() => revokeOthers.mutate()}
                >
                  {revokeOthers.isPending ? t("security.sessions.revoking") : t("security.sessions.revokeOthers")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
