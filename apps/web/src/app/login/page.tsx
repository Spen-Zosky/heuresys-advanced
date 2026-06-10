"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { QRCodeSVG } from "qrcode.react";
import { Button, Card, CardContent, CardHeader, CardTitle, HeuresysWordmark, Input } from "@heuresys/ui";
import { useLogin, type LoginSuccessResponse } from "../../lib/api/auth";
import { apiFetch } from "../../lib/api/fetch";
import { csrfStore } from "../../lib/api/csrf-store";
import { isApiError } from "../../lib/api/errors";
import { landingForRoles } from "../../lib/landing";

const LoginFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type LoginFormValues = z.infer<typeof LoginFormSchema>;

function readNextParam(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") ? next : null;
}

// Stable no-op subscribe for useSyncExternalStore reads of immutable browser
// capabilities (same pattern as /me/security). Server snapshot = false.
const subscribeNever = () => () => {};

type EnrollKind = "TOTP" | "EMAIL_OTP" | "WEBAUTHN";

/** Mandatory-MFA gate state: credentials retained for the post-enroll re-login. */
interface EnrollState {
  email: string;
  password: string;
  allowedKinds: string[];
  /** Chosen method (null = method chooser). */
  kind: EnrollKind | null;
  /** TOTP: factor under setup + the otpauth payload to display. */
  factorId: string | null;
  otpauthUri: string | null;
  secret: string | null;
  /** EMAIL_OTP: masked destination of the emailed code. */
  emailHint: string | null;
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  // MFA second-step state: retains the credentials to re-submit plus the
  // opaque challenge handle returned by the first step. Null = password step.
  const [mfa, setMfa] = useState<{
    email: string;
    password: string;
    challengeToken: string;
    availableKinds: string[];
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  // Mandatory-MFA enrollment gate (MVP-4 par.2.5 #4). Null = not gated.
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const passkeySupported = useSyncExternalStore(
    subscribeNever,
    () => window.isSecureContext && typeof window.PublicKeyCredential !== "undefined",
    () => false,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  function redirectFor(roles: string[]) {
    const dest = readNextParam() ?? landingForRoles(roles);
    router.replace(dest);
  }

  function handleError(e: unknown) {
    if (isApiError(e)) {
      if (e.code === "MFA_TOTP_INVALID" || e.code === "MFA_CODE_REQUIRED" || e.code === "MFA_INVALID") {
        setFormError(t("auth.login.mfa.invalid"));
        return;
      }
      if (e.code === "LOGIN_INVALID" || e.status === 401) {
        setFormError(t("auth.login.errors.invalid"));
        return;
      }
      if (e.status === 429) {
        setFormError(t("auth.login.errors.rateLimited"));
        return;
      }
    }
    setFormError(t("auth.login.errors.network"));
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await login.mutateAsync(values);
      if (res.status === "mfa_required") {
        setMfaCode("");
        setMfa({
          email: values.email,
          password: values.password,
          challengeToken: res.challengeToken,
          availableKinds: res.availableKinds,
        });
        return;
      }
      if (res.status === "mfa_enrollment_required") {
        setEnrollCode("");
        setEnroll({
          email: values.email,
          password: values.password,
          allowedKinds: res.allowedKinds,
          kind: null,
          factorId: null,
          otpauthUri: null,
          secret: null,
          emailHint: null,
        });
        return;
      }
      redirectFor(res.roles);
    } catch (e) {
      handleError(e);
    }
  });

  const onSubmitMfa = async (e: FormEvent) => {
    e.preventDefault();
    if (!mfa) return;
    setFormError(null);
    try {
      const res = await login.mutateAsync({
        email: mfa.email,
        password: mfa.password,
        challengeToken: mfa.challengeToken,
        mfaCode,
      });
      if (res.status === "success") {
        redirectFor(res.roles);
        return;
      }
      if (res.status === "mfa_required") {
        // Server issued a fresh challenge (prior expired) — swap the handle.
        setMfa({ ...mfa, challengeToken: res.challengeToken, availableKinds: res.availableKinds });
        setFormError(t("auth.login.mfa.expired"));
      }
    } catch (err) {
      handleError(err);
    }
  };

