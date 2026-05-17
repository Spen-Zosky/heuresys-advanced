"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface MeCertification {
  userCertificationId: string;
  name: string;
  issuer: string;
  issuedDate: string | null;
  expiresDate: string | null;
  credentialId: string | null;
  documentUri: string | null;
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

export default function MeCertificationsPage() {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const certs = useQuery({
    queryKey: ["me", "certifications"],
    queryFn: () =>
      apiFetch<{ items: MeCertification[]; total: number }>("/v1/me/certifications"),
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
    defaultValues: {
      name: "",
      issuer: "",
      issuedDate: "",
      expiresDate: "",
      credentialId: "",
      documentUri: "",
    },
  });

  const onSubmit = handleSubmit(async (vals) => {
    setFeedback(null);
    await add.mutateAsync(cleanPayload(vals));
    reset({
      name: "",
      issuer: "",
      issuedDate: "",
      expiresDate: "",
      credentialId: "",
      documentUri: "",
    });
  });

  return (
    <main data-testid="me-certifications-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-certifications-title">
          Le mie certificazioni
        </h1>
        <p className="text-sm opacity-70" data-testid="me-certifications-count">
          {certs.data ? `${certs.data.total} certificazioni` : "Caricamento…"}
        </p>
      </header>

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
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
            noValidate
          >
            <div>
              <label htmlFor="cert-name" className="block text-sm font-medium mb-1">
                Nome <span aria-hidden="true">*</span>
              </label>
              <Input
                id="cert-name"
                data-testid="me-cert-name"
                aria-invalid={errors.name !== undefined}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="cert-issuer" className="block text-sm font-medium mb-1">
                Ente <span aria-hidden="true">*</span>
              </label>
              <Input
                id="cert-issuer"
                data-testid="me-cert-issuer"
                aria-invalid={errors.issuer !== undefined}
                {...register("issuer")}
              />
              {errors.issuer && (
                <p className="text-xs text-red-600 mt-1">{errors.issuer.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="cert-issued" className="block text-sm font-medium mb-1">
                Data rilascio
              </label>
              <Input
                id="cert-issued"
                type="date"
                data-testid="me-cert-issued"
                {...register("issuedDate")}
              />
              {errors.issuedDate && (
                <p className="text-xs text-red-600 mt-1">{errors.issuedDate.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="cert-expires" className="block text-sm font-medium mb-1">
                Scadenza
              </label>
              <Input
                id="cert-expires"
                type="date"
                data-testid="me-cert-expires"
                {...register("expiresDate")}
              />
              {errors.expiresDate && (
                <p className="text-xs text-red-600 mt-1">{errors.expiresDate.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="cert-credential" className="block text-sm font-medium mb-1">
                Credential ID
              </label>
              <Input
                id="cert-credential"
                data-testid="me-cert-credential"
                {...register("credentialId")}
              />
            </div>
            <div>
              <label htmlFor="cert-doc-uri" className="block text-sm font-medium mb-1">
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
                <p className="text-xs text-red-600 mt-1">{errors.documentUri.message}</p>
              )}
            </div>

            <div className="md:col-span-2 flex items-center gap-3">
              <Button
                type="submit"
                data-testid="me-cert-submit"
                disabled={isSubmitting || add.isPending}
              >
                {isSubmitting || add.isPending ? "Salvataggio…" : "Aggiungi"}
              </Button>
              {feedback && (
                <p
                  data-testid={
                    feedback.kind === "ok" ? "me-cert-success" : "me-cert-error"
                  }
                  className={
                    feedback.kind === "ok"
                      ? "text-sm text-green-700"
                      : "text-sm text-red-700"
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

      <Card>
        <CardHeader><CardTitle>Elenco</CardTitle></CardHeader>
        <CardContent className="p-0">
          {certs.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : certs.data && certs.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-certifications-empty">
              Nessuna certificazione caricata.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="me-certifications-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Ente</th>
                  <th className="px-4 py-2">Rilasciato</th>
                  <th className="px-4 py-2">Scadenza</th>
                  <th className="px-4 py-2">Credential ID</th>
                </tr>
              </thead>
              <tbody>
                {certs.data!.items.map((c) => (
                  <tr key={c.userCertificationId} className="border-b last:border-b-0" data-testid="me-certification-row">
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2">{c.issuer}</td>
                    <td className="px-4 py-2 text-xs">{c.issuedDate ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{c.expiresDate ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{c.credentialId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
