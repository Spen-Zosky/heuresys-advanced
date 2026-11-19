"use client";

/**
 * Deleghe del tenant, dalla parte dell'amministrazione (ondata 2 degli endpoint senza consumatori,
 * 2026-11-17). `GET/POST /v1/delegations` e `POST /v1/delegations/:id/revoke` esistevano e nessuna
 * pagina li chiamava: la delega di un mandato (pieno o di consolidamento) a nome di un'altra persona
 * si registrava solo da database. Le deleghe di catena che una persona dà da sé restano in
 * `/me/delegations`. Tutto chiede `delegation:manage`, la lettura `delegation:read`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import { CONSOLIDATION_GROUP_VALUES, type Delegation, type DelegationListResponse, type User } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";
import { PersonPicker } from "@/components/person-picker";
import { EntityTable } from "@/components/data-table-panel";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Ambito = "APPROVALS" | "FULL" | "CONSOLIDATION";
const AMBITI: readonly Ambito[] = ["APPROVALS", "FULL", "CONSOLIDATION"];
const GRUPPI = CONSOLIDATION_GROUP_VALUES;
const oggi = () => new Date().toISOString().slice(0, 10);

function messaggio(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("roles.deleghe.vietato");
    if (err.status === 409) return t("roles.deleghe.conflitto");
    if (err.status === 400 || err.status === 422) return t("roles.deleghe.nonValida");
  }
  return t("roles.deleghe.errore");
}

export function DelegheAmministrazione() {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const puoLeggere = perms.includes("delegation:read");
  const puoGestire = perms.includes("delegation:manage");
  const [delegante, setDelegante] = useState<User[]>([]);
  const [delegato, setDelegato] = useState<User[]>([]);
  const [ambito, setAmbito] = useState<Ambito>("APPROVALS");
  const [gruppi, setGruppi] = useState<string[]>([]);
  const [dal, setDal] = useState(oggi());
  const [al, setAl] = useState("");
  const [motivo, setMotivo] = useState("");

  const elenco = useQuery({
    queryKey: ["delegations", "admin"],
    queryFn: () => apiFetch<DelegationListResponse>("/v1/delegations?limit=200"),
    enabled: puoLeggere,
  });
  const crea = useMutation({
    mutationFn: () => apiFetch<Delegation>("/v1/delegations", {
      method: "POST",
      body: {
        delegatorUserId: delegante[0]!.userId,
        delegateUserId: delegato[0]!.userId,
        scope: ambito,
        ...(ambito === "CONSOLIDATION" ? { groups: gruppi } : {}),
        startsOn: dal,
        endsOn: al || null,
        reason: motivo.trim() || null,
      },
    }),
    onSuccess: () => {
      setDelegante([]); setDelegato([]); setGruppi([]); setMotivo(""); setAl("");
      void qc.invalidateQueries({ queryKey: ["delegations"] });
    },
  });
  const revoca = useMutation({
    mutationFn: (id: string) => apiFetch(`/v1/delegations/${id}/revoke`, { method: "POST", body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["delegations"] }),
  });

  if (!puoLeggere) return null;
  const pronta = delegante.length === 1 && delegato.length === 1 && dal && (ambito !== "CONSOLIDATION" || gruppi.length > 0);
  const oggetto = (d: Delegation) =>
    d.scope === "CONSOLIDATION" && d.groups?.length
      ? `${t(`roles.deleghe.ambito.${d.scope}`)}: ${d.groups.map((g) => t(`roles.deleghe.gruppo.${g}`)).join(", ")}`
      : t(`roles.deleghe.ambito.${d.scope}`);

  return (
    <Card data-testid="admin-delegations">
      <CardHeader><CardTitle>{t("roles.deleghe.titolo")}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {puoGestire && (
          <div data-testid="admin-delegation-form" className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <PersonPicker label={t("roles.deleghe.delegante")} value={delegante} onChange={(v) => setDelegante(v.slice(-1))} testId="admin-delegation-delegator" />
            <PersonPicker label={t("roles.deleghe.delegato")} value={delegato} onChange={(v) => setDelegato(v.slice(-1))} testId="admin-delegation-delegate" />
            <label className="text-sm font-medium text-foreground">
              {t("roles.deleghe.oggetto")}
              <select data-testid="admin-delegation-scope" className={SELECT_CLASS} value={ambito} onChange={(e) => setAmbito(e.target.value as Ambito)}>
                {AMBITI.map((a) => <option key={a} value={a}>{t(`roles.deleghe.ambito.${a}`)}</option>)}
              </select>
            </label>
            {ambito === "CONSOLIDATION" ? (
              <fieldset className="text-sm">
                <legend className="font-medium text-foreground">{t("roles.deleghe.gruppi")}</legend>
                {GRUPPI.map((g) => (
                  <label key={g} className="mr-4 inline-flex items-center gap-1">
                    <input type="checkbox" data-testid={`admin-delegation-group-${g}`} checked={gruppi.includes(g)}
                      onChange={(e) => setGruppi((x) => (e.target.checked ? [...x, g] : x.filter((y) => y !== g)))} />
                    {t(`roles.deleghe.gruppo.${g}`)}
                  </label>
                ))}
              </fieldset>
            ) : <div />}
            <label className="text-sm font-medium text-foreground">
              {t("roles.deleghe.dal")}
              <Input type="date" data-testid="admin-delegation-from" value={dal} onChange={(e) => setDal(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-foreground">
              {t("roles.deleghe.al")}
              <Input type="date" data-testid="admin-delegation-to" value={al} onChange={(e) => setAl(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-foreground md:col-span-2">
              {t("roles.deleghe.motivo")}
              <Input data-testid="admin-delegation-reason" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
            </label>
            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="button" data-testid="admin-delegation-submit" disabled={!pronta || crea.isPending} onClick={() => crea.mutate()}>
                {crea.isPending ? t("common:saving") : t("roles.deleghe.registra")}
              </Button>
              {crea.isError && <span data-testid="admin-delegation-error" className="text-sm text-danger">{messaggio(crea.error, t)}</span>}
            </div>
          </div>
        )}
        <EntityTable<Delegation> originPath="/v1/delegations"
          isLoading={elenco.isLoading}
          isError={elenco.isError}
          error={elenco.error}
          rows={elenco.data?.items ?? []}
          rowKey={(d) => d.delegationId}
          rowTestId="admin-delegation-row"
          emptyTestId="admin-delegations-empty"
          emptyTitle={t("roles.deleghe.vuoto")}
          caption={t("roles.deleghe.titolo")}
          columns={[
            { header: t("roles.deleghe.delegante"), cell: (d) => d.delegatorName ?? "—" },
            { header: t("roles.deleghe.delegato"), cell: (d) => d.delegateName ?? "—" },
            { header: t("roles.deleghe.oggetto"), cell: (d) => <span className="text-xs">{oggetto(d)}</span> },
            { header: t("roles.deleghe.periodo"), cell: (d) => <span className="text-xs">{fmt.data(d.startsOn)} – {d.endsOn ? fmt.data(d.endsOn) : t("roles.deleghe.senzaFine")}</span> },
            { header: "", cell: (d) => puoGestire && d.status === "ACTIVE" ? (
              <Button type="button" size="sm" variant="outline" data-testid="admin-delegation-revoke" disabled={revoca.isPending}
                onClick={() => { if (window.confirm(t("roles.deleghe.confermaRevoca"))) revoca.mutate(d.delegationId); }}>
                {t("roles.deleghe.revoca")}
              </Button>
            ) : null },
            { header: t("roles.deleghe.stato"), cell: (d) => (
              <Badge variant={d.isInForce ? "success" : "secondary"}>
                {d.status === "REVOKED" ? t("roles.deleghe.revocata") : d.isInForce ? t("roles.deleghe.inVigore") : t("roles.deleghe.nonInVigore")}
              </Badge>
            ) },
          ]}
        />
      </CardContent>
    </Card>
  );
}
