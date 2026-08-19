"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
  ApplyVersionResponse,
  BuildPlanPreview,
  TenantBlueprintDetail,
  TenantBlueprintVersion,
} from "@heuresys/shared";
import { Button, Spinner, ErrorState, EmptyState } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";

import { useCurrentUserPermissions } from "@/lib/api/auth";
import { StatusPill } from "@/components/status-pill";

/**
 * #198 Tenant Builder P3, T7 — LA COSTRUZIONE: il piano prima, e la firma dopo.
 *
 * Due cose che questa pagina deve dire, e che sono la ragione per cui esiste:
 *
 * ① IL PIANO NON COSTRUISCE. `build-plan` è una lettura (è un `POST` per convenzione di
 *    protocollo, non perché scriva), e mostra due colonne che non si confondono:
 *    `willCreate` = quante righe NASCEREBBERO · `alreadyThere` = quante ci sono GIÀ.
 *    La seconda è ciò che separa una costruzione nuova da una ri-applicazione su
 *    un'azienda già popolata, e chi firma deve vederla PRIMA di firmare.
 *
 * ② NEMMENO `apply` COSTRUISCE. Apre una richiesta di approvazione; la costruzione
 *    avviene quando quella richiesta viene approvata, dentro la transazione di T5. La
 *    risposta non porta conteggi di righe **apposta** — vederli farebbe credere che sia
 *    già successo qualcosa. La pagina lo scrive, invece di lasciare che il silenzio
 *    venga interpretato.
 *
 * Il bottone non è nascosto quando non si può premere: è **disabilitato con il motivo
 * scritto**. Un bottone che sparisce lascia il dubbio se manchi il permesso o la
 * funzione; un bottone spento che dice perché è un'informazione.
 */
