"use client";

/**
 * apps/web/src/app/(authenticated)/whistleblowing-console/page.tsx — #51 E1: the
 * WHISTLEBLOWING_CUSTODIAN console (D.Lgs 24/2023). Route registered in the DB-driven
 * sidebar by mig 000205 ("Governance" group, gated on whistleblowing:read — no other
 * role holds that permission, mig 000181's explicit derogation to ADR-0027).
 *
 * Master-detail on one page (no [id] sub-route): the list row is clickable
 * (EntityTable's onRowClick) and drives a detail panel below fetched by id.
 * The panel doubles as the update form — status / publicMessage / internalNotes
 * textareas are pre-filled with the current values and PATCHed on save.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import {
  WHISTLEBLOWING_STATUSES,
  type WhistleblowingListItem,
  type WhistleblowingListResponse,
  type WhistleblowingReport,
  type WhistleblowingStatus,
  type WhistleblowingUpdate,
} from "@heuresys/shared/schemas/whistleblowing";
import { useMyInterfaces } from "@/lib/api/auth";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { EnumStatusBadge } from "@/components/enum-badge";
import { useEnumLabel } from "@/lib/enum-labels";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface UpdateFormValues {
  status: WhistleblowingStatus;
  publicMessage: string;
  internalNotes: string;
}

export default function WhistleblowingConsolePage() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const reports = useQuery({
    queryKey: ["whistleblowing", "reports"],
    queryFn: () => apiFetch<WhistleblowingListResponse>("/v1/whistleblowing/reports"),
  });

  const detail = useQuery({
    queryKey: ["whistleblowing", "report", selectedId],
    queryFn: () => apiFetch<WhistleblowingReport>(`/v1/whistleblowing/reports/${selectedId}`),
    enabled: selectedId !== null,
  });

  const { register, handleSubmit, reset } = useForm<UpdateFormValues>({
    defaultValues: { status: "NEW", publicMessage: "", internalNotes: "" },
  });

  // Re-hydrate the form whenever a new report resolves (row switch or refetch).
  useEffect(() => {
    if (detail.data) {
      reset({
        status: detail.data.status,
        publicMessage: detail.data.publicMessage ?? "",
        internalNotes: detail.data.internalNotes ?? "",
      });
    }
  }, [detail.data, reset]);

  const update = useMutation({
    mutationFn: (body: WhistleblowingUpdate) =>
      apiFetch<WhistleblowingReport>(`/v1/whistleblowing/reports/${selectedId}`, { method: "PATCH", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["whistleblowing", "reports"] });
      void qc.invalidateQueries({ queryKey: ["whistleblowing", "report", selectedId] });
      setSaveFeedback({ kind: "ok", msg: t("whistleblowingConsole.detail.savedMsg") });
    },
    onError: (err) =>
      setSaveFeedback({
        kind: "err",
        msg: isApiError(err) ? err.message : t("whistleblowingConsole.detail.errorUnexpected"),
      }),
  });

  const onSubmit = handleSubmit((values) => {
    setSaveFeedback(null);
    update.mutate({
      status: values.status,
      publicMessage: values.publicMessage.trim() ? values.publicMessage : null,
      internalNotes: values.internalNotes.trim() ? values.internalNotes : null,
    });
  });

  const columns: DataColumn<WhistleblowingListItem>[] = useMemo(
    () => [
      {
        header: t("whistleblowingConsole.columns.trackingCode"),
        cell: (r) => <span className="font-mono text-xs text-foreground">{r.trackingCode}</span>,
      },
      {
        header: t("whistleblowingConsole.columns.category"),
        cell: (r) => <EnumStatusBadge domain="whistleblowingCategory" value={r.category} />,
      },
      {
        header: t("whistleblowingConsole.columns.status"),
        cell: (r) => <EnumStatusBadge domain="whistleblowingStatus" value={r.status} />,
      },
      { header: t("whistleblowingConsole.columns.subject"), cell: (r) => <span className="text-foreground">{r.subject}</span> },
      {
        header: t("whistleblowingConsole.columns.submittedAt"),
        cell: (r) => <span className="text-xs text-muted-foreground">{r.submittedAt.slice(0, 10)}</span>,
      },
    ],
    [t],
  );

  // GATE CLIENT — il commento in testa a questo file dichiarava da sempre che la console
  // e' del solo custode designato, ma il codice non lo faceva: chi arrivava qui per URL
  // diretto vedeva la pagina intera e un errore che sembrava un guasto di rete. Il
  // permesso non viaggia al browser, ma il registro della sidebar si': se la voce non e'
  // fra quelle che il server ha concesso a questa persona, la console non le spetta.
  // Non sostituisce il controllo del server (l'API risponde 403 comunque): evita che
  // l'interfaccia mostri un guscio di funzione a chi non puo' usarla.
  const registro = useMyInterfaces();
  const puoEntrare = registro.data === undefined
    || registro.data.perspectives.some((p) => p.interfaces.some((i) => i.code === "whistleblowing-console"));
  if (!puoEntrare) {
    return (
      <main data-testid="wb-console-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <PageHeader
          data-testid="whistleblowing-console-title"
          title={t("whistleblowingConsole.title")}
          description={t("whistleblowingConsole.description")}
        />
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-danger" data-testid="wb-console-forbidden">
              {t("whistleblowingConsole.forbiddenMessage")}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main data-testid="wb-console-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="whistleblowing-console-title"
        title={t("whistleblowingConsole.title")}
        description={t("whistleblowingConsole.description")}
        badges={
          <Badge variant="secondary" data-testid="whistleblowing-console-count">
            {reports.data ? t("whistleblowingConsole.count", { count: reports.data.total }) : t("common:loading")}
          </Badge>
        }
      />

      <EntityTable<WhistleblowingListItem>
        isLoading={reports.isLoading}
        isError={reports.isError}
        // Un diniego di autorizzazione non e' un guasto. Prima il 403 veniva reso come
        // «Errore di caricamento delle segnalazioni. Riprova piu' tardi o verifica la
        // connessione»: chi non ha diritto di leggere veniva invitato a insistere, e chi
        // il diritto ce l'ha non avrebbe saputo distinguere un vero problema di rete.
        // `ApiError` porta lo status, quindi la distinzione si fa sul fatto, non sul testo.
        errorMessage={
          isApiError(reports.error) && reports.error.status === 403
            ? t("whistleblowingConsole.forbiddenMessage")
            : t("whistleblowingConsole.errorMessage")
        }
        rows={reports.data?.items ?? []}
        rowKey={(r) => r.reportId}
        rowTestId="wb-console-row"
        onRowClick={(r) => {
          setSaveFeedback(null);
          setSelectedId(r.reportId);
        }}
        columns={columns}
        emptyTestId="wb-console-empty"
        emptyTitle={t("whistleblowingConsole.emptyTitle")}
        emptyDescription={t("whistleblowingConsole.emptyDescription")}
        caption={t("whistleblowingConsole.caption")}
      />

      {selectedId && (
        <Card data-testid="wb-console-detail">
          <CardHeader>
            <CardTitle>
              {detail.data ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">{detail.data.trackingCode}</span>
                  <EnumStatusBadge domain="whistleblowingCategory" value={detail.data.category} />
                </span>
              ) : (
                t("whistleblowingConsole.detail.title")
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.isLoading && <p className="text-sm text-muted-foreground">{t("common:loading")}</p>}
            {detail.isError && (
              <p className="text-sm text-danger" data-testid="wb-console-detail-error">
                {t("whistleblowingConsole.detail.loadError")}
              </p>
            )}
            {detail.data && (
              <>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">{detail.data.subject}</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.data.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("whistleblowingConsole.detail.contactLabel")}: {detail.data.contact ?? t("whistleblowingConsole.detail.noContact")}
                  </p>
                </div>

                <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4 border-t border-border pt-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="wb-console-status" className="mb-1 block text-sm font-medium text-foreground">
                        {t("whistleblowingConsole.detail.statusLabel")}
                      </label>
                      <select
                        id="wb-console-status"
                        data-testid="wb-console-status-select"
                        className={SELECT_CLASS}
                        {...register("status")}
                      >
                        {WHISTLEBLOWING_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {enumLabel("whistleblowingStatus", s)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="wb-console-public-message-input" className="mb-1 block text-sm font-medium text-foreground">
                      {t("whistleblowingConsole.detail.publicMessageLabel")}
                    </label>
                    <textarea
                      id="wb-console-public-message-input"
                      data-testid="wb-console-public-message"
                      rows={3}
                      className={SELECT_CLASS}
                      {...register("publicMessage")}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t("whistleblowingConsole.detail.publicMessageHint")}</p>
                  </div>

                  <div>
                    <label htmlFor="wb-console-internal-notes-input" className="mb-1 block text-sm font-medium text-foreground">
                      {t("whistleblowingConsole.detail.internalNotesLabel")}
                    </label>
                    <textarea
                      id="wb-console-internal-notes-input"
                      data-testid="wb-console-internal-notes"
                      rows={4}
                      className={SELECT_CLASS}
                      {...register("internalNotes")}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t("whistleblowingConsole.detail.internalNotesHint")}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button type="submit" data-testid="wb-console-save" disabled={update.isPending}>
                      {update.isPending ? t("whistleblowingConsole.detail.saving") : t("whistleblowingConsole.detail.save")}
                    </Button>
                    {saveFeedback && (
                      <p
                        data-testid={saveFeedback.kind === "ok" ? "wb-console-saved" : "wb-console-save-error"}
                        className={saveFeedback.kind === "ok" ? "text-sm font-medium text-success" : "text-sm font-medium text-danger"}
                        role={saveFeedback.kind === "err" ? "alert" : undefined}
                      >
                        {saveFeedback.msg}
                      </p>
                    )}
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
