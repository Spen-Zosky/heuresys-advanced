"use client";

/**
 * Atti di mandato da decidere (ADR-0050 D4, mig 000475).
 *
 * Un mandato forte si concede, si revoca o si riconferma con un atto: lo propone chi può
 * concedere ruoli (dalla scheda della persona), lo decide qui un SECONDO titolare. Il riquadro
 * compare solo a chi ha `role:assign`, che è lo stesso permesso delle rotte `/v1/mandate-acts`;
 * l'API resta l'autorità sul perimetro e sulle tre persone distinte, e i comandi che non
 * potrebbero riuscire (l'atto è tuo o ti riguarda) non si offrono.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { MandateAct } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUser, useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";
import { codiceInParole } from "@/lib/enum-labels";

const KEY = ["mandate-acts", "pending"] as const;

export function MandateActsQueue() {
  const { t } = useTranslation("admin");
  const f = useFormat();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions();
  const me = useCurrentUser();
  const canDecide = new Set(perms.data?.permissions ?? []).has("role:assign");
  const [rifiuto, setRifiuto] = useState<{ actId: string; nota: string } | null>(null);

  const acts = useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<{ items: MandateAct[] }>("/v1/mandate-acts?status=PENDING"),
    enabled: canDecide,
  });

  const dopo = () => {
    setRifiuto(null);
    void qc.invalidateQueries({ queryKey: ["mandate-acts"] });
    void qc.invalidateQueries({ queryKey: ["users"] });
  };
  const approve = useMutation({
    mutationFn: (actId: string) => apiFetch<MandateAct>(`/v1/mandate-acts/${actId}/approve`, { method: "POST", body: {} }),
    onSuccess: dopo,
  });
  const reject = useMutation({
    mutationFn: (r: { actId: string; nota: string }) =>
      apiFetch<MandateAct>(`/v1/mandate-acts/${r.actId}/reject`, { method: "POST", body: { note: r.nota.trim() } }),
    onSuccess: dopo,
  });

  if (!canDecide) return null;

  const failed = approve.isError ? approve.error : reject.isError ? reject.error : null;
  const items = acts.data?.items ?? [];
  const io = me.data?.userId;
  const ruolo = (c: string) => t(`shell:roles.${c}`, { defaultValue: codiceInParole(c) });

  return (
    <Card data-testid="mandate-acts-queue">
      <CardHeader>
        <CardTitle>
          {t("roles.mandateActs.title")}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{items.length}</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("roles.mandateActs.description")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {acts.isLoading && <p className="text-sm text-muted-foreground">{t("common:loading")}</p>}
        {acts.isError && (
          <p className="text-sm text-danger" data-testid="mandate-acts-error">
            {isApiError(acts.error) ? acts.error.message : t("users.detail.roles.error")}
          </p>
        )}
        {!acts.isLoading && !acts.isError && items.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="mandate-acts-empty">
            {t("roles.mandateActs.empty")}
          </p>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("roles.mandateActs.title")}>
            <table className="w-full text-sm" data-testid="mandate-acts-table">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{t("roles.mandateActs.colPerson")}</th>
                  <th className="py-2 pr-4 font-medium">{t("roles.mandateActs.colAct")}</th>
                  <th className="py-2 pr-4 font-medium">{t("roles.mandateActs.colRole")}</th>
                  <th className="py-2 pr-4 font-medium">{t("roles.mandateActs.colReason")}</th>
                  <th className="py-2 pr-4 font-medium">{t("roles.mandateActs.colReview")}</th>
                  <th className="py-2 pr-4 font-medium">{t("roles.mandateActs.colProposed")}</th>
                  <th className="py-2 pr-4 font-medium">{t("common:table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const mio = a.proposedBy === io || a.userId === io;
                  return (
                    <tr key={a.actId} className="border-b last:border-0 align-top" data-testid={`mandate-act-${a.actId}`}>
                      <td className="py-2 pr-4">{a.userDisplayName ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary">{t(`users.detail.roles.act.kind.${a.kind}`)}</Badge>
                      </td>
                      <td className="py-2 pr-4" title={a.roleCode}>{ruolo(a.roleCode)}</td>
                      <td className="py-2 pr-4 max-w-80 whitespace-pre-wrap">{a.reason}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{a.reviewBy ? f.data(a.reviewBy) : "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {a.proposedByDisplayName ?? "—"}
                        <br />
                        {f.data(a.proposedAt)}
                      </td>
                      <td className="py-2 pr-4">
                        {mio ? (
                          <span className="text-xs text-muted-foreground">{t("roles.mandateActs.notYours")}</span>
                        ) : rifiuto?.actId === a.actId ? (
                          <div className="flex min-w-64 flex-col gap-2">
                            <label htmlFor={`mandate-act-note-${a.actId}`} className="text-xs font-medium text-foreground">
                              {t("roles.mandateActs.rejectNote")}
                            </label>
                            <Input
                              id={`mandate-act-note-${a.actId}`}
                              data-testid={`mandate-act-note-${a.actId}`}
                              value={rifiuto.nota}
                              maxLength={2000}
                              onChange={(e) => setRifiuto({ actId: a.actId, nota: e.target.value })}
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                data-testid={`mandate-act-confirm-reject-${a.actId}`}
                                disabled={reject.isPending || rifiuto.nota.trim().length < 5}
                                onClick={() => reject.mutate(rifiuto)}
                              >
                                {t("roles.mandateActs.confirmReject")}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => setRifiuto(null)}>
                                {t("roles.mandateActs.cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              data-testid={`mandate-act-approve-${a.actId}`}
                              disabled={approve.isPending}
                              onClick={() => approve.mutate(a.actId)}
                            >
                              {t("roles.mandateActs.approve")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              data-testid={`mandate-act-reject-${a.actId}`}
                              onClick={() => setRifiuto({ actId: a.actId, nota: "" })}
                            >
                              {t("roles.mandateActs.reject")}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {failed && (
          <p className="text-sm text-danger" data-testid="mandate-acts-decide-error">
            {isApiError(failed) ? failed.message : t("users.detail.roles.error")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
