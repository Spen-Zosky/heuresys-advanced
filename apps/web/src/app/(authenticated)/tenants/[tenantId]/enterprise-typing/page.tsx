"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "../../../../../lib/api/fetch";

interface BlueprintFamily { blueprintFamilyId: string; code: string; name: string; industryCode: string | null }
interface BlueprintVariant { blueprintVariantId: string; familyId: string; code: string; name: string }
interface OperatingModel { operatingModelId: string; code: string; name: string }
interface EnterpriseSizeBand { enterpriseSizeBandId: string; code: string; name: string }

interface EnterpriseProfile {
  enterpriseTypingProfileId: string;
  tenantId: string;
  blueprintFamilyId: string | null;
  blueprintVariantId: string | null;
  operatingModelId: string | null;
  enterpriseSizeBandId: string | null;
  status: string;
}

const TypingFormSchema = z.object({
  blueprintFamilyId: z.string().uuid(),
  blueprintVariantId: z.string().uuid(),
  operatingModelId: z.string().uuid().optional(),
  enterpriseSizeBandId: z.string().uuid().optional(),
});
type TypingFormValues = z.infer<typeof TypingFormSchema>;

export default function EnterpriseTypingWizardPage() {
  const { t } = useTranslation("admin");
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const qc = useQueryClient();
  const [familyId, setFamilyId] = useState<string>("");

  const families = useQuery({
    queryKey: ["blueprint-families", "all"],
    queryFn: () => apiFetch<{ items: BlueprintFamily[] }>("/v1/blueprint-families?limit=200"),
  });
  const variants = useQuery({
    queryKey: ["blueprint-variants", "all"],
    queryFn: () => apiFetch<{ items: BlueprintVariant[] }>("/v1/blueprint-variants?limit=200"),
  });
  const models = useQuery({
    queryKey: ["operating-models", "all"],
    queryFn: () => apiFetch<{ items: OperatingModel[] }>("/v1/operating-models?limit=200"),
  });
  const bands = useQuery({
    queryKey: ["enterprise-size-bands", "all"],
    queryFn: () => apiFetch<{ items: EnterpriseSizeBand[] }>("/v1/enterprise-size-bands?limit=200"),
  });

  const variantsForFamily = useMemo(
    () => (variants.data?.items ?? []).filter((v) => !familyId || v.familyId === familyId),
    [variants.data, familyId],
  );

  const create = useMutation({
    mutationFn: (body: TypingFormValues) =>
      apiFetch<EnterpriseProfile>("/v1/enterprise-typing-profiles", {
        method: "POST",
        body: { tenantId, ...body },
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["enterprise-typing-profiles", tenantId] }),
  });

  const { register, handleSubmit, formState: { isSubmitting, errors } } =
    useForm<TypingFormValues>({ resolver: zodResolver(TypingFormSchema) });

  const onSubmit = handleSubmit(async (vals) => { await create.mutateAsync(vals); });

  return (
    <main data-testid="enterprise-typing-page" className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="enterprise-typing-title"
        title={t("enterpriseTyping.title")}
        description={t("enterpriseTyping.description")}
        breadcrumbs={
          <Link
            href={`/tenants/${tenantId}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            data-testid="enterprise-typing-back"
          >
            {t("enterpriseTyping.back")}
          </Link>
        }
      />

      <Card>
        <CardHeader><CardTitle>{t("enterpriseTyping.cardTitle")}</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { void onSubmit(e); }}
            className="space-y-4"
            data-testid="enterprise-typing-form"
          >
            <div className="space-y-1">
              <label htmlFor="blueprintFamilyId" className="text-sm font-medium text-foreground">{t("enterpriseTyping.familyLabel")}</label>
              <select
                id="blueprintFamilyId"
                data-testid="typing-family"
                className="w-full rounded-control border border-border bg-background px-2 py-1 text-sm text-foreground"
                {...register("blueprintFamilyId", { onChange: (e) => setFamilyId(e.target.value) })}
              >
                <option value="">{t("enterpriseTyping.selectPlaceholder")}</option>
                {families.data?.items.map((f) => (
                  <option key={f.blueprintFamilyId} value={f.blueprintFamilyId}>{f.name}</option>
                ))}
              </select>
              {errors.blueprintFamilyId && (
                <p className="mt-1 text-xs text-danger">{t("enterpriseTyping.familyRequired")}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="blueprintVariantId" className="text-sm font-medium text-foreground">{t("enterpriseTyping.variantLabel")}</label>
              <select
                id="blueprintVariantId"
                data-testid="typing-variant"
                className="w-full rounded-control border border-border bg-background px-2 py-1 text-sm text-foreground"
                {...register("blueprintVariantId")}
              >
                <option value="">{t("enterpriseTyping.selectPlaceholder")}</option>
                {variantsForFamily.map((v) => (
                  <option key={v.blueprintVariantId} value={v.blueprintVariantId}>{v.name}</option>
                ))}
              </select>
              {errors.blueprintVariantId && (
                <p className="mt-1 text-xs text-danger">{t("enterpriseTyping.variantRequired")}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="operatingModelId" className="text-sm font-medium text-foreground">{t("enterpriseTyping.modelLabel")}</label>
                <select
                  id="operatingModelId"
                  data-testid="typing-model"
                  className="w-full rounded-control border border-border bg-background px-2 py-1 text-sm text-foreground"
                  {...register("operatingModelId")}
                >
                  <option value="">{t("enterpriseTyping.nonePlaceholderMale")}</option>
                  {models.data?.items.map((m) => (
                    <option key={m.operatingModelId} value={m.operatingModelId}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="enterpriseSizeBandId" className="text-sm font-medium text-foreground">{t("enterpriseTyping.sizeBandLabel")}</label>
                <select
                  id="enterpriseSizeBandId"
                  data-testid="typing-sizeband"
                  className="w-full rounded-control border border-border bg-background px-2 py-1 text-sm text-foreground"
                  {...register("enterpriseSizeBandId")}
                >
                  <option value="">{t("enterpriseTyping.nonePlaceholderFemale")}</option>
                  {bands.data?.items.map((b) => (
                    <option key={b.enterpriseSizeBandId} value={b.enterpriseSizeBandId}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {create.isError && (
              <p className="text-sm text-danger" data-testid="typing-error">
                {t("enterpriseTyping.createError")}
              </p>
            )}
            {create.isSuccess && (
              <p className="text-sm text-success" data-testid="typing-success">
                {t("enterpriseTyping.createSuccess")}
              </p>
            )}

            <Button
              type="submit"
              data-testid="typing-submit"
              disabled={isSubmitting || create.isPending}
            >
              {create.isPending ? t("enterpriseTyping.submitting") : t("enterpriseTyping.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
