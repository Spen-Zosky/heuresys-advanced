"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
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
    <main data-testid="enterprise-typing-page" className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href={`/tenants/${tenantId}`} className="underline text-sm" data-testid="enterprise-typing-back">
          ← Tenant
        </Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="enterprise-typing-title">
          Enterprise Typing Wizard
        </h1>
      </header>

      <Card>
        <CardHeader><CardTitle>Profilo</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { void onSubmit(e); }}
            className="space-y-4"
            data-testid="enterprise-typing-form"
          >
            <div>
              <label htmlFor="blueprintFamilyId" className="text-sm font-medium">Blueprint family</label>
              <select
                id="blueprintFamilyId"
                data-testid="typing-family"
                className="w-full border rounded px-2 py-1 text-sm"
                {...register("blueprintFamilyId", { onChange: (e) => setFamilyId(e.target.value) })}
              >
                <option value="">— Seleziona —</option>
                {families.data?.items.map((f) => (
                  <option key={f.blueprintFamilyId} value={f.blueprintFamilyId}>{f.name}</option>
                ))}
              </select>
              {errors.blueprintFamilyId && (
                <p className="text-xs text-red-600 mt-1">Famiglia richiesta.</p>
              )}
            </div>

            <div>
              <label htmlFor="blueprintVariantId" className="text-sm font-medium">Variante</label>
              <select
                id="blueprintVariantId"
                data-testid="typing-variant"
                className="w-full border rounded px-2 py-1 text-sm"
                {...register("blueprintVariantId")}
              >
                <option value="">— Seleziona —</option>
                {variantsForFamily.map((v) => (
                  <option key={v.blueprintVariantId} value={v.blueprintVariantId}>{v.name}</option>
                ))}
              </select>
              {errors.blueprintVariantId && (
                <p className="text-xs text-red-600 mt-1">Variante richiesta.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="operatingModelId" className="text-sm font-medium">Operating model</label>
                <select
                  id="operatingModelId"
                  data-testid="typing-model"
                  className="w-full border rounded px-2 py-1 text-sm"
                  {...register("operatingModelId")}
                >
                  <option value="">— Nessuno —</option>
                  {models.data?.items.map((m) => (
                    <option key={m.operatingModelId} value={m.operatingModelId}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="enterpriseSizeBandId" className="text-sm font-medium">Size band</label>
                <select
                  id="enterpriseSizeBandId"
                  data-testid="typing-sizeband"
                  className="w-full border rounded px-2 py-1 text-sm"
                  {...register("enterpriseSizeBandId")}
                >
                  <option value="">— Nessuna —</option>
                  {bands.data?.items.map((b) => (
                    <option key={b.enterpriseSizeBandId} value={b.enterpriseSizeBandId}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {create.isError && (
              <p className="text-sm text-red-600" data-testid="typing-error">
                Errore creazione profilo.
              </p>
            )}
            {create.isSuccess && (
              <p className="text-sm text-green-700" data-testid="typing-success">
                Profilo creato.
              </p>
            )}

            <Button
              type="submit"
              data-testid="typing-submit"
              disabled={isSubmitting || create.isPending}
            >
              {create.isPending ? "Creazione…" : "Crea profilo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
