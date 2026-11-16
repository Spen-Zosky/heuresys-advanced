"use client";
import { useFormat, type Formati } from "@/lib/format";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import type { AdvisorSuggestionsResponse, AdvisorSuggestion, AdvisorCitation } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

// #58 F4 — advisor prescrittivo. Tutto viene da GET /v1/advisor/suggestions, derivato dalle
// scorecard F1/F2/F3 da un motore a REGOLE: nessun modello linguistico, nessun dato finto,
// empty-state reale quando nessuna regola trova casi.
//
// Le FONTI sono rese in pagina, non nascoste dietro un'icona: sono ciò che distingue questa
// pagina da un generatore di frasi plausibili. Un consiglio che si legge senza poterne
// verificare l'origine vale quanto un'opinione.

const PRIORITY_TONE = (p: number): "danger" | "warning" | "info" =>
  p >= 75 ? "danger" : p >= 50 ? "warning" : "info";

type T = ReturnType<typeof useTranslation>["t"];

/** Il campo tecnico della fonte («evidence.holders») in parole; un campo nuovo resta com'è. */
function campoLeggibile(campo: string, t: T): string {
  const dim = /^dimensions\.(\w+)\.score$/.exec(campo);
  if (dim) return t("advisor.fields.dimensionScore", { dimension: t(`orgHealth.dims.${dim[1]}`, { defaultValue: dim[1] }) });
  return t(`advisor.fields.${campo.replace(/\./g, "_")}`, { defaultValue: campo });
}

/** Campi la cui misura è una quota 0-1 (si scrive «85 %»). */
const CAMPI_QUOTA = new Set(["evidence.verifiedShare", "coverage"]);
/** Campi il cui valore è un codice di elenco chiuso (verdetto, posizione in classifica). */
const CAMPI_CODICE: Record<string, string> = { verdict: "vrio.verdicts", standing: "orgHealth.standings" };

function valoreLeggibile(c: AdvisorCitation, t: T, fmt: Formati): string {
  const v = c.value;
  const chiave = CAMPI_CODICE[c.field];
  if (chiave && typeof v === "string") return t(`${chiave}.${v}`, { defaultValue: v });
  if (typeof v === "number") {
    if (CAMPI_QUOTA.has(c.field) || /^dimensions\.\w+\.score$/.test(c.field)) return fmt.percento(v, "0-1");
    return fmt.numero(v, 2);
  }
  return String(v);
}

function Citation({ c, t, fmt }: { c: AdvisorCitation; t: T; fmt: Formati }) {
  return (
    <li data-testid="advisor-citation" className="flex flex-wrap items-baseline gap-x-1.5 leading-tight">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t(`advisor.sources.${c.source}`)}
      </span>
      <span className="text-xs text-foreground">{c.subjectLabel}</span>
      {/* il campo grezzo resta solo nel suggerimento, per chi deve ritrovarlo nella fonte */}
      <span className="text-xs text-muted-foreground" title={c.field}>{campoLeggibile(c.field, t)}:</span>
      <span className="text-xs font-semibold tabular-nums text-foreground">{valoreLeggibile(c, t, fmt)}</span>
    </li>
  );
}

// D3-07 (forense 15/11): i parametri della frase arrivano dal motore come codici e numeri grezzi
// («performance», «36.5»): la dimensione si traduce, i numeri passano dal formattatore.
function paroleDi(p: Record<string, unknown> | undefined, t: ReturnType<typeof useTranslation>["t"], fmt: Formati): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(p ?? {}).map(([k, v]) => [
      k,
      k === "dimension" && typeof v === "string"
        ? t(`orgHealth.dims.${v}`, { defaultValue: v })
        // Conteggi con il nome accanto («1 posizione», «3 posizioni»): il plurale lo sceglie i18next.
        : (k === "positions" || k === "critical") && typeof v === "number"
          ? t(`advisor.conteggi.${k}`, { count: v })
          : typeof v === "number" ? fmt.numero(v, 1) : v,
    ]),
  );
}

function buildColumns(t: ReturnType<typeof useTranslation>["t"], fmt: Formati): DataColumn<AdvisorSuggestion>[] {
  return [
    {
      header: t("advisor.cols.subject"),
      cell: (r) => <span className="text-sm font-medium text-foreground">{r.subjectLabel}</span>,
    },
    {
      header: t("advisor.cols.rule"),
      cell: (r) => (
        <span className="flex flex-col leading-tight" data-testid={`advisor-rule-${r.ruleId}`}>
          <span className="text-xs font-medium text-foreground">{t(`advisor.rules.${r.ruleId}`)}</span>
          <span className="text-xs text-muted-foreground">{t(`advisor.subjectTypes.${r.subjectType}`)}</span>
        </span>
      ),
    },
    {
      header: t("advisor.cols.action"),
      cell: (r) => (
        <span data-testid="advisor-headline" className="block max-w-xl text-sm text-foreground">
          {t(`advisor.rule.${r.headlineKey.replace("advisor.rule.", "")}`, paroleDi(r.headlineParams, t, fmt))}
        </span>
      ),
    },
    {
      header: t("advisor.cols.citations"),
      cell: (r) => (
        <ul data-testid="advisor-citations" className="flex max-w-md flex-wrap gap-x-3 gap-y-0.5">
          {r.citations.map((c, i) => (
            <Citation key={`${c.source}-${c.field}-${i}`} c={c} t={t} fmt={fmt} />
          ))}
        </ul>
      ),
    },
    // C3/R3: la priorità chiude la riga, non la apre
    {
      header: t("advisor.cols.priority"),
      align: "right",
      cell: (r) => (
        <span data-testid={`advisor-priority-${r.ruleId}`}>
          <StatusPill tone={PRIORITY_TONE(r.priority)}>{Math.round(r.priority)}</StatusPill>
        </span>
      ),
    },
  ];
}

export default function AdvisorPage() {
  const { t } = useTranslation("hr");

  const advisor = useQuery({
    queryKey: ["advisor-suggestions"],
    queryFn: () => apiFetch<AdvisorSuggestionsResponse>("/v1/advisor/suggestions"),
  });

  const fmt = useFormat();
  const columns = useMemo(() => buildColumns(t, fmt), [t, fmt]);
  const data = advisor.data;

  return (
    <main data-testid="advisor-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader
        data-testid="advisor-title"
        title={t("advisor.title")}
        description={t("advisor.description")}
        badges={
          data ? (
            <Badge variant="secondary" data-testid="advisor-count">
              {t("advisor.count", { count: data.total })}
            </Badge>
          ) : undefined
        }
      />

      <EntityTable<AdvisorSuggestion> originPath={"/v1/advisor/suggestions"}
        isLoading={advisor.isLoading}
        isError={advisor.isError}
        error={advisor.error}
        errorMessage={t("advisor.errorMessage")}
        rows={data?.items ?? []}
        pageSize={10}
        rowKey={(r) => `${r.ruleId}-${r.subjectId}`}
        rowTestId="advisor-row"
        columns={columns}
        emptyTestId="advisor-empty"
        emptyTitle={t("advisor.emptyTitle")}
        emptyDescription={t("advisor.emptyDescription")}
        caption={t("advisor.caption")}
      />

      <p data-testid="advisor-method" className="text-xs text-muted-foreground">
        {data
          ? t("advisor.method", {
              count: data.total,
              rules: data.rulesEvaluated.length,
              discarded: data.discarded,
              model: data.modelVersion,
            })
          : t("advisor.methodIdle")}
      </p>
    </main>
  );
}
