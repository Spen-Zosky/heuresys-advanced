"use client";

/**
 * apps/web/src/app/(authenticated)/dashboard/[famiglia]/page.tsx — #142 F4.
 *
 * UNA pagina per otto famiglie, e non è una scorciatoia: è la conseguenza di come F2 ha
 * modellato i cruscotti. Il catalogo vive nel database (`sys_dashboards` + i suoi blocchi),
 * ogni vista dichiara le proprie classi di dato, e F3b restituisce il contenuto in TRE
 * forme discriminate — `counters`, `series`, `list`. Un componente per FORMA, non per
 * vista: così una famiglia nuova, o una vista in più, non chiede una riga di frontend.
 * Scrivere otto pagine gemelle avrebbe riportato a mano ciò che M3 esiste per derivare.
 *
 * LA FAMIGLIA SI TROVA PER ROUTE, non da una mappa segmento→codice. Le route sono in
 * italiano (`/dashboard/azienda`) e i codici in inglese (`company`); tenere una tabella di
 * corrispondenza qui significherebbe una seconda verità che invecchia da sola. La pagina
 * confronta invece il proprio percorso con `route` del catalogo: la corrispondenza la
 * dichiara il database, che è dove sta già.
 *
 * LE TRE MODALITÀ SI DISEGNANO TUTTE E TRE, e la mascherata NON è uno stato vuoto:
 * ADR-0032 vuole che la vista resti visibile mentre i valori sono trattenuti, con il perché
 * scritto. Una vista che sparisce senza spiegazione è indistinguibile da una che non è mai
 * esistita, e chi guarda non può nemmeno chiedersi perché.
 *
 * Nessun dato inventato: ogni numero arriva da `/v1/dashboard/catalog/:code/data`.
 */

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Sparkline,
  Spinner,
  StatsCard,
} from "@heuresys/ui";
import { LayoutDashboard, Lock, EyeOff } from "lucide-react";
import type {
  DashboardBlockData,
  DashboardCatalogResponse,
  DashboardDataResponse,
} from "@heuresys/shared";
import { apiFetch } from "../../../../lib/api/fetch";

/** Le viste con valori si disegnano per forma; le altre dicono perché non li hanno. */
function Vista({ v, t }: { v: DashboardBlockData; t: (k: string) => string }) {
  if (v.content === null) {
    const negata = v.access === "denied";
    return (
      <Card data-testid={`vista-${v.code}`} data-access={v.access}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {negata ? <Lock className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {v.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Il motivo è testo che viene dall'API: qui non si riscrive, o diventerebbe una
              seconda dichiarazione da tenere allineata a quella del servizio. */}
          <p
            data-testid={`motivo-${v.code}`}
            className={negata ? "text-sm text-danger" : "text-sm text-warning"}
          >
            {v.withheldReason ?? t("dashboard.famiglie.senzaValori")}
          </p>
          {v.dataClasses.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {v.dataClasses.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (v.content.kind === "counters") {
    return (
      <Card data-testid={`vista-${v.code}`} data-access={v.access}>
        <CardHeader>
          <CardTitle>{v.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {v.content.counters.length === 0 ? (
            <EmptyState title={t("dashboard.famiglie.vuotoValori")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {v.content.counters.map((c) => (
                <StatsCard key={c.key} label={c.label} value={c.value} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (v.content.kind === "series") {
    const punti = v.content.points;
    return (
      <Card data-testid={`vista-${v.code}`} data-access={v.access}>
        <CardHeader>
          <CardTitle>{v.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {punti.length === 0 ? (
            <EmptyState title={t("dashboard.famiglie.vuotoAndamento")} />
          ) : (
            <>
              <Sparkline data={punti.map((p) => p.value)} />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{punti[0]?.bucket}</span>
                <span>{punti[punti.length - 1]?.bucket}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const righe = v.content.rows;
  return (
    <Card data-testid={`vista-${v.code}`} data-access={v.access}>
      <CardHeader>
        <CardTitle>{v.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {righe.length === 0 ? (
          <EmptyState title={t("dashboard.famiglie.vuotoRighe")} />
        ) : (
          <DataTable
            data={righe}
            columns={[
              { accessorKey: "label", header: t("dashboard.famiglie.colonnaVoce") },
              { accessorKey: "detail", header: t("dashboard.famiglie.colonnaDettaglio") },
              { accessorKey: "value", header: t("dashboard.famiglie.colonnaValore") },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function CruscottoDiFamigliaPage() {
  const { t: tr } = useTranslation("admin");
  const t = (k: string) => tr(k);
  const params = useParams<{ famiglia: string }>();
  const percorso = `/dashboard/${params.famiglia}`;

  const catalogo = useQuery({
    queryKey: ["dashboard", "catalog"],
    queryFn: () => apiFetch<DashboardCatalogResponse>("/v1/dashboard/catalog"),
  });

  // La famiglia si deriva dalla route dichiarata nel catalogo: nessuna mappa locale.
  const famiglia = useMemo(
    () => catalogo.data?.dashboards.find((d) => d.route === percorso) ?? null,
    [catalogo.data, percorso],
  );

  const dati = useQuery({
    queryKey: ["dashboard", "data", famiglia?.code],
    queryFn: () => apiFetch<DashboardDataResponse>(`/v1/dashboard/catalog/${famiglia?.code}/data`),
    enabled: famiglia !== null,
  });

  if (catalogo.isLoading) return <Spinner />;
  if (catalogo.isError) return <ErrorState title={t("dashboard.famiglie.catalogoIrraggiungibile")} />;

  // Il catalogo contiene SOLO ciò a cui l'attore ha diritto: se la famiglia non c'è, o non
  // esiste o non è sua — e in entrambi i casi la risposta onesta è la stessa, senza
  // rivelare quale dei due (nessuna enumerazione).
  if (famiglia === null) {
    return (
      <EmptyState
        data-testid="cruscotto-non-disponibile"
        title={t("dashboard.famiglie.nonDisponibileTitolo")}
        description={t("dashboard.famiglie.nonDisponibileTesto")}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid={`cruscotto-${famiglia.code}`}>
      <PageHeader
        badges={<Badge variant="outline"><LayoutDashboard className="mr-1 h-3.5 w-3.5" />{t("dashboard.famiglie.badge")}</Badge>}
        title={famiglia.name}
        description={
          famiglia.maskedBlockCount > 0
            ? tr("dashboard.famiglie.visteConTrattenute", {
                count: famiglia.blockCount,
                masked: famiglia.maskedBlockCount,
              })
            : tr("dashboard.famiglie.vistePlurale", { count: famiglia.blockCount })
        }
      />

      {dati.isLoading && <Spinner />}
      {dati.isError && <ErrorState title={t("dashboard.famiglie.datiIrraggiungibili")} />}

      {dati.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          {dati.data.blocks.map((v) => (
            <Vista key={v.code} v={v} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
