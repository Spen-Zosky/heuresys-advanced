"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
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
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

interface MeCertification {
  userCertificationId: string;
  name: string;
  issuer: string;
  issuedDate: string | null;
  expiresDate: string | null;
  credentialId: string | null;
  documentUri: string | null;
}

interface MeCertificationsList {
  items: MeCertification[];
  total: number;
}

// Mirror of @heuresys/shared CreateMeCertificationBodySchema, kept inline for
// ergonomic form binding with react-hook-form + Zod. Server is the canonical
// validator; this client schema only blocks obvious mis-input pre-flight.
// The validation messages are i18n-resolved, so the schema is built inside the
// component via the factory below; the form-values type is derived from it.
type CertI18n = (key: string) => string;
function buildCertificationSchema(t: CertI18n) {
  return z.object({
    name: z.string().min(1, t("certifications.validation.required")).max(255),
    issuer: z.string().min(1, t("certifications.validation.required")).max(255),
    issuedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, t("certifications.validation.isoDate"))
      .optional()
      .or(z.literal("")),
    expiresDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, t("certifications.validation.isoDate"))
      .optional()
      .or(z.literal("")),
    credentialId: z.string().max(255).optional().or(z.literal("")),
    documentUri: z
      .string()
      .max(4096)
      .url(t("certifications.validation.url"))
      .optional()
      .or(z.literal("")),
  });
}
type CertificationFormValues = z.infer<ReturnType<typeof buildCertificationSchema>>;

function cleanPayload(v: CertificationFormValues): Record<string, unknown> {
  return {
    name: v.name,
    issuer: v.issuer,
    issuedDate: v.issuedDate ? v.issuedDate : null,
    expiresDate: v.expiresDate ? v.expiresDate : null,
    credentialId: v.credentialId ? v.credentialId : null,
    documentUri: v.documentUri ? v.documentUri : null,
  };
}

function buildColumns(t: CertI18n): DataColumn<MeCertification>[] {
  return [
    { header: t("certifications.colName"), cell: (c) => <span className="font-medium text-foreground">{c.name}</span> },
    { header: t("certifications.colIssuer"), cell: (c) => <span className="text-muted-foreground">{c.issuer}</span> },
    { header: t("certifications.colIssued"), cell: (c) => <span className="text-xs text-muted-foreground">{c.issuedDate ?? "—"}</span> },
    { header: t("certifications.colExpires"), cell: (c) => <span className="text-xs text-muted-foreground">{c.expiresDate ?? "—"}</span> },
    {
      header: t("certifications.colCredential"),
      cell: (c) => <span className="font-mono text-xs text-muted-foreground">{c.credentialId ?? "—"}</span>,
    },
  ];
}

const EMPTY_FORM: CertificationFormValues = {
  name: "",
  issuer: "",
  issuedDate: "",
  expiresDate: "",
  credentialId: "",
  documentUri: "",
};

