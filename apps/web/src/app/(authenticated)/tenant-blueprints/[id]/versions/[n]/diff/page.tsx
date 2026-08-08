"use client";

/**
 * apps/web/src/app/(authenticated)/tenant-blueprints/[id]/versions/[n]/diff/page.tsx
 * #131 Tenant Builder P1, T6 — il confronto, in tre sezioni.
 *
 * La terza sezione e' quella che conta di piu', e non mostra un numero: dice
 * che l'impatto **non e' calcolabile** in questa parte, e perche'. Un impatto
 * pari a zero al posto di un impatto sconosciuto si legge «nessuna
 * conseguenza», che e' il contrario della verita'.
 */
import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { BlueprintDiffResponse } from "@heuresys/shared";
import { Spinner, ErrorState } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";

export default function TenantBlueprintDiffPage({
  params,
}: {
  params: Promise<{ id: string; n: string }>;
}) {
  const { id, n } = use(params);
  const { t } = useTranslation("blueprints");

  const confronto = useQuery({
    queryKey: ["tenant-blueprint-diff", id, n],
    queryFn: () =>
      apiFetch<BlueprintDiffResponse>(
        `/v1/tenant-blueprints/${id}/versions/${n}/diff?against=MODEL_LATEST`,
      ),
  });

  if (confronto.isLoading) return <Spinner />;
  if (confronto.isError) return <ErrorState description={t("dossier.error")} />;
  const d = confronto.data;
  if (!d) return null;

  const nessuna =
    d.model.processesAdded.length === 0 &&
    d.model.processesRemoved.length === 0 &&
    d.model.processesRenamed.length === 0;

  return (
    <div className="space-y-6" data-testid="tenant-blueprint-diff">
      <header>
        <Link
          href={`/tenant-blueprints/${id}`}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          {t("dossier.back")}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-foreground">{t("dossier.diff.title")}</h1>
      </header>

      <section className="rounded-lg border border-border bg-card p-4" data-testid="diff-modello">
        <h2 className="text-sm font-semibold text-foreground">{t("dossier.diff.model")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {d.model.changed ? t("dossier.diff.changed") : t("dossier.diff.unchanged")}
          {d.model.fromVersionNumber !== null && d.model.toVersionNumber !== null
            ? ` · v${d.model.fromVersionNumber} → v${d.model.toVersionNumber}`
            : null}
        </p>
        {nessuna ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("dossier.diff.none")}</p>
        ) : (
          <dl className="mt-2 space-y-1 text-sm">
            <Elenco titolo={t("dossier.diff.added")} voci={d.model.processesAdded} />
            <Elenco titolo={t("dossier.diff.removed")} voci={d.model.processesRemoved} />
            <Elenco
              titolo={t("dossier.diff.renamed")}
              voci={d.model.processesRenamed.map((r) => `${r.code}: ${r.from} → ${r.to}`)}
            />
          </dl>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4" data-testid="diff-decisioni">
        <h2 className="text-sm font-semibold text-foreground">{t("dossier.diff.decisions")}</h2>
        {d.decisions.added.length === 0 &&
        d.decisions.removed.length === 0 &&
        d.decisions.changed.length === 0 &&
        d.decisions.identityChanged.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("dossier.diff.none")}</p>
        ) : (
          <dl className="mt-2 space-y-1 text-sm">
            <Elenco
              titolo={t("dossier.diff.added")}
              voci={d.decisions.added.map((p) => `${p.processCode} — ${p.inclusion}: ${p.rationale ?? ""}`)}
            />
            <Elenco
              titolo={t("dossier.diff.removed")}
              voci={d.decisions.removed.map((p) => `${p.processCode} — ${p.inclusion}`)}
            />
            <Elenco
              titolo={t("dossier.diff.identityChanged")}
              voci={d.decisions.identityChanged.map(
                (c) => `${c.field}: ${c.from ?? "—"} → ${c.to ?? "—"}`,
              )}
            />
          </dl>
        )}
      </section>

      <section
        className="rounded-lg border border-border bg-card p-4"
        data-testid="diff-impatto"
      >
        <h2 className="text-sm font-semibold text-foreground">{t("dossier.diff.impact")}</h2>
        <p className="mt-1 text-sm font-medium text-foreground" data-testid="diff-impatto-stato">
          {t("dossier.diff.notComputable")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{d.impact.reason}</p>
      </section>
    </div>
  );
}

function Elenco({ titolo, voci }: { titolo: string; voci: string[] }) {
  if (voci.length === 0) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">{titolo}</dt>
      {voci.map((v) => (
        <dd key={v} className="font-mono text-xs text-foreground">
          {v}
        </dd>
      ))}
    </div>
  );
}
