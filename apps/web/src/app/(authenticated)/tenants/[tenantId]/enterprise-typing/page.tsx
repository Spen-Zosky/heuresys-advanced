"use client";

/**
 * V-5 del piano interfacce (D-11 del giro V4). Questa pagina mandava un POST dove l'API accetta
 * solo GET, PUT e DELETE, e un corpo con campi che il profilo non ha (famiglia e variante di
 * blueprint): il salvataggio non poteva funzionare. Ora il modulo e' il profilo di tipizzazione
 * com'e' nel contratto (`UpsertEnterpriseTypingProfileBody`): classe di attivita', fascia
 * dimensionale, modello operativo, intensita' regolatoria, addetti, fatturato e paese; si apre
 * con il profilo esistente, se c'e', e si salva con PUT.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import type {
  ActivityClassification,
  EnterpriseSizeBand,
  EnterpriseTypingProfile,
  OperatingModel,
  RegulatoryIntensity,
} from "@heuresys/shared";
import { apiFetch } from "../../../../../lib/api/fetch";
import { useCan } from "../../../../../lib/api/auth";
import { testoPerLaPersona } from "../../../../../lib/api/errors";
import { StatoErrore } from "@/components/stato-pagina";

const INTENSITA: readonly RegulatoryIntensity[] = ["LOW", "MEDIUM", "HIGH", "EXTREME"];
const CAMPO =
  "w-full rounded-control border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Modulo {
  industryClassId: string;
  sizeBandId: string;
  operatingModelId: string;
  regulatoryIntensity: RegulatoryIntensity;
  employeeCount: string;
  revenueEur: string;
  countryCode: string;
}

const VUOTO: Modulo = {
  industryClassId: "",
  sizeBandId: "",
  operatingModelId: "",
  regulatoryIntensity: "MEDIUM",
  employeeCount: "",
  revenueEur: "",
  countryCode: "",
};

function daProfilo(p: EnterpriseTypingProfile): Modulo {
  return {
    industryClassId: p.industryClassId ?? "",
    sizeBandId: p.sizeBandId ?? "",
    operatingModelId: p.operatingModelId ?? "",
    regulatoryIntensity: p.regulatoryIntensity,
    employeeCount: p.employeeCount === null ? "" : String(p.employeeCount),
    revenueEur: p.revenueEur === null ? "" : String(p.revenueEur),
    countryCode: p.countryCode ?? "",
  };
}

export default function EnterpriseTypingPage() {
  const { t } = useTranslation("admin");
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const qc = useQueryClient();
  const canUpdate = useCan("enterprise_typing:update");

  const profili = useQuery({
    queryKey: ["enterprise-typing-profiles", tenantId],
    queryFn: () => apiFetch<{ items: EnterpriseTypingProfile[] }>("/v1/enterprise-typing-profiles?limit=200"),
  });
  const profilo = profili.data?.items.find((p) => p.tenantId === tenantId) ?? null;

  const models = useQuery({
    queryKey: ["operating-models", "all"],
    queryFn: () => apiFetch<{ items: OperatingModel[] }>("/v1/operating-models?limit=200"),
  });
  const bands = useQuery({
    queryKey: ["enterprise-size-bands", "all"],
    queryFn: () => apiFetch<{ items: EnterpriseSizeBand[] }>("/v1/enterprise-size-bands?limit=200"),
  });

  const [modulo, setModulo] = useState<Modulo>(VUOTO);
  const [caricato, setCaricato] = useState<string | null>(null);
  // Il modulo parte dal profilo salvato, una volta sola per profilo.
  if (profili.isSuccess && caricato !== (profilo?.enterpriseTypingProfileId ?? "nessuno")) {
    setCaricato(profilo?.enterpriseTypingProfileId ?? "nessuno");
    setModulo(profilo ? daProfilo(profilo) : VUOTO);
  }

  // La classe di attivita' si cerca: le classificazioni sono migliaia.
  const [cerca, setCerca] = useState("");
  const [cercato, setCercato] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setCercato(cerca.trim()), 250);
    return () => clearTimeout(h);
  }, [cerca]);
  const classi = useQuery({
    queryKey: ["activity-classifications", "search", cercato],
    queryFn: () =>
      apiFetch<{ items: ActivityClassification[] }>(
        `/v1/activity-classifications?${new URLSearchParams({ search: cercato, limit: "50" }).toString()}`,
      ),
    enabled: cercato.length >= 2,
  });
  const classeScelta = useQuery({
    queryKey: ["activity-classifications", "one", modulo.industryClassId],
    queryFn: () => apiFetch<ActivityClassification>(`/v1/activity-classifications/${modulo.industryClassId}`),
    enabled: modulo.industryClassId !== "",
  });

  const salva = useMutation({
    mutationFn: () =>
      apiFetch<EnterpriseTypingProfile>("/v1/enterprise-typing-profiles", {
        method: "PUT",
        body: {
          tenantId,
          industryClassId: modulo.industryClassId || null,
          sizeBandId: modulo.sizeBandId || null,
          operatingModelId: modulo.operatingModelId || null,
          regulatoryIntensity: modulo.regulatoryIntensity,
          employeeCount: modulo.employeeCount === "" ? null : Number(modulo.employeeCount),
          revenueEur: modulo.revenueEur === "" ? null : Number(modulo.revenueEur),
          countryCode: modulo.countryCode === "" ? null : modulo.countryCode.toUpperCase(),
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enterprise-typing-profiles", tenantId] }),
  });

  const paeseValido = modulo.countryCode === "" || /^[A-Za-z]{2}$/.test(modulo.countryCode);
  const numeriValidi =
    (modulo.employeeCount === "" || /^\d+$/.test(modulo.employeeCount)) &&
    (modulo.revenueEur === "" || /^\d+(\.\d+)?$/.test(modulo.revenueEur));
  const set = (k: keyof Modulo) => (v: string) => setModulo((m) => ({ ...m, [k]: v }));

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
        <CardHeader>
          <CardTitle>{profilo ? t("enterpriseTyping.cardTitleSaved") : t("enterpriseTyping.cardTitleNew")}</CardTitle>
        </CardHeader>
        <CardContent>
          {profili.isError ? (
            <StatoErrore
              errore={profili.error}
              titolo={t("enterpriseTyping.loadError")}
              testId="typing-load-error"
              onRiprova={() => void profili.refetch()}
            />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (paeseValido && numeriValidi) salva.mutate();
              }}
              className="space-y-4"
              data-testid="enterprise-typing-form"
              noValidate
            >
              <fieldset disabled={!canUpdate} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="typing-class-search" className="text-sm font-medium text-foreground">
                    {t("enterpriseTyping.classLabel")}
                  </label>
                  <p className="text-xs text-muted-foreground" data-testid="typing-class-current">
                    {modulo.industryClassId === ""
                      ? t("enterpriseTyping.classNone")
                      : classeScelta.data
                        ? `${classeScelta.data.scheme} ${classeScelta.data.code} — ${classeScelta.data.name}`
                        : t("common:loading")}
                  </p>
                  <Input
                    id="typing-class-search"
                    data-testid="typing-class-search"
                    value={cerca}
                    onChange={(e) => setCerca(e.target.value)}
                    placeholder={t("enterpriseTyping.classSearch")}
                    autoComplete="off"
                  />
                  {(classi.data?.items.length ?? 0) > 0 && (
                    <select
                      aria-label={t("enterpriseTyping.classLabel")}
                      data-testid="typing-class"
                      className={CAMPO}
                      size={Math.min(8, classi.data!.items.length)}
                      value={modulo.industryClassId}
                      onChange={(e) => set("industryClassId")(e.target.value)}
                    >
                      {classi.data!.items.map((c) => (
                        <option key={c.activityClassificationId} value={c.activityClassificationId}>
                          {c.scheme} {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {modulo.industryClassId !== "" && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => set("industryClassId")("")}>
                      {t("enterpriseTyping.classClear")}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="typing-sizeband" className="text-sm font-medium text-foreground">{t("enterpriseTyping.sizeBandLabel")}</label>
                    <select id="typing-sizeband" data-testid="typing-sizeband" className={CAMPO} value={modulo.sizeBandId} onChange={(e) => set("sizeBandId")(e.target.value)}>
                      <option value="">{t("enterpriseTyping.nonePlaceholderFemale")}</option>
                      {bands.data?.items.map((b) => (
                        <option key={b.enterpriseSizeBandId} value={b.enterpriseSizeBandId}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="typing-model" className="text-sm font-medium text-foreground">{t("enterpriseTyping.modelLabel")}</label>
                    <select id="typing-model" data-testid="typing-model" className={CAMPO} value={modulo.operatingModelId} onChange={(e) => set("operatingModelId")(e.target.value)}>
                      <option value="">{t("enterpriseTyping.nonePlaceholderMale")}</option>
                      {models.data?.items.map((m) => (
                        <option key={m.operatingModelId} value={m.operatingModelId}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="typing-intensity" className="text-sm font-medium text-foreground">{t("enterpriseTyping.intensityLabel")}</label>
                    <select
                      id="typing-intensity"
                      data-testid="typing-intensity"
                      className={CAMPO}
                      value={modulo.regulatoryIntensity}
                      onChange={(e) => set("regulatoryIntensity")(e.target.value)}
                    >
                      {INTENSITA.map((i) => (
                        <option key={i} value={i}>{t(`enterpriseTyping.intensity.${i}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="typing-country" className="text-sm font-medium text-foreground">{t("enterpriseTyping.countryLabel")}</label>
                    <Input id="typing-country" data-testid="typing-country" value={modulo.countryCode} maxLength={2} onChange={(e) => set("countryCode")(e.target.value)} aria-invalid={!paeseValido} />
                    {!paeseValido && <p className="text-xs text-danger">{t("enterpriseTyping.countryInvalid")}</p>}
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="typing-employees" className="text-sm font-medium text-foreground">{t("enterpriseTyping.employeesLabel")}</label>
                    <Input id="typing-employees" data-testid="typing-employees" inputMode="numeric" value={modulo.employeeCount} onChange={(e) => set("employeeCount")(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="typing-revenue" className="text-sm font-medium text-foreground">{t("enterpriseTyping.revenueLabel")}</label>
                    <Input id="typing-revenue" data-testid="typing-revenue" inputMode="decimal" value={modulo.revenueEur} onChange={(e) => set("revenueEur")(e.target.value)} />
                  </div>
                </div>
                {!numeriValidi && <p className="text-xs text-danger">{t("enterpriseTyping.numbersInvalid")}</p>}

                {salva.isError && (
                  <p className="text-sm text-danger" role="alert" data-testid="typing-error">
                    {testoPerLaPersona(salva.error) ?? t("enterpriseTyping.saveError")}
                  </p>
                )}
                {salva.isSuccess && (
                  <p className="text-sm text-success" data-testid="typing-success">
                    {t("enterpriseTyping.saveSuccess")}
                  </p>
                )}

                {canUpdate && (
                  <Button type="submit" data-testid="typing-submit" disabled={salva.isPending || !paeseValido || !numeriValidi}>
                    {salva.isPending ? t("enterpriseTyping.submitting") : t("enterpriseTyping.submit")}
                  </Button>
                )}
              </fieldset>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
