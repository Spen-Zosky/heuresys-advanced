"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
const CertificationFormSchema = z.object({
  name: z.string().min(1, "Required").max(255),
  issuer: z.string().min(1, "Required").max(255),
  issuedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  expiresDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  credentialId: z.string().max(255).optional().or(z.literal("")),
  documentUri: z
    .string()
    .max(4096)
    .url("Must be a valid URL (file upload UI lands in MVP-3.5)")
    .optional()
    .or(z.literal("")),
});
type CertificationFormValues = z.infer<typeof CertificationFormSchema>;

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

const COLUMNS: DataColumn<MeCertification>[] = [
  { header: "Nome", cell: (c) => <span className="font-medium text-foreground">{c.name}</span> },
  { header: "Ente", cell: (c) => <span className="text-muted-foreground">{c.issuer}</span> },
  { header: "Rilasciato", cell: (c) => <span className="text-xs text-muted-foreground">{c.issuedDate ?? "—"}</span> },
  { header: "Scadenza", cell: (c) => <span className="text-xs text-muted-foreground">{c.expiresDate ?? "—"}</span> },
  {
    header: "Credential ID",
    cell: (c) => <span className="font-mono text-xs text-muted-foreground">{c.credentialId ?? "—"}</span>,
  },
];

const EMPTY_FORM: CertificationFormValues = {
  name: "",
  issuer: "",
  issuedDate: "",
  expiresDate: "",
  credentialId: "",
  documentUri: "",
};

export default function MeCertificationsPage() {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const certs = useQuery({
    queryKey: ["me", "certifications"],
    queryFn: () => apiFetch<MeCertificationsList>("/v1/me/certifications"),
  });

  const add = useMutation({
    mutationFn: (body: ReturnType<typeof cleanPayload>) =>
      apiFetch<MeCertification>("/v1/me/certifications", { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me", "certifications"] });
      setFeedback({ kind: "ok", msg: "Certificazione aggiunta." });
    },
    onError: (err) => {
      setFeedback({
        kind: "err",
        msg: err instanceof Error ? err.message : "Errore inatteso",
      });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CertificationFormValues>({
    resolver: zodResolver(CertificationFormSchema),
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
        title="Le mie certificazioni"
        description="Le tue certificazioni professionali registrate."
        badges={
          <Badge variant="secondary" data-testid="me-certifications-count">
            {certs.data ? `${certs.data.total} certificazioni` : "Caricamento…"}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Aggiungi certificazione</CardTitle>
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
                Nome <span aria-hidden="true">*</span>
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
                Ente <span aria-hidden="true">*</span>
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
                Data rilascio
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
                Scadenza
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
                Credential ID
              </label>
              <Input
                id="cert-credential"
                data-testid="me-cert-credential"
                {...register("credentialId")}
              />
            </div>
            <div>
              <label htmlFor="cert-doc-uri" className="mb-1 block text-sm font-medium text-foreground">
                URL documento
              </label>
              <Input
                id="cert-doc-uri"
                type="url"
                placeholder="https://…"
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
                {isSubmitting || add.isPending ? "Salvataggio…" : "Aggiungi"}
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
          errorMessage="Impossibile caricare le certificazioni."
          rows={certs.data?.items ?? []}
          rowKey={(c) => c.userCertificationId}
          rowTestId="me-certification-row"
          columns={COLUMNS}
          emptyTestId="me-certifications-empty"
          emptyTitle="Nessuna certificazione"
          emptyDescription="Non hai ancora caricato certificazioni."
          caption="Elenco certificazioni"
        />
      </div>
    </main>
  );
}
