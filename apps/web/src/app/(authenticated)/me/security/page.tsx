"use client";

import { useMemo, useState } from "react";
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
} from "@heuresys/shared";
import { apiFetch } from "../../../../lib/api/fetch";

type SecI18n = (key: string) => string;
function buildVerifyCodeSchema(t: SecI18n) {
  return z.object({
    code: z.string().regex(/^\d{6}$/, t("security.codeRequired")),
  });
}
type VerifyCodeFormValues = z.infer<ReturnType<typeof buildVerifyCodeSchema>>;

export default function MeSecurityPage() {
  const { t } = useTranslation("ess");
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me", "mfa", "factors"] });
      setPendingFactor(null);
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

  const verifyCodeSchema = useMemo(() => buildVerifyCodeSchema(t), [t]);
  const form = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: "" },
  });

  const onVerify = form.handleSubmit((values) => {
    if (!pendingFactor) return;
    verify.mutate({ factorId: pendingFactor.factorId, code: values.code });
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
                      {f.kind}
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
                      if (confirm(t("security.removeConfirm", { kind: f.kind }))) {
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
      ) : (
        <div className="flex justify-end">
          <Button
            type="button"
            data-testid="me-security-enroll-button"
            onClick={() => enroll.mutate()}
            disabled={enroll.isPending}
          >
            {enroll.isPending ? t("security.enrolling") : t("security.enrollButton")}
          </Button>
        </div>
      )}
    </main>
  );
}
