"use client";

/**
 * apps/web/src/components/organigramma/nodi.tsx — la vista a nodi, riprogettata.
 *
 * Piano docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V5). Enzo, 2026-11-14: il grafo a
 * nodi era affollato e illeggibile. Era un grafo «a forza» con un nodo per posizione (162 su RTL)
 * e le etichette sovrapposte. Ora:
 *  - un nodo per unità organizzativa (38 su RTL), non per posizione: le persone stanno nella scheda;
 *  - un albero ordinato da sinistra a destra invece della forza: ogni livello in colonna, nessun
 *    incrocio, etichette sempre orizzontali e leggibili;
 *  - si parte dai primi due livelli aperti; un clic sul pallino apre o chiude il ramo;
 *  - la grandezza del nodo dice quante persone lavorano nell'unità e sotto di lei;
 *  - il clic sull'etichetta apre la scheda dell'unità a cascata, con persone, posizioni e struttura.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { EChartsCard } from "@/app/(authenticated)/_charts-client";
import type { OrganigrammaUnita } from "@heuresys/shared";

/** Il riquadro al passaggio è HTML: i nomi delle unità li scrive il cliente, quindi si proteggono. */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]!);

interface NodoAlbero {
  id: string;
  name: string;
  value: number;
  children: NodoAlbero[];
  symbolSize: number;
  collapsed?: boolean;
  itemStyle: Record<string, unknown>;
  label?: Record<string, unknown>;
}

export function OrganigrammaNodi({
  unita, onApri, evidenzia, ariaLabel, testId,
}: {
  unita: OrganigrammaUnita[];
  onApri?: (id: string) => void;
  evidenzia?: ReadonlySet<string>;
  ariaLabel: string;
  testId?: string;
}) {
  const { t } = useTranslation("common");

  const { radici, foglie, profondita } = useMemo(() => {
    const ids = new Set(unita.map((u) => u.id));
    const figli = new Map<string, OrganigrammaUnita[]>();
    for (const u of unita) if (u.padreId && ids.has(u.padreId)) {
      if (!figli.has(u.padreId)) figli.set(u.padreId, []);
      figli.get(u.padreId)!.push(u);
    }
    const max = Math.max(1, ...unita.map((u) => u.addettiTotali));
    // Percorso fino alle unità evidenziate: quei rami partono aperti anche se profondi.
    const perId = new Map(unita.map((u) => [u.id, u]));
    const aperti = new Set<string>();
    for (const id of evidenzia ?? []) for (let c = perId.get(id); c; c = c.padreId ? perId.get(c.padreId) : undefined) aperti.add(c.id);
    const conto = { foglie: 0, prof: 1 };
    const visti = new Set<string>();
    const costruisci = (u: OrganigrammaUnita, l: number): NodoAlbero => {
      visti.add(u.id);
      conto.prof = Math.max(conto.prof, l);
      const f = (figli.get(u.id) ?? []).filter((k) => !visti.has(k.id)).map((k) => costruisci(k, l + 1));
      if (!f.length) conto.foglie++;
      const scelto = evidenzia?.has(u.id) ?? false;
      const colore = u.filiale ? "var(--palette-3)" : l === 1 ? "var(--foreground)" : "var(--palette-1)";
      return {
        id: u.id,
        name: u.nome,
        value: u.addettiTotali,
        children: f,
        symbolSize: 8 + Math.round(18 * Math.sqrt(u.addettiTotali / max)),
        ...(f.length && l >= 2 && !aperti.has(u.id) ? { collapsed: true } : {}),
        itemStyle: { color: colore, borderColor: scelto ? "var(--primary)" : "var(--background)", borderWidth: scelto ? 4 : 1 },
        ...(scelto ? { label: { fontWeight: 700, color: "var(--primary)" } } : {}),
      };
    };
    const r = unita.filter((u) => !u.padreId || !ids.has(u.padreId)).map((u) => costruisci(u, 1));
    return { radici: r, foglie: conto.foglie, profondita: conto.prof };
  }, [unita, evidenzia]);

  const altezza = Math.max(420, Math.min(1400, foglie * 30 + 80));
  const option = {
    tooltip: {
      trigger: "item" as const,
      formatter: (p: unknown) => { const q = p as { name: string; value: number }; return `${esc(q.name)}<br/>${esc(t("organigramma.conSotto", { count: q.value }))}`; },
    },
    series: radici.map((r, i) => ({
      type: "tree" as const,
      data: [r],
      top: radici.length > 1 ? `${(100 / radici.length) * i + 2}%` : "2%",
      bottom: radici.length > 1 ? `${100 - (100 / radici.length) * (i + 1) + 2}%` : "2%",
      left: "12%",
      right: "22%",
      orient: "LR" as const,
      layout: "orthogonal" as const,
      edgeShape: "polyline" as const,
      roam: true,
      expandAndCollapse: true,
      initialTreeDepth: -1,
      animationDuration: 250,
      lineStyle: { color: "var(--muted-foreground)", width: 1.2, curveness: 0 },
      label: {
        position: "left" as const, verticalAlign: "middle" as const, align: "right" as const,
        fontSize: 12, color: "var(--foreground)", backgroundColor: "var(--background)", padding: [2, 4],
        formatter: (p: unknown) => { const q = p as { name: string; value: number }; return `${q.name}  (${q.value})`; },
      },
      leaves: { label: { position: "right" as const, align: "left" as const } },
      emphasis: { focus: "descendant" as const },
    })),
  };

  return (
    <div data-testid={testId} data-profondita={profondita}>
      <EChartsCard
        option={option}
        height={altezza}
        ariaLabel={ariaLabel}
        onEvents={{
          click: (p: unknown) => {
            const q = p as { data?: { id?: string }; event?: { target?: { type?: string } } };
            // Il clic sul testo apre la scheda; quello sul pallino lo lascia aprire/chiudere il ramo.
            if (q.data?.id && q.event?.target?.type === "text") onApri?.(q.data.id);
          },
        }}
      />
    </div>
  );
}