export default function TenantBlueprintBuildPage({
  params,
}: {
  params: Promise<{ id: string; n: string }>;
}) {
  const { id, n } = use(params);
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();

  /**
   * L'errore dell'API, riconosciuto per FORMA e non con `instanceof`.
   *
   * ⚠ `isApiError()` usa `instanceof ApiError`, e nel bundle di produzione quel controllo
   * torna **false**: la pagina mostrava il messaggio generico e ritentava una risposta 409 —
   * cioe' una condizione stabile — restando sullo Spinner oltre il timeout del caso E2E.
   * Misurato leggendo lo screenshot del fallimento: il testo era «Il piano non e' calcolabile
   * per questa versione», che e' proprio il ramo di ripiego.
   * Un controllo strutturale non dipende da quale copia della classe ha costruito l'oggetto.
   */
  const erroreApi = (e: unknown): { status: number; message: string } | null =>
    typeof e === "object" && e !== null && "status" in e && "code" in e
      ? {
          status: Number((e as { status: unknown }).status),
          message: String((e as { message?: unknown }).message ?? ""),
        }
      : null;
  const perms = useCurrentUserPermissions();
  const canWrite = perms.data?.permissions.includes("tenant_blueprint:write") ?? false;
  const [esitoFirma, setEsitoFirma] = useState<ApplyVersionResponse | null>(null);

  const fascicolo = useQuery({
    queryKey: ["tenant-blueprints", id],
    queryFn: () => apiFetch<TenantBlueprintDetail>(`/v1/tenant-blueprints/${id}`),
  });

  // Il piano è una LETTURA servita da un POST: si chiede al caricamento come una
  // qualunque vista, non dietro un bottone. Chiamarlo non cambia niente nel database —
  // è la proprietà che T4/T6 hanno dimostrato con un sabotaggio.
  const piano = useQuery({
    queryKey: ["tenant-blueprint-build-plan", id, n],
    queryFn: () =>
      apiFetch<BuildPlanPreview>(`/v1/tenant-blueprints/${id}/versions/${n}/build-plan`, {
        method: "POST",
      }),
    // ⚠ UN 4xx NON SI RITENTA, ED E' LA CURA DI UN DIFETTO MISURATO (#211 F4, S1072).
    //   Il servizio risponde 409 quando il piano non e' calcolabile — modello vuoto, sorgente
    //   non dichiarata, contenuto incoerente — e sono condizioni STABILI: ritentarle non
    //   cambia la risposta, ma tiene `isLoading` vero per tutta la durata dei tentativi. La
    //   pagina restava sullo Spinner **all'infinito** invece di dire cosa fosse successo, e
    //   il caso E2E non trovava ne' il piano ne' l'errore: era muta proprio quando aveva
    //   qualcosa di preciso da dire. I 5xx e i guasti di rete restano ritentabili, perche'
    //   li' un secondo tentativo puo' davvero andare diversamente.
    retry: (tentativi, errore) => {
      const api = erroreApi(errore);
      return api && api.status >= 400 && api.status < 500 ? false : tentativi < 2;
    },
  });

  const firma = useMutation({
    mutationFn: () =>
      apiFetch<ApplyVersionResponse>(`/v1/tenant-blueprints/${id}/versions/${n}/apply`, {
        method: "POST",
      }),
    onSuccess: (r) => {
      setEsitoFirma(r);
      void qc.invalidateQueries({ queryKey: ["tenant-blueprints", id] });
    },
  });

  if (fascicolo.isLoading || piano.isLoading) return <Spinner />;
  if (fascicolo.isError) return <ErrorState description={t("dossier.error")} />;

  const versione: TenantBlueprintVersion | undefined = fascicolo.data?.versions.find(
    (v) => String(v.number) === n,
  );
  if (!versione) return <EmptyState title={t("dossier.notFound")} />;

  // Perché NON si può firmare — un motivo per volta, e in ordine di precedenza.
  // ⚠ SE IL PIANO NON C'E', LA FIRMA NON DEVE ACCENDERSI — difetto misurato in `#211` F4.
  //   Il pulsante «Chiedi l'approvazione» restava attivo anche quando il piano non era
  //   calcolabile: premendolo si apriva una richiesta di approvazione **vera** per una
  //   costruzione che sarebbe fallita, e qualcuno avrebbe dovuto decidere su una cosa
  //   impossibile. Un blocco in piu' qui costa una riga; il contrario costa una richiesta
  //   sbagliata nella coda di qualcun altro.
  //   Sta PRIMA degli altri motivi perche' e' il piu' concreto: senza piano non c'e'
  //   proprio niente da firmare, qualunque sia lo stato della versione.
  const motivoBloccante: string | null = piano.isError
    ? t("dossier.build.blockedNoPlan")
    : !canWrite
    ? t("dossier.build.blockedNoPermission")
    : versione.status === "APPLIED"
      ? t("dossier.build.blockedApplied")
      : versione.status !== "APPROVED"
        ? t("dossier.build.blockedNotApproved", { status: versione.status })
        : null;

  const p = piano.data;
  const righe: Array<{ chiave: keyof BuildPlanPreview["willCreate"]; etichetta: string }> = [
    { chiave: "orgUnits", etichetta: t("dossier.build.rows.orgUnits") },
    { chiave: "positions", etichetta: t("dossier.build.rows.positions") },
    { chiave: "users", etichetta: t("dossier.build.rows.users") },
    { chiave: "assignments", etichetta: t("dossier.build.rows.assignments") },
    { chiave: "skills", etichetta: t("dossier.build.rows.skills") },
    { chiave: "kpis", etichetta: t("dossier.build.rows.kpis") },
    { chiave: "skillEvidence", etichetta: t("dossier.build.rows.skillEvidence") },
    { chiave: "kpiEvidence", etichetta: t("dossier.build.rows.kpiEvidence") },
  ];

  return (
    <div className="space-y-6" data-testid="tenant-blueprint-build">
      <header>
        <Link
          href={`/tenant-blueprints/${id}`}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          {t("dossier.back")}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{t("dossier.build.title")}</h1>
          <StatusPill tone={versione.status === "APPLIED" ? "success" : "info"}>
            {versione.status}
          </StatusPill>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("dossier.build.description")}</p>
      </header>

      {piano.isError ? (
        // ⚠ IL MOTIVO, NON UN ERRORE GENERICO (#211 F4, S1072). Qui c'era
        //   `t("dossier.build.planError")` — una frase uguale per ogni causa. Ma il servizio
        //   dice cose PRECISE e utili: «il modello non ha contenuto: va prima riempito»,
        //   «la versione non dichiara una sorgente di costruzione», «sorgente sconosciuta».
        //   Buttarle via e scrivere «non è stato possibile calcolare il piano» costringe chi
        //   guarda ad aprire i log per sapere cosa fare — ed è lo stesso difetto che un altro
        //   caso di questa suite chiama «la pagina dice la verità sul vuoto, invece di tacere».
        //   Trovato perché `#132` F3 ha reso il modello vuoto: la pagina è diventata muta
        //   proprio quando aveva qualcosa di preciso da dire.
        // ⚠ Il contenitore porta il `data-testid`, non `ErrorState`: quel componente viene dal
        //   design system (`@heuresys/ui`) e NON propaga gli attributi che non conosce —
        //   misurato, il caso E2E non trovava l'elemento. Il componente non si modifica da
        //   qui (vive nell'altro repo), quindi il marcatore va sul contenitore.
        <div data-testid="build-plan-error">
          <ErrorState
            description={
              erroreApi(piano.error)?.message ?? t("dossier.build.planError")
            }
          />
        </div>
      ) : p ? (
        <section
          className="rounded-lg border border-border bg-card p-4"
          data-testid="build-plan"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">{t("dossier.build.plan")}</h2>
            <span className="font-mono text-xs text-muted-foreground" data-testid="build-source">
              {p.label} · {p.sourceKey}
            </span>
          </div>
          {/* La riga che tiene insieme la pagina: il piano NON scrive. Senza,
              un elenco di numeri accanto a un bottone si legge «è già fatto». */}
          <p className="mt-1 text-xs text-muted-foreground">{t("dossier.build.planIsReadOnly")}</p>

          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">{t("dossier.build.plan")}</caption>
            <thead>
              <tr className="text-xs uppercase text-muted-foreground">
                <th scope="col" className="py-1 text-left font-medium">
                  {t("dossier.build.what")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("dossier.build.willCreate")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("dossier.build.alreadyThere")}
                </th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.chiave} className="border-t border-border" data-testid={`build-row-${r.chiave}`}>
                  <td className="py-1 text-foreground">{r.etichetta}</td>
                  <td className="py-1 text-right tabular-nums text-foreground">
                    {p.willCreate[r.chiave].toLocaleString()}
                  </td>
                  <td className="py-1 text-right tabular-nums text-muted-foreground">
                    {p.alreadyThere[r.chiave].toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("dossier.build.alreadyThereMeans")}
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-4" data-testid="build-apply">
        <h2 className="text-sm font-semibold text-foreground">{t("dossier.build.apply")}</h2>
        {/* Che cosa fa davvero il bottone. Scritto PRIMA di premerlo, non dopo. */}
        <p className="mt-1 text-sm text-muted-foreground">{t("dossier.build.applyOpensApproval")}</p>

        {motivoBloccante ? (
          <p className="mt-2 text-sm font-medium text-foreground" data-testid="build-apply-blocked">
            {motivoBloccante}
          </p>
        ) : null}

        <Button
          className="mt-3"
          data-testid="build-apply-button"
          disabled={motivoBloccante !== null || firma.isPending}
          onClick={() => firma.mutate()}
        >
          {firma.isPending ? t("dossier.build.applying") : t("dossier.build.applyAction")}
        </Button>

        {firma.isError ? (
          <p className="mt-2 text-sm text-destructive" data-testid="build-apply-error">
            {t("dossier.build.applyError")}
          </p>
        ) : null}

        {esitoFirma ? (
          <div className="mt-3 space-y-1" data-testid="build-apply-done">
            <p className="text-sm font-medium text-foreground">{t("dossier.build.applyDone")}</p>
            {/* L'assenza di conteggi qui è deliberata e viene DICHIARATA: la risposta
                non ne porta perché niente è ancora stato costruito. */}
            <p className="text-xs text-muted-foreground">{t("dossier.build.noCountsYet")}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {t("dossier.build.approvalRequest")}: {esitoFirma.approvalRequestId}
            </p>
            <Link
              href="/approvals"
              className="inline-block text-sm text-muted-foreground underline-offset-2 hover:underline"
              data-testid="build-to-approvals"
            >
              {t("dossier.build.toApprovals")}
            </Link>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-4" data-testid="build-registry">
        <h2 className="text-sm font-semibold text-foreground">{t("dossier.build.registry")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("dossier.build.registryHint")}</p>
        <Link
          href="/generated-origins"
          className="mt-2 inline-block text-sm text-muted-foreground underline-offset-2 hover:underline"
          data-testid="build-to-registry"
        >
          {t("dossier.build.toRegistry")}
        </Link>
      </section>
    </div>
  );
}
