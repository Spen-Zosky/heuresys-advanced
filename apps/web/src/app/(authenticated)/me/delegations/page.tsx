"use client";

/**
 * Le mie deleghe — ADR-0051, le attività delegate lungo la catena.
 *
 * Cinque blocchi, tutti da chiamate `/v1/me/delegations*` reali:
 *  1. le proposte dell'agente (un'assenza approvata in arrivo con approvazioni aperte);
 *  2. «Delega una tua attività», solo per chi ha persone nella propria catena;
 *  3. le richieste da decidere PER CONTO DI chi mi ha delegato;
 *  4. le deleghe che ho conferito (con la revoca e lo stato «sospesa» se il delegato è uscito dalla catena);
 *  5. le deleghe che ho ricevuto.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, PageHeader } from "@heuresys/ui";
import { Users } from "lucide-react";
import type {
  CreateMyDelegationBody,
  Delegation,
  DelegationCandidatesResponse,
  DelegatedApprovalsResponse,
  DelegationProposalsResponse,
  MeDelegationsResponse,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { ApiError } from "@/lib/api/errors";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Che cosa si delega: un valore della scelta diventa ambito + oggetto del corpo. */
type Oggetto = "ALL" | "TIME_OFF_REQUEST" | "TRAINING_INITIATIVE" | `STEP:${string}`;

const oggi = () => new Date().toISOString().slice(0, 10);

function messaggioDi(err: unknown, t: (k: string) => string): string {
  if (err instanceof ApiError) {
    const chiave = `delegations.errors.${err.code}`;
    const tradotto = t(chiave);
    return tradotto === chiave ? err.message : tradotto;
  }
  return t("delegations.errors.generic");
}

