"use client";

import { useEffect, useState } from "react";
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    setFormError(null);
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await login.mutateAsync(values);
      const dest = readNextParam() ?? landingForRoles(res.roles);
      router.replace(dest);
    } catch (e) {
      if (isApiError(e)) {
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
  });

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
          <CardTitle data-testid="login-title" className="text-center">{t("auth.login.title")}</CardTitle>
          <p className="text-sm opacity-70 mt-1 text-center">{t("auth.login.subtitle")}</p>
        </CardHeader>
        <CardContent>
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
              disabled={isSubmitting || login.isPending}
              className="w-full"
            >
              {isSubmitting || login.isPending
                ? t("auth.login.submitting")
                : t("auth.login.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
