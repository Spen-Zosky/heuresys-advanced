"use client";

/**
 * Chi occupa la posizione, e le proposte per cambiarlo (ondata 2 degli endpoint senza consumatori,
 * 2026-11-17). `POST /v1/user-position-assignments`, `.../:id/terminate` e `.../:id/transfer`
 * esistevano e nessuna pagina li chiamava. Ogni gesto crea una RICHIESTA DI APPROVAZIONE, mai una riga
 * di incarico: l'incarico lo scrive l'approvazione (I1, la storia non si cancella). Gli avvisi sulla
 * gerarchia dei livelli che la proposta introdurrebbe si mostrano subito: avvisano, non bloccano.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type {
  PositionAssignmentProposalSubmitted, User, UserPositionAssignment, UserPositionAssignmentListResponse,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";
import { useEnumLabel } from "@/lib/enum-labels";
import { PersonPicker } from "@/components/person-picker";
import { NomeOppure } from "@/components/senza-nome";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TIPI = ["PRIMARY", "SECONDARY", "INTERIM", "ACTING"] as const;
const oggi = () => new Date().toISOString().slice(0, 10);

function messaggio(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("positions.titolari.vietato");
    if (err.status === 409) return t("positions.titolari.conflitto");
  }
  return t("positions.titolari.errore");
}

function Esito({ r }: { r: PositionAssignmentProposalSubmitted }) {
  const { t } = useTranslation("admin");
  return (
    <div data-testid="assignment-proposal-ok" role="status" className="space-y-1 text-sm text-success">
      <p>{t("positions.titolari.inviata")}</p>
      {r.avvisiGerarchiaLivelli.map((a) => (
        <p key={`${a.unitaId}-${a.sottopostoId}`} className="text-warning">
          {t("positions.titolari.avviso", { unita: a.unitaNome, posto: a.sottopostoPosto })}
        </p>
      ))}
    </div>
  );
}

function AzioniIncarico({ incarico, onEsito }: { incarico: UserPositionAssignment; onEsito: (r: PositionAssignmentProposalSubmitted) => void }) {
  const { t } = useTranslation("admin");
  const [modo, setModo] = useState<"" | "fine" | "trasferimento">("");
  const [data, setData] = useState(oggi());
  const [cerca, setCerca] = useState("");
  const [nuova, setNuova] = useState("");
  const posizioni = useQuery({
    queryKey: ["positions", "scelta", cerca],
    queryFn: () => apiFetch<{ items: { positionId: string; title: string; code: string }[] }>(
      `/v1/positions?limit=50${cerca.trim() ? `&search=${encodeURIComponent(cerca.trim())}` : ""}`),
    enabled: modo === "trasferimento",
  });
  const invia = useMutation({
    mutationFn: () => modo === "fine"
      ? apiFetch<PositionAssignmentProposalSubmitted>(`/v1/user-position-assignments/${incarico.assignmentId}/terminate`, { method: "POST", body: { endDate: data } })
      : apiFetch<PositionAssignmentProposalSubmitted>(`/v1/user-position-assignments/${incarico.assignmentId}/transfer`, { method: "POST", body: { newPositionId: nuova, startDate: data } }),
    onSuccess: (r) => { setModo(""); onEsito(r); },
  });
  if (!modo) {
    return (
      <span className="flex gap-2">
        <Button type="button" size="sm" variant="outline" data-testid="assignment-terminate-open" onClick={() => setModo("fine")}>{t("positions.titolari.termina")}</Button>
        <Button type="button" size="sm" variant="outline" data-testid="assignment-transfer-open" onClick={() => setModo("trasferimento")}>{t("positions.titolari.trasferisci")}</Button>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-end gap-2" data-testid="assignment-action">
      {modo === "trasferimento" && (
        <>
          <Input aria-label={t("positions.titolari.cercaPosizione")} placeholder={t("positions.titolari.cercaPosizione")} className="w-40"
            value={cerca} onChange={(e) => setCerca(e.target.value)} data-testid="assignment-transfer-search" />
          <select aria-label={t("positions.titolari.nuovaPosizione")} className={`${SELECT_CLASS} w-56`} value={nuova}
            onChange={(e) => setNuova(e.target.value)} data-testid="assignment-transfer-position">
            <option value="">{t("positions.titolari.scegliPosizione")}</option>
            {(posizioni.data?.items ?? []).filter((p) => p.positionId !== incarico.positionId)
              .map((p) => <option key={p.positionId} value={p.positionId}>{p.title}</option>)}
          </select>
        </>
      )}
      <label className="text-xs text-muted-foreground">
        {modo === "fine" ? t("positions.titolari.dataFine") : t("positions.titolari.dataInizio")}
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} data-testid="assignment-action-date" />
      </label>
      <Button type="button" size="sm" data-testid="assignment-action-submit" disabled={!data || (modo === "trasferimento" && !nuova) || invia.isPending}
        onClick={() => invia.mutate()}>
        {invia.isPending ? t("common:saving") : t("positions.titolari.proponi")}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setModo("")}>{t("positions.titolari.annulla")}</Button>
      {invia.isError && <span className="text-xs text-danger">{messaggio(invia.error, t)}</span>}
    </span>
  );
}

export function TitolariPosizione({ positionId }: { positionId: string }) {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const puoLeggere = perms.includes("user_position_assignment:list");
  const puoProporre = perms.includes("user_position_assignment:create");
  const puoCambiare = perms.includes("user_position_assignment:update");
  const [persone, setPersone] = useState<User[]>([]);
  const [tipo, setTipo] = useState<(typeof TIPI)[number]>("PRIMARY");
  const [fte, setFte] = useState("1");
  const [dal, setDal] = useState(oggi());
  const [esito, setEsito] = useState<PositionAssignmentProposalSubmitted | null>(null);
  const incarichi = useQuery({
    queryKey: ["user-position-assignments", positionId],
    queryFn: () => apiFetch<UserPositionAssignmentListResponse>(`/v1/user-position-assignments?positionId=${positionId}&status=ACTIVE&limit=200`),
    enabled: puoLeggere,
  });
  const assegna = useMutation({
    mutationFn: () => apiFetch<PositionAssignmentProposalSubmitted>("/v1/user-position-assignments", {
      method: "POST", body: { userId: persone[0]!.userId, positionId, kind: tipo, fte: Number(fte), startDate: dal },
    }),
    onSuccess: (r) => { setPersone([]); setEsito(r); void qc.invalidateQueries({ queryKey: ["user-position-assignments", positionId] }); },
  });
  if (!puoLeggere) return null;
  const righe = incarichi.data?.items ?? [];
  return (
    <Card data-testid="position-holders">
      <CardHeader><CardTitle as="h2">{t("positions.titolari.titolo")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("positions.titolari.spiegazione")}</p>
        {esito && <Esito r={esito} />}
        {incarichi.isLoading ? <p className="text-sm text-muted-foreground">{t("common:loading")}</p> : righe.length === 0 ? (
          <p data-testid="position-holders-empty" className="text-sm text-muted-foreground">{t("positions.titolari.vuoto")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border">
            {righe.map((a) => (
              <li key={a.assignmentId} data-testid="position-holder-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
                <span>
                  <span className="font-medium"><NomeOppure nome={a.userDisplayName} id={a.userId} /></span>
                  <span className="text-xs text-muted-foreground">
                    {" · "}{enumLabel("assignmentKind", a.kind)} · {t("positions.titolari.fte", { fte: a.fte })} · {t("positions.titolari.dal", { data: fmt.data(a.startDate) })}
                  </span>
                </span>
                {puoCambiare && <AzioniIncarico incarico={a} onEsito={setEsito} />}
              </li>
            ))}
          </ul>
        )}
        {puoProporre && (
          <div data-testid="assignment-propose" className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-4">
              <PersonPicker label={t("positions.titolari.nuovoTitolare")} value={persone} onChange={(x) => setPersone(x.slice(-1))} testId="assignment-person" />
            </div>
            <label className="text-sm font-medium text-foreground">
              {t("positions.titolari.tipo")}
              <select data-testid="assignment-kind" className={SELECT_CLASS} value={tipo} onChange={(e) => setTipo(e.target.value as (typeof TIPI)[number])}>
                {TIPI.map((k) => <option key={k} value={k}>{enumLabel("assignmentKind", k)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-foreground">
              {t("positions.titolari.quota")}
              <Input data-testid="assignment-fte" type="number" min={0.01} max={1} step="0.05" value={fte} onChange={(e) => setFte(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-foreground">
              {t("positions.titolari.dataInizio")}
              <Input data-testid="assignment-start" type="date" value={dal} onChange={(e) => setDal(e.target.value)} />
            </label>
            <div className="flex items-end gap-3">
              <Button type="button" data-testid="assignment-submit" disabled={persone.length !== 1 || !dal || assegna.isPending} onClick={() => assegna.mutate()}>
                {assegna.isPending ? t("common:saving") : t("positions.titolari.proponi")}
              </Button>
            </div>
            {assegna.isError && <p data-testid="assignment-error" className="text-sm text-danger md:col-span-4">{messaggio(assegna.error, t)}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
