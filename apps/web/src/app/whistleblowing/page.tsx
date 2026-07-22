"use client";

/**
 * apps/web/src/app/whistleblowing/page.tsx — #51 E1: public whistleblowing channel
 * (D.Lgs 24/2023). Stylistic twin of app/demo/page.tsx (header + max-w content).
 *
 * Two independent blocks, both anonymous / no auth:
 *   1. Anonymous submit — POST /v1/whistleblowing (rate-limited 5/min + honeypot).
 *      Success returns ONLY a tracking code; that code is the sole way to follow the
 *      case (there is no login-based tracking — the whole point of the channel).
 *   2. Status lookup by tracking code — GET /v1/whistleblowing/status/:code. A bad
 *      code is a plain "not found" (no enumeration hint distinguishing bad-format vs
 *      unknown vs someone-else's-code).
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, HeuresysWordmark, Input } from "@heuresys/ui";
import {
  WhistleblowingSubmitSchema,
  WHISTLEBLOWING_CATEGORIES,
  type WhistleblowingSubmit,
  type WhistleblowingSubmitResponse,
  type WhistleblowingStatusResponse,
} from "@heuresys/shared/schemas/whistleblowing";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { EnumStatusBadge } from "@/components/enum-badge";
import { useEnumLabel } from "@/lib/enum-labels";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const WB_DEFAULTS: WhistleblowingSubmit = {
  category: WHISTLEBLOWING_CATEGORIES[0],
  subject: "",
  body: "",
  contact: "",
  website: "",
};

function SubmitBlock() {
  const { t } = useTranslation("landing");
  const enumLabel = useEnumLabel();
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WhistleblowingSubmit>({
    resolver: zodResolver(WhistleblowingSubmitSchema),
    defaultValues: WB_DEFAULTS,
  });

  const submit = useMutation({
    mutationFn: (body: WhistleblowingSubmit) =>
      apiFetch<WhistleblowingSubmitResponse>("/v1/whistleblowing", { method: "POST", body }),
  });

  const onSubmit = handleSubmit((values) => {
    setCopied(false);
    submit.mutate(values);
  });

  const errorText = submit.error
    ? isApiError(submit.error) && submit.error.status === 429
      ? t("whistleblowing.form.errorRateLimited")
      : t("whistleblowing.form.error")
    : null;

  if (submit.isSuccess && submit.data) {
    const code = submit.data.trackingCode;
    return (
      <Card data-testid="wb-success">
        <CardContent className="space-y-4 p-6 text-center">
          <h3 className="text-lg font-semibold text-foreground">{t("whistleblowing.form.successTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("whistleblowing.form.successBody")}</p>
          <p
            data-testid="wb-tracking-code"
            className="rounded-control border border-border bg-muted px-4 py-3 font-mono text-lg font-semibold tracking-wide text-foreground"
          >
            {code}
          </p>
          <p className="text-xs text-muted-foreground">{t("whistleblowing.form.trackingCodeHint")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="wb-copy-tracking-code"
            onClick={() => {
              void navigator.clipboard.writeText(code).then(() => setCopied(true));
            }}
          >
            {copied ? t("whistleblowing.form.copied") : t("whistleblowing.form.copy")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="mb-1 text-xl font-semibold text-foreground">{t("whistleblowing.form.title")}</h2>
        <p className="mb-6 text-sm text-muted-foreground">{t("whistleblowing.form.subtitle")}</p>
        <form data-testid="wb-form" onSubmit={(e) => { void onSubmit(e); }} className="space-y-4" noValidate>
          <div>
            <label htmlFor="wb-category-input" className="mb-1 block text-sm font-medium text-foreground">
              {t("whistleblowing.form.categoryLabel")}
            </label>
            <select id="wb-category-input" data-testid="wb-category" className={SELECT_CLASS} {...register("category")}>
              {WHISTLEBLOWING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {enumLabel("whistleblowingCategory", c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="wb-subject-input" className="mb-1 block text-sm font-medium text-foreground">
              {t("whistleblowing.form.subjectLabel")}
            </label>
            <Input
              id="wb-subject-input"
              data-testid="wb-subject"
              aria-invalid={!!errors.subject}
              {...register("subject")}
            />
            {errors.subject && <p className="mt-1 text-xs text-danger">{t("whistleblowing.form.validation.subjectLength")}</p>}
          </div>

          <div>
            <label htmlFor="wb-body-input" className="mb-1 block text-sm font-medium text-foreground">
              {t("whistleblowing.form.bodyLabel")}
            </label>
            <textarea
              id="wb-body-input"
              data-testid="wb-body"
              rows={7}
              aria-invalid={!!errors.body}
              className={SELECT_CLASS}
              {...register("body")}
            />
            {errors.body && <p className="mt-1 text-xs text-danger">{t("whistleblowing.form.validation.bodyLength")}</p>}
          </div>

          <div>
            <label htmlFor="wb-contact-input" className="mb-1 block text-sm font-medium text-foreground">
              {t("whistleblowing.form.contactLabel")}
            </label>
            <Input id="wb-contact-input" data-testid="wb-contact" {...register("contact")} />
            <p className="mt-1 text-xs text-muted-foreground">{t("whistleblowing.form.contactHint")}</p>
          </div>

          {/* honeypot: visually hidden, off-screen, not announced — a human never fills this */}
          <input
            data-testid="wb-honeypot"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0"
            {...register("website")}
          />

          <Button type="submit" disabled={submit.isPending} data-testid="wb-submit">
            {submit.isPending ? t("whistleblowing.form.submitting") : t("whistleblowing.form.submit")}
          </Button>
          {errorText && (
            <p data-testid="wb-error" role="alert" className="text-sm text-danger">
              {errorText}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function StatusBlock() {
  const { t } = useTranslation("landing");
  const [code, setCode] = useState("");

  const check = useMutation({
    mutationFn: (trackingCode: string) =>
      apiFetch<WhistleblowingStatusResponse>(`/v1/whistleblowing/status/${encodeURIComponent(trackingCode)}`),
  });

  const errorText = check.error
    ? isApiError(check.error) && check.error.status === 404
      ? t("whistleblowing.status.notFound")
      : t("whistleblowing.status.error")
    : null;

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="mb-1 text-xl font-semibold text-foreground">{t("whistleblowing.status.title")}</h2>
        <p className="mb-6 text-sm text-muted-foreground">{t("whistleblowing.status.subtitle")}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) check.mutate(code.trim());
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-52 flex-1">
            <label htmlFor="wb-status-code-input" className="mb-1 block text-sm font-medium text-foreground">
              {t("whistleblowing.status.codeLabel")}
            </label>
            <Input
              id="wb-status-code-input"
              data-testid="wb-status-input"
              placeholder={t("whistleblowing.status.codePlaceholder")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button type="submit" data-testid="wb-status-check" disabled={check.isPending || code.trim().length === 0}>
            {check.isPending ? t("whistleblowing.status.checking") : t("whistleblowing.status.check")}
          </Button>
        </form>

        {errorText && (
          <p data-testid="wb-status-error" role="alert" className="mt-4 text-sm text-danger">
            {errorText}
          </p>
        )}

        {check.isSuccess && check.data && (
          <div data-testid="wb-status-result" className="mt-6 space-y-2 rounded-card border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-foreground">{check.data.trackingCode}</span>
              <EnumStatusBadge domain="whistleblowingStatus" value={check.data.status} />
              <EnumStatusBadge domain="whistleblowingCategory" value={check.data.category} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("whistleblowing.status.submittedAt")}: {check.data.submittedAt.slice(0, 10)} ·{" "}
              {t("whistleblowing.status.lastUpdateAt")}: {check.data.lastUpdateAt.slice(0, 10)}
            </p>
            {check.data.publicMessage && (
              <p className="text-sm text-foreground">
                <span className="font-medium">{t("whistleblowing.status.publicMessageLabel")}:</span> {check.data.publicMessage}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WhistleblowingPage() {
  const { t } = useTranslation("landing");

  return (
    <main data-testid="wb-page" className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <HeuresysWordmark />
        <Link href="/login" data-testid="wb-login" className="text-sm text-muted-foreground hover:text-foreground">
          {t("nav.login")}
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("whistleblowing.title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">{t("whistleblowing.legalNotice")}</p>
      </section>

      <div className="mx-auto max-w-2xl space-y-10 px-6 pb-16">
        <SubmitBlock />
        <StatusBlock />
      </div>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">{t("footer.tagline")}</footer>
    </main>
  );
}