export default function MeDelegationsPage() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();

  const mie = useQuery({
    queryKey: ["me", "delegations"],
    queryFn: () => apiFetch<MeDelegationsResponse>("/v1/me/delegations"),
  });
  const candidati = useQuery({
    queryKey: ["me", "delegations", "candidates"],
    queryFn: () => apiFetch<DelegationCandidatesResponse>("/v1/me/delegations/candidates"),
  });
  const proposte = useQuery({
    queryKey: ["me", "delegations", "proposals"],
    queryFn: () => apiFetch<DelegationProposalsResponse>("/v1/me/delegations/proposals"),
  });
  const casella = useQuery({
    queryKey: ["me", "delegations", "approvals"],
    queryFn: () => apiFetch<DelegatedApprovalsResponse>("/v1/me/delegations/approvals"),
  });

  const aggiorna = () => void qc.invalidateQueries({ queryKey: ["me", "delegations"] });

  // ── il modulo ───────────────────────────────────────────────────────────────────────
  const [delegato, setDelegato] = useState("");
  const [oggetto, setOggetto] = useState<Oggetto>("ALL");
  const [dal, setDal] = useState(oggi());
  const [al, setAl] = useState("");
  const [motivo, setMotivo] = useState("");

  const conferisci = useMutation({
    mutationFn: (body: CreateMyDelegationBody) =>
      apiFetch<Delegation>("/v1/me/delegations", { method: "POST", body }),
    onSuccess: () => {
      setDelegato(""); setOggetto("ALL"); setAl(""); setMotivo("");
      aggiorna();
    },
  });
  const revoca = useMutation({
    mutationFn: (id: string) =>
      apiFetch<Delegation>(`/v1/me/delegations/${id}/revoke`, { method: "POST", body: {} }),
    onSuccess: aggiorna,
  });
  const decidi = useMutation({
    mutationFn: (v: { requestId: string; stepId: string; decision: "APPROVE" | "REJECT" }) =>
      apiFetch(`/v1/me/delegations/approvals/${v.requestId}/steps/${v.stepId}/decide`, {
        method: "POST", body: { decision: v.decision },
      }),
    onSuccess: aggiorna,
  });

  function invia(e: React.FormEvent) {
    e.preventDefault();
    const base = { delegateUserId: delegato, startsOn: dal, endsOn: al || null, reason: motivo || null };
    const body: CreateMyDelegationBody = oggetto.startsWith("STEP:")
      ? { ...base, scope: "PROCESS_STEP", tenantProcessStepId: oggetto.slice(5) }
      : { ...base, scope: "APPROVALS", requestType: oggetto === "ALL" ? null : (oggetto as "TIME_OFF_REQUEST" | "TRAINING_INITIATIVE") };
    conferisci.mutate(body);
  }

  const persone = candidati.data?.items ?? [];
  const attivita = candidati.data?.processSteps ?? [];

  const oggettoDi = (d: Delegation) =>
    d.scope === "PROCESS_STEP"
      ? t("delegations.object.step", { name: d.tenantProcessStepName ?? "" })
      : d.scope === "APPROVALS"
        ? d.requestType ? t(`delegations.object.type.${d.requestType}`) : t("delegations.object.allApprovals")
        : t(`delegations.object.mandate.${d.scope}`);

  const statoDi = (d: Delegation) =>
    d.status === "REVOKED" ? (
      <Badge variant="secondary">{t("delegations.state.revoked")}</Badge>
    ) : d.inChain === false ? (
      <Badge variant="warning">{t("delegations.state.suspended")}</Badge>
    ) : d.isInForce ? (
      <Badge variant="success">{t("delegations.state.inForce")}</Badge>
    ) : (
      <Badge variant="secondary">{t("delegations.state.notInForce")}</Badge>
    );

  const periodo = (d: Delegation) =>
    d.endsOn ? t("delegations.period.range", { from: d.startsOn, to: d.endsOn }) : t("delegations.period.open", { from: d.startsOn });

  if (mie.isLoading) {
    return <main className="mx-auto max-w-5xl px-6 py-8"><p className="text-sm text-muted-foreground">{t("common:loading")}</p></main>;
  }
  if (mie.isError || !mie.data) {
    return <main className="mx-auto max-w-5xl px-6 py-8"><p className="text-sm text-danger" data-testid="me-delegations-error">{t("delegations.error")}</p></main>;
  }
  const { granted, received } = mie.data;

  return (
    <main data-testid="me-delegations-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader title={t("delegations.title")} description={t("delegations.description")} />

      {(proposte.data?.items ?? []).length > 0 && (
        <Card data-testid="me-delegations-proposals">
          <CardHeader><CardTitle>{t("delegations.proposals.title")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {proposte.data!.items.map((p, i) => (
              <div key={`prop-${i}`} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border p-3">
                <p className="text-sm text-foreground">{p.spiegazione}</p>
                {persone.length > 0 && (
                  <Button
                    variant="secondary"
                    data-testid="me-delegations-proposal-use"
                    onClick={() => {
                      setDelegato(p.suggestedDelegateUserId ?? "");
                      setOggetto("ALL");
                      setDal(p.startsOn < oggi() ? oggi() : p.startsOn);
                      setAl(p.endsOn);
                      setMotivo(t("delegations.proposals.reason"));
                    }}
                  >
                    {t("delegations.proposals.use")}
                  </Button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t("delegations.proposals.note")}</p>
          </CardContent>
        </Card>
      )}

      {persone.length > 0 && (
        <Card data-testid="me-delegations-form">
          <CardHeader><CardTitle>{t("delegations.form.title")}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={invia} className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>{t("delegations.form.delegate")}</span>
                <select required className={SELECT_CLASS} data-testid="me-delegations-delegate" value={delegato} onChange={(e) => setDelegato(e.target.value)}>
                  <option value="">{t("delegations.form.choose")}</option>
                  {persone.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {[p.name, p.positionTitle, p.organizationUnitName].filter(Boolean).join(" — ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("delegations.form.object")}</span>
                <select className={SELECT_CLASS} data-testid="me-delegations-object" value={oggetto} onChange={(e) => setOggetto(e.target.value as Oggetto)}>
                  <option value="ALL">{t("delegations.object.allApprovals")}</option>
                  <option value="TIME_OFF_REQUEST">{t("delegations.object.type.TIME_OFF_REQUEST")}</option>
                  <option value="TRAINING_INITIATIVE">{t("delegations.object.type.TRAINING_INITIATIVE")}</option>
                  {attivita.map((a) => (
                    <option key={a.tenantProcessStepId} value={`STEP:${a.tenantProcessStepId}`}>
                      {t("delegations.object.step", { name: [a.processName, a.name].filter(Boolean).join(" › ") })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("delegations.form.from")}</span>
                <Input type="date" required data-testid="me-delegations-from" value={dal} onChange={(e) => setDal(e.target.value)} />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("delegations.form.to")}</span>
                <Input type="date" data-testid="me-delegations-to" value={al} onChange={(e) => setAl(e.target.value)} />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>{t("delegations.form.reason")}</span>
                <Input data-testid="me-delegations-reason" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">{t("delegations.form.rules")}</p>
              {conferisci.isError && (
                <p className="text-sm text-danger sm:col-span-2" data-testid="me-delegations-form-error">{messaggioDi(conferisci.error, t)}</p>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" data-testid="me-delegations-submit" disabled={!delegato || conferisci.isPending}>
                  {t("delegations.form.submit")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {(casella.data?.items ?? []).length > 0 && (
        <Card data-testid="me-delegations-inbox">
          <CardHeader><CardTitle>{t("delegations.inbox.title")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {decidi.isError && <p className="text-sm text-danger">{messaggioDi(decidi.error, t)}</p>}
            {casella.data!.items.map((a) => (
              <div key={a.approvalStepId} data-testid="me-delegations-inbox-row" className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border p-3">
                <div className="text-sm">
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("delegations.inbox.onBehalf", { name: a.delegatorName ?? "" })}
                    {a.requesterName ? ` · ${t("delegations.inbox.requester", { name: a.requesterName })}` : ""}
                    {` · ${a.createdAt.slice(0, 10)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={decidi.isPending} data-testid="me-delegations-approve"
                    onClick={() => decidi.mutate({ requestId: a.approvalRequestId, stepId: a.approvalStepId, decision: "APPROVE" })}>
                    {t("delegations.inbox.approve")}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={decidi.isPending} data-testid="me-delegations-reject"
                    onClick={() => decidi.mutate({ requestId: a.approvalRequestId, stepId: a.approvalStepId, decision: "REJECT" })}>
                    {t("delegations.inbox.reject")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card data-testid="me-delegations-granted">
        <CardHeader><CardTitle>{t("delegations.granted.title")}</CardTitle></CardHeader>
        <CardContent>
          {granted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {persone.length > 0 ? t("delegations.granted.empty") : t("delegations.granted.noChain")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {granted.map((d) => (
                <li key={d.delegationId} data-testid="me-delegations-granted-row" className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{d.delegateName ?? "—"} · {oggettoDi(d)}</p>
                    <p className="text-xs text-muted-foreground">{periodo(d)}{d.reason ? ` · ${d.reason}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statoDi(d)}
                    {d.status === "ACTIVE" && d.kind === "CHAIN" && (
                      <Button size="sm" variant="secondary" disabled={revoca.isPending} data-testid="me-delegations-revoke"
                        onClick={() => revoca.mutate(d.delegationId)}>
                        {t("delegations.granted.revoke")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card data-testid="me-delegations-received">
        <CardHeader><CardTitle>{t("delegations.received.title")}</CardTitle></CardHeader>
        <CardContent>
          {received.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title={t("delegations.received.emptyTitle")} description={t("delegations.received.emptyDesc")} />
          ) : (
            <ul className="divide-y divide-border">
              {received.map((d) => (
                <li key={d.delegationId} data-testid="me-delegations-received-row" className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{d.delegatorName ?? "—"} · {oggettoDi(d)}</p>
                    <p className="text-xs text-muted-foreground">{periodo(d)}</p>
                  </div>
                  {statoDi(d)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
