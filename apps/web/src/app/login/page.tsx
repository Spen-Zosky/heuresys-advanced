"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, HeuresysWordmark, Input } from "@heuresys/ui";
import { useLogin } from "../../lib/api/auth";
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

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  // MFA second-step state: retains the credentials to re-submit plus the
  // opaque challenge handle returned by the first step. Null = password step.
  const [mfa, setMfa] = useState<{ email: string; password: string; challengeToken: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

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
        setMfa({ email: values.email, password: values.password, challengeToken: res.challengeToken });
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
      // Server issued a fresh challenge (prior expired) — swap the handle.
      setMfa({ ...mfa, challengeToken: res.challengeToken });
      setFormError(t("auth.login.mfa.expired"));
    } catch (err) {
      handleError(err);
    }
  };

  const busy = isSubmitting || login.isPending;

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
            {mfa ? t("auth.login.mfa.title") : t("auth.login.title")}
          </CardTitle>
          <p className="text-sm opacity-70 mt-1 text-center">
            {mfa ? t("auth.login.mfa.prompt") : t("auth.login.subtitle")}
          </p>
        </CardHeader>
        <CardContent>
          {mfa ? (
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
