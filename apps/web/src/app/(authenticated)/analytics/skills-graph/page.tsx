"use client";

/**
 * apps/web/src/app/(authenticated)/analytics/skills-graph/page.tsx
 *
 * #50 F3 — la vista del grafo delle competenze.
 *
 * `KGGraphCanvas` di @heuresys/ui era stato costruito e non aveva MAI avuto un
 * consumatore (verificato con un grep su apps/ e packages/ prima di scrivere
 * questa pagina): qui trova il primo. Nessun componente riutilizzabile nasce in
 * questo repository — il canvas arriva dal design system, come vuole la regola.
 *
 * ⚠ SI PARTE SEMPRE DA UNA COMPETENZA, e non e' una comodita' dell'interfaccia.
 * L'endpoint accetta `root` assente, e allora restituisce l'INTERO catalogo:
 * misurato in produzione, 18.438 archi espliciti piu' quelli di appartenenza.
 * Disegnarli tutti non e' una vista, e' un blocco del browser. Quindi la pagina
 * chiede prima una competenza, e senza quella non interroga il grafo.
 *
 * I dati vengono da `GET /v1/skills/graph`, che esisteva gia' (#50 F2) — questa
 * pagina non ne aggiunge un secondo. `orgGate: "catalog"` lato API: un grafo di
 * competenze e' tassonomia, non persone, e nessuno dei suoi nodi e' un individuo.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, EmptyState, Input, KGGraphCanvas, PageHeader, StatsCard } from "@heuresys/ui";
import { Network, Share2, Waypoints } from "lucide-react";
import type { Skill, SkillGraphResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/** I salti che la pagina offre. L'API ne ammette fino a 6, ma oltre il terzo il
 *  vicinato di una competenza ESCO copre mezzo catalogo e il disegno smette di
 *  dire qualcosa: e' un limite di LEGGIBILITA', non dell'endpoint. */
const DEPTHS = [1, 2, 3] as const;

export default function SkillsGraphPage() {
  const { t } = useTranslation("analytics");
  const [query, setQuery] = useState("");
  const [rootId, setRootId] = useState<string | null>(null);
  const [depth, setDepth] = useState<number>(2);

  // La ricerca parte da due caratteri: con uno solo il catalogo (14.031 voci)
  // risponderebbe qualunque cosa, e un elenco che risponde sempre non aiuta.
  const search = useQuery({
    queryKey: ["skills", "search", query],
    queryFn: () =>
      apiFetch<{ items: Skill[]; total: number }>(`/v1/skills?search=${encodeURIComponent(query)}&limit=10`),
    enabled: query.trim().length >= 2,
  });

  const graph = useQuery({
    queryKey: ["skills", "graph", rootId, depth],
    queryFn: () =>
      apiFetch<SkillGraphResponse>(`/v1/skills/graph?root=${rootId}&depth=${depth}`),
    enabled: rootId !== null,
  });

  const d = graph.data;

  return (
    <main data-testid="analytics-skills-graph" className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        title={t("skillsGraph.title")}
        description={t("skillsGraph.description")}
      />

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("skillsGraph.searchLabel")}</span>
            <Input
              data-testid="skills-graph-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("skillsGraph.searchPlaceholder")}
              className="w-72"
            />
          </label>
          <div className="flex gap-1" data-testid="skills-graph-depth">
            {DEPTHS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDepth(n)}
                aria-pressed={depth === n}
                className={
                  depth === n
                    ? "rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm"
                    : "rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
                }
              >
                {t("skillsGraph.depth", { count: n })}
              </button>
            ))}
          </div>
        </div>

        {search.data && search.data.items.length > 0 && (
          <ul className="flex flex-wrap gap-2" data-testid="skills-graph-results">
            {search.data.items.map((s: Skill) => (
              <li key={s.skillId}>
                <button
                  type="button"
                  onClick={() => setRootId(s.skillId)}
                  aria-pressed={rootId === s.skillId}
                  className={
                    rootId === s.skillId
                      ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm"
                      : "rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
                  }
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {rootId === null ? (
          <EmptyState
            data-testid="skills-graph-empty"
            title={t("skillsGraph.pickTitle")}
            description={t("skillsGraph.pickDescription")}
          />
        ) : graph.isLoading ? (
          <span data-testid="skills-graph-loading" className="text-sm text-muted-foreground">
            {t("common:loading")}
          </span>
        ) : graph.isError ? (
          <p data-testid="skills-graph-error" className="text-sm text-danger">
            {t("error")}
          </p>
        ) : d ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatsCard
                label={t("skillsGraph.nodes")}
                value={String(d.counts.nodes)}
                icon={<Waypoints className="h-4 w-4" />}
              />
              <StatsCard
                label={t("skillsGraph.explicitEdges")}
                value={String(d.counts.explicitEdges)}
                icon={<Share2 className="h-4 w-4" />}
              />
              <StatsCard
                label={t("skillsGraph.groupEdges")}
                value={String(d.counts.groupEdges)}
                icon={<Network className="h-4 w-4" />}
              />
            </div>

            <div data-testid="skills-graph-canvas" className="rounded-lg border border-border p-2">
              <KGGraphCanvas
                nodes={d.nodes.map((n) => ({ id: n.id, label: n.label, group: n.kind }))}
                edges={d.edges.map((e) => ({
                  // L'endpoint non da' un identificativo all'arco: la coppia piu'
                  // il tipo lo identifica, ed e' unica per costruzione (non
                  // esistono due archi dello stesso tipo fra gli stessi due nodi).
                  id: `${e.source}:${e.target}:${e.kind}`,
                  source: e.source,
                  target: e.target,
                  label: e.kind,
                }))}
                emptyState={t("skillsGraph.canvasEmpty")}
              />
            </div>

            {/* Il grafo dichiara di che specie sono i suoi archi. Un disegno che
                mescola i legami espliciti con l'appartenenza alla tassonomia,
                senza dirlo, fa leggere come «vicinanza» cio' che e' solo
                «stessa cartella». */}
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{t("skillsGraph.legendExplicit")}</Badge>
              <Badge variant="outline">{t("skillsGraph.legendGroup")}</Badge>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
