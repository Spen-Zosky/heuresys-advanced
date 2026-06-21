"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, Input } from "@heuresys/ui";
import { LeadCreateSchema, type LeadCreate } from "@heuresys/shared/schemas/leads";

const SIZES = ["LT_50", "50_250", "250_2000", "GT_2000"] as const;

export default function LeadForm() {
  const { t } = useTranslation("landing");
  const [state, setState] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(LeadCreateSchema),
    defaultValues: { website: "" },
  });

  async function onSubmit(values: LeadCreate) {
    setState("submitting");
    try {
      const res = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      setState(res.ok ? "ok" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "ok") {
    return (
      <Card data-testid="lead-form-success">
        <CardContent className="p-6 text-sm text-foreground">{t("form.success")}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form data-testid="lead-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("form.name")}</span>
              <Input data-testid="lead-name" {...register("name")} aria-invalid={!!errors.name} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("form.company")}</span>
              <Input data-testid="lead-company" {...register("company")} aria-invalid={!!errors.company} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("form.email")}</span>
              <Input data-testid="lead-email" type="email" {...register("email")} aria-invalid={!!errors.email} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("form.role")}</span>
              <Input data-testid="lead-role" {...register("role")} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t("form.companySize")}</span>
              <select data-testid="lead-size" {...register("companySize")} className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm">
                <option value="">—</option>
                {SIZES.map((s) => (<option key={s} value={s}>{t(`form.sizes.${s}`)}</option>))}
              </select>
            </label>
          </div>
          <label className="space-y-1 text-sm block">
            <span className="text-muted-foreground">{t("form.message")}</span>
            <textarea data-testid="lead-message" {...register("message")} rows={3} className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm" />
          </label>
          {/* honeypot: visually hidden, off-screen, not announced */}
          <input {...register("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0" />
          <label className="flex items-start gap-2 text-sm">
            <input data-testid="lead-consent" type="checkbox" {...register("consent")} className="mt-1" />
            <span className="text-muted-foreground">
              {t("form.consent", { privacy: t("form.privacyLink") })}
            </span>
          </label>
          <Button type="submit" disabled={state === "submitting"} data-testid="lead-submit">
            {state === "submitting" ? t("form.submitting") : t("form.submit")}
          </Button>
          {state === "error" ? <p data-testid="lead-form-error" className="text-sm text-danger">{t("form.error")}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