export default function MeCertificationsPage() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const schema = useMemo(() => buildCertificationSchema(t), [t]);
  const columns = useMemo(() => buildColumns(t), [t]);
  const certs = useQuery({
    queryKey: ["me", "certifications"],
    queryFn: () => apiFetch<MeCertificationsList>("/v1/me/certifications"),
  });

  const add = useMutation({
    mutationFn: (body: ReturnType<typeof cleanPayload>) =>
      apiFetch<MeCertification>("/v1/me/certifications", { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me", "certifications"] });
      setFeedback({ kind: "ok", msg: t("certifications.successMsg") });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : t("certifications.errorUnexpected"),
      });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CertificationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
  });

  const onSubmit = handleSubmit(async (vals) => {
    setFeedback(null);
    await add.mutateAsync(cleanPayload(vals));
    reset(EMPTY_FORM);
  });

  return (
    <main data-testid="me-certifications-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="me-certifications-title"
        title={t("certifications.title")}
        description={t("certifications.description")}
        badges={
          <Badge variant="secondary" data-testid="me-certifications-count">
            {certs.data ? t("certifications.count", { count: certs.data.total }) : t("common:loading")}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("certifications.addCardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            data-testid="me-certification-form"
            onSubmit={(e) => {
              void onSubmit(e);
            }}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            noValidate
          >
            <div>
              <label htmlFor="cert-name" className="mb-1 block text-sm font-medium text-foreground">
                {t("certifications.nameLabel")} <span aria-hidden="true">*</span>
              </label>
              <Input
                id="cert-name"
                data-testid="me-cert-name"
                aria-invalid={errors.name !== undefined}
                {...register("name")}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="cert-issuer" className="mb-1 block text-sm font-medium text-foreground">
                {t("certifications.issuerLabel")} <span aria-hidden="true">*</span>
              </label>
              <Input
                id="cert-issuer"
                data-testid="me-cert-issuer"
                aria-invalid={errors.issuer !== undefined}
                {...register("issuer")}
              />
              {errors.issuer && (
                <p className="mt-1 text-xs text-danger">{errors.issuer.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="cert-issued" className="mb-1 block text-sm font-medium text-foreground">
                {t("certifications.issuedLabel")}
              </label>
              <Input
                id="cert-issued"
                type="date"
                data-testid="me-cert-issued"
                {...register("issuedDate")}
              />
              {errors.issuedDate && (
                <p className="mt-1 text-xs text-danger">{errors.issuedDate.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="cert-expires" className="mb-1 block text-sm font-medium text-foreground">
                {t("certifications.expiresLabel")}
              </label>
              <Input
                id="cert-expires"
                type="date"
                data-testid="me-cert-expires"
                {...register("expiresDate")}
              />
              {errors.expiresDate && (
                <p className="mt-1 text-xs text-danger">{errors.expiresDate.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="cert-credential" className="mb-1 block text-sm font-medium text-foreground">
                {t("certifications.credentialLabel")}
              </label>
              <Input
                id="cert-credential"
                data-testid="me-cert-credential"
                {...register("credentialId")}
              />
            </div>
            <div>
              <label htmlFor="cert-doc-uri" className="mb-1 block text-sm font-medium text-foreground">
                {t("certifications.docUriLabel")}
              </label>
              <Input
                id="cert-doc-uri"
                type="url"
                placeholder={t("certifications.docUriPlaceholder")}
                data-testid="me-cert-doc-uri"
                aria-invalid={errors.documentUri !== undefined}
                {...register("documentUri")}
              />
              {errors.documentUri && (
                <p className="mt-1 text-xs text-danger">{errors.documentUri.message}</p>
              )}
            </div>

            <div className="flex items-center gap-3 md:col-span-2">
              <Button
                type="submit"
                data-testid="me-cert-submit"
                disabled={isSubmitting || add.isPending}
              >
                {isSubmitting || add.isPending ? t("certifications.submitting") : t("certifications.submit")}
              </Button>
              {feedback && (
                <p
                  data-testid={feedback.kind === "ok" ? "me-cert-success" : "me-cert-error"}
                  className={
                    feedback.kind === "ok"
                      ? "text-sm font-medium text-success"
                      : "text-sm font-medium text-danger"
                  }
                  role={feedback.kind === "err" ? "alert" : undefined}
                >
                  {feedback.msg}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div data-testid="me-certifications-table">
        <EntityTable<MeCertification>
          isLoading={certs.isLoading}
          isError={certs.isError}
          errorMessage={t("certifications.errorMessage")}
          rows={certs.data?.items ?? []}
          rowKey={(c) => c.userCertificationId}
          rowTestId="me-certification-row"
          columns={columns}
          emptyTestId="me-certifications-empty"
          emptyTitle={t("certifications.emptyTitle")}
          emptyDescription={t("certifications.emptyDesc")}
          caption={t("certifications.caption")}
        />
      </div>
    </main>
  );
}