  /* --- "use passkey" on the MFA step (WebAuthn assertion completes login) --- */
  const onUsePasskey = async () => {
    if (!mfa) return;
    setFormError(null);
    setPasskeyBusy(true);
    try {
      const opt = await apiFetch<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>(
        "/v1/auth/mfa/webauthn/authentication/options",
        { method: "POST", body: { challengeToken: mfa.challengeToken } },
      );
      const assertion = await startAuthentication({ optionsJSON: opt.options });
      const res = await apiFetch<LoginSuccessResponse>(
        "/v1/auth/mfa/webauthn/authentication/verify",
        { method: "POST", body: { challengeToken: mfa.challengeToken, response: assertion } },
      );
      // Review fix S981: the verify rotated the CSRF cookie — seed the store like
      // useLogin does, or the first SPA mutation after a passkey login 403s.
      csrfStore.set(res.csrfToken);
      redirectFor(res.roles);
    } catch {
      // A failed/aborted ceremony consumed the challenge token — re-mint it by
      // re-running step 1 so the user can retry (code OR passkey).
      try {
        const fresh = await login.mutateAsync({ email: mfa.email, password: mfa.password });
        if (fresh.status === "mfa_required") {
          setMfa({ ...mfa, challengeToken: fresh.challengeToken, availableKinds: fresh.availableKinds });
        } else if (fresh.status === "success") {
          // Factor removed in the window — the re-login succeeded outright.
          redirectFor(fresh.roles);
          return;
        } else {
          // Back to the enrollment gate (factor gone + policy still on).
          setMfa(null);
          setEnrollCode("");
          setEnroll({
            email: mfa.email, password: mfa.password, allowedKinds: fresh.allowedKinds,
            kind: null, factorId: null, otpauthUri: null, secret: null, emailHint: null,
          });
          return;
        }
      } catch {
        /* keep the stale handle; the next submit surfaces the regular error */
      }
      setFormError(t("auth.login.mfa.passkeyError"));
    } finally {
      setPasskeyBusy(false);
    }
  };

  /* --- mandatory-MFA enrollment panel actions ------------------------ */
  async function startEnroll(kind: EnrollKind) {
    if (!enroll) return;
    setFormError(null);
    setEnrollBusy(true);
    try {
      if (kind === "TOTP") {
        const res = await apiFetch<{ factorId: string; otpauthUri: string; secret: string }>(
          "/v1/auth/mfa/enroll",
          { method: "POST", body: {} },
        );
        setEnroll({ ...enroll, kind, factorId: res.factorId, otpauthUri: res.otpauthUri, secret: res.secret, emailHint: null });
      } else if (kind === "EMAIL_OTP") {
        const res = await apiFetch<{ factorId: string; emailHint: string }>(
          "/v1/auth/mfa/email-otp/enroll",
          { method: "POST", body: {} },
        );
        setEnroll({ ...enroll, kind, factorId: res.factorId, otpauthUri: null, secret: null, emailHint: res.emailHint });
      } else {
        // WEBAUTHN: the whole ceremony happens here; on success go straight to re-login.
        const opt = await apiFetch<{ factorId: string; options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>(
          "/v1/auth/mfa/webauthn/registration/options",
          { method: "POST", body: {} },
        );
        const attResp = await startRegistration({ optionsJSON: opt.options });
        await apiFetch("/v1/auth/mfa/webauthn/registration/verify", {
          method: "POST",
          body: { factorId: opt.factorId, response: attResp, deviceLabel: "Passkey" },
        });
        await reloginAfterEnroll();
      }
    } catch (err) {
      handleEnrollError(err);
    } finally {
      setEnrollBusy(false);
    }
  }

  const onVerifyEnroll = async (e: FormEvent) => {
    e.preventDefault();
    if (!enroll || !enroll.kind || !enroll.factorId) return;
    setFormError(null);
    setEnrollBusy(true);
    try {
      const url =
        enroll.kind === "TOTP" ? "/v1/auth/mfa/verify-setup" : "/v1/auth/mfa/email-otp/verify-setup";
      await apiFetch(url, { method: "POST", body: { factorId: enroll.factorId, code: enrollCode } });
      await reloginAfterEnroll();
    } catch (err) {
      handleEnrollError(err);
    } finally {
      setEnrollBusy(false);
    }
  };

  /** Factor verified: drop the restricted session and run the regular 2-step login. */
  async function reloginAfterEnroll() {
    if (!enroll) return;
    const res = await login.mutateAsync({ email: enroll.email, password: enroll.password });
    if (res.status === "mfa_required") {
      setEnroll(null);
      setMfaCode("");
      setMfa({
        email: enroll.email,
        password: enroll.password,
        challengeToken: res.challengeToken,
        availableKinds: res.availableKinds,
      });
      setFormError(null);
      return;
    }
    if (res.status === "success") {
      redirectFor(res.roles);
      return;
    }
    // Factor vanished in the window (concurrent session / admin op) — restart
    // the enrollment panel fresh instead of freezing on stale factor state.
    setEnrollCode("");
    setEnroll({
      email: enroll.email, password: enroll.password, allowedKinds: res.allowedKinds,
      kind: null, factorId: null, otpauthUri: null, secret: null, emailHint: null,
    });
    setFormError(t("auth.login.enroll.errors.generic"));
  }

  function handleEnrollError(err: unknown) {
    if (isApiError(err)) {
      if (err.status === 401 && (err.code === "MFA_TOTP_INVALID" || err.code === "MFA_OTP_INVALID")) {
        setFormError(t("auth.login.enroll.errors.invalidCode"));
        return;
      }
      if (err.status === 401) {
        // The 15-min restricted session expired — back to square one.
        setEnroll(null);
        setFormError(t("auth.login.enroll.errors.expired"));
        return;
      }
    }
    setFormError(t("auth.login.enroll.errors.generic"));
  }

  const busy = isSubmitting || login.isPending || enrollBusy || passkeyBusy;
  const showPasskeyLogin = mfa !== null && passkeySupported && mfa.availableKinds.includes("WEBAUTHN");
  const enrollKinds: EnrollKind[] = enroll
    ? (["TOTP", "EMAIL_OTP", "WEBAUTHN"] as const).filter(
        (k) => enroll.allowedKinds.includes(k) && (k !== "WEBAUTHN" || passkeySupported),
      )
    : [];

  const title = enroll
    ? t("auth.login.enroll.title")
    : mfa
      ? t("auth.login.mfa.title")
      : t("auth.login.title");
  const subtitle = enroll
    ? t("auth.login.enroll.prompt")
    : mfa
      ? t("auth.login.mfa.prompt")
      : t("auth.login.subtitle");

  return (
    <main
      data-testid="login-page"
      className="min-h-screen flex items-center justify-center p-6"
    >
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <div className="mb-4 flex items-center justify-center">
            <HeuresysWordmark variant="brand" size="hero" as="h1" aria-label="Heuresys" />
          </div>
          <CardTitle data-testid="login-title" className="text-center">
            {title}
          </CardTitle>
          <p className="text-sm opacity-70 mt-1 text-center">{subtitle}</p>
        </CardHeader>
        <CardContent>
          {enroll ? (
            <div data-testid="login-enroll-panel" className="space-y-4">
              {enroll.kind === null && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("auth.login.enroll.chooseMethod")}</p>
                  {enrollKinds.includes("TOTP") && (
                    <Button
                      type="button"
                      data-testid="login-enroll-totp"
                      disabled={busy}
                      className="w-full"
                      onClick={() => void startEnroll("TOTP")}
                    >
                      {t("auth.login.enroll.methodTotp")}
                    </Button>
                  )}
                  {enrollKinds.includes("EMAIL_OTP") && (
                    <Button
                      type="button"
                      data-testid="login-enroll-email"
                      variant="outline"
                      disabled={busy}
                      className="w-full"
                      onClick={() => void startEnroll("EMAIL_OTP")}
                    >
                      {t("auth.login.enroll.methodEmail")}
                    </Button>
                  )}
                  {enrollKinds.includes("WEBAUTHN") && (
                    <Button
                      type="button"
                      data-testid="login-enroll-passkey"
                      variant="outline"
                      disabled={busy}
                      className="w-full"
                      onClick={() => void startEnroll("WEBAUTHN")}
                    >
                      {t("auth.login.enroll.methodPasskey")}
                    </Button>
                  )}
                </div>
              )}

              {(enroll.kind === "TOTP" || enroll.kind === "EMAIL_OTP") && (
                <form
                  data-testid="login-enroll-form"
                  onSubmit={(e) => {
                    void onVerifyEnroll(e);
                  }}
                  className="space-y-4"
                  noValidate
                >
                  {enroll.kind === "TOTP" && enroll.otpauthUri && (
                    <div className="space-y-2">
                      <p className="text-sm">{t("auth.login.enroll.totpInstructions")}</p>
                      <div className="flex justify-center rounded bg-white p-3">
                        <QRCodeSVG value={enroll.otpauthUri} size={144} />
                      </div>
                      {enroll.secret && (
                        <p className="text-xs opacity-70 break-all">
                          {t("auth.login.enroll.secretLabel")}:{" "}
                          <span data-testid="login-enroll-secret" className="font-mono">{enroll.secret}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {enroll.kind === "EMAIL_OTP" && (
                    <p className="text-sm">
                      {t("auth.login.enroll.emailSent", { hint: enroll.emailHint ?? "" })}
                    </p>
                  )}
                  <div>
                    <label htmlFor="enrollCode" className="block text-sm font-medium mb-1">
                      {t("auth.login.enroll.codeLabel")}
                    </label>
                    <Input
                      id="enrollCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={6}
                      data-testid="login-enroll-code"
                      placeholder="123456"
                      value={enrollCode}
                      onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                  {formError && (
                    <div
                      role="alert"
                      data-testid="login-error"
                      className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
                    >
                      {formError}
                    </div>
                  )}
                  <Button
                    type="submit"
                    data-testid="login-enroll-verify"
                    disabled={busy || enrollCode.length < 6}
                    className="w-full"
                  >
                    {enrollBusy ? t("auth.login.enroll.verifying") : t("auth.login.enroll.verify")}
                  </Button>
                </form>
              )}

              {enroll.kind === null && formError && (
                <div
                  role="alert"
                  data-testid="login-error"
                  className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
                >
                  {formError}
                </div>
              )}

              <button
                type="button"
                data-testid="login-enroll-back"
                className="w-full text-xs opacity-70 hover:opacity-100 underline"
                onClick={() => {
                  setEnroll(null);
                  setFormError(null);
                }}
              >
                {t("auth.login.enroll.back")}
              </button>
            </div>
          ) : mfa ? (
            <form
              data-testid="login-mfa-form"
              onSubmit={(e) => {
                void onSubmitMfa(e);
              }}
              className="space-y-4"
              noValidate
            >
              <div>
                <label htmlFor="mfaCode" className="block text-sm font-medium mb-1">
                  {t("auth.login.mfa.codeLabel")}
                </label>
                <Input
                  id="mfaCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  data-testid="login-mfa-code"
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              {formError && (
                <div
                  role="alert"
                  data-testid="login-error"
                  className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
                >
                  {formError}
                </div>
              )}

              <Button
                type="submit"
                data-testid="login-mfa-submit"
                disabled={busy || mfaCode.length < 6}
                className="w-full"
              >
                {busy ? t("auth.login.submitting") : t("auth.login.mfa.submit")}
              </Button>

              {showPasskeyLogin && (
                <Button
                  type="button"
                  data-testid="login-mfa-passkey"
                  variant="outline"
                  disabled={busy}
                  className="w-full"
                  onClick={() => void onUsePasskey()}
                >
                  {t("auth.login.mfa.usePasskey")}
                </Button>
              )}
            </form>
          ) : (
            <form
              data-testid="login-form"
              onSubmit={(e) => {
                void onSubmit(e);
              }}
              className="space-y-4"
              noValidate
            >
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  {t("auth.login.emailLabel")}
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  data-testid="login-email"
                  placeholder={t("auth.login.emailPlaceholder")}
                  aria-invalid={errors.email !== undefined}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  {t("auth.login.passwordLabel")}
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  data-testid="login-password"
                  aria-invalid={errors.password !== undefined}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
                )}
              </div>

              {formError && (
                <div
                  role="alert"
                  data-testid="login-error"
                  className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
                >
                  {formError}
                </div>
              )}

              <Button
                type="submit"
                data-testid="login-submit"
                disabled={busy}
                className="w-full"
              >
                {busy ? t("auth.login.submitting") : t("auth.login.submit")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
