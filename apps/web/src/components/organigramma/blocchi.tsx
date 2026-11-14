"use client";

/**
 * apps/web/src/components/organigramma/blocchi.tsx — l'organigramma a blocchi in SVG.
 *
 * Piano docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V3): la resa del banco del datastore
 * (`orgchart.mjs`), con i colori dai token del tema invece della scala di grigi fissa: vertice
 * pieno, riquadri normali, filiali tratteggiate. Ogni riquadro porta le persone «Cognome, Nome»
 * (il responsabile per primo, in grassetto) e apre la scheda dell'unità a cascata.
 * La disposizione è in `lib/organigramma-blocchi.ts`.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Minus, Plus, Download } from "lucide-react";
import { disponi, taglia, type UnitaBlocco } from "@/lib/organigramma-blocchi";

const C = {
  vertice: "var(--foreground)",
  suVertice: "var(--background)",
  riquadro: "var(--card)",
  filiale: "var(--muted)",
  testo: "var(--foreground)",
  tenue: "var(--muted-foreground)",
  bordo: "var(--muted-foreground)",
  scelto: "var(--primary)",
  linea: "var(--muted-foreground)",
};

/** Sostituisce i `var(--x)` con i colori calcolati, così il file esportato si apre ovunque. */
function svgEsportabile(svg: SVGSVGElement): string {
  const copia = svg.cloneNode(true) as SVGSVGElement;
  const radice = getComputedStyle(document.documentElement);
  copia.querySelectorAll<SVGElement>("[style]").forEach((el) => {
    el.setAttribute("style", (el.getAttribute("style") ?? "").replace(/var\((--[a-zA-Z0-9-]+)\)/g, (_m, n: string) => radice.getPropertyValue(n).trim() || "#000"));
  });
  copia.removeAttribute("class");
  copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return copia.outerHTML;
}

export function OrganigrammaBlocchi({
  unita, conPersone = true, onApri, evidenzia, nomeFile = "organigramma", ariaLabel, altezzaMax = "70vh", testId,
}: {
  unita: UnitaBlocco[];
  conPersone?: boolean;
  onApri?: (id: string) => void;
  evidenzia?: ReadonlySet<string>;
  nomeFile?: string;
  ariaLabel: string;
  altezzaMax?: string;
  testId?: string;
}) {
  const { t } = useTranslation("common");
  const d = useMemo(() => disponi(unita, { conPersone }), [unita, conPersone]);
  const [scala, setScala] = useState(1);
  const ref = useRef<SVGSVGElement>(null);

  const esporta = () => {
    if (!ref.current) return;
    const blob = new Blob([svgEsportabile(ref.current)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nomeFile}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const tasto = (id: string) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onApri?.(id); }
  };

  return (
    <div data-testid={testId} className="space-y-2">
      <div className="flex items-center justify-end gap-1">
        <button type="button" aria-label={t("organigramma.riduci")} onClick={() => setScala((s) => Math.max(0.3, +(s - 0.15).toFixed(2)))} className="rounded border border-border p-1 hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => setScala(1)} className="min-w-12 rounded border border-border px-1.5 py-0.5 text-xs tabular-nums hover:bg-muted">{Math.round(scala * 100)}%</button>
        <button type="button" aria-label={t("organigramma.ingrandisci")} onClick={() => setScala((s) => Math.min(2, +(s + 0.15).toFixed(2)))} className="rounded border border-border p-1 hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={esporta} className="ml-2 inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"><Download className="h-3.5 w-3.5" />{t("organigramma.esportaSvg")}</button>
      </div>
      <div className="overflow-auto rounded-md border border-border bg-background" style={{ maxHeight: altezzaMax }}>
        <svg
          ref={ref}
          role="group"
          aria-label={ariaLabel}
          width={d.larghezza * scala}
          height={d.altezza * scala}
          viewBox={`0 0 ${d.larghezza} ${d.altezza}`}
          fontFamily="Inter, Arial, Helvetica, sans-serif"
          className="mx-auto block"
        >
          <path d={d.linee.join("")} fill="none" style={{ stroke: C.linea }} strokeWidth={1.25} />
          {d.nodi.map((n) => {
            const sintetico = n.u.id.startsWith("__");
            const scelto = evidenzia?.has(n.u.id) ?? false;
            const fill = n.radice ? C.vertice : n.u.filiale ? C.filiale : C.riquadro;
            const testo = n.radice ? C.suVertice : C.testo;
            const tenue = n.radice ? C.suVertice : C.tenue;
            const cx = n.x + n.w / 2;
            let y = n.y + 8;
            const cliccabile = !!onApri && !sintetico;
            return (
              <g
                key={n.u.id}
                data-unita={n.u.id}
                role={cliccabile ? "button" : undefined}
                tabIndex={cliccabile ? 0 : undefined}
                aria-label={cliccabile ? n.u.nome : undefined}
                onClick={cliccabile ? () => onApri!(n.u.id) : undefined}
                onKeyDown={cliccabile ? tasto(n.u.id) : undefined}
                style={{ cursor: cliccabile ? "pointer" : "default", outline: "none" }}
                className="focus-visible:opacity-80"
              >
                <title>{n.u.nome}</title>
                <rect
                  x={n.x} y={n.y} width={n.w} height={n.h} rx={5}
                  style={{ fill, stroke: scelto ? C.scelto : C.bordo }}
                  strokeWidth={scelto ? 3 : 1.1}
                  strokeDasharray={n.u.filiale ? "5 3" : undefined}
                />
                {n.titolo.map((r) => {
                  y += 14;
                  return <text key={`t${y}`} x={cx} y={y - 3} textAnchor="middle" fontSize={11.5} fontWeight={600} style={{ fill: testo }}>{r}</text>;
                })}
                {n.nomi.length ? (() => { y += 6; return null; })() : null}
                {n.nomi.map((p, i) => {
                  y += 13;
                  return (
                    <text key={`p${i}`} x={n.x + 10} y={y - 2} fontSize={10.5} fontWeight={p.responsabile ? 700 : 400} style={{ fill: testo }}>
                      {taglia(p.etichetta)}
                    </text>
                  );
                })}
                {n.altri ? (() => { y += 13; return <text x={n.x + 10} y={y - 2} fontSize={10} fontStyle="italic" style={{ fill: tenue }}>{t("organigramma.altri", { count: n.altri })}</text>; })() : null}
                <text x={cx} y={n.y + n.h - 6} textAnchor="middle" fontSize={9.5} style={{ fill: tenue }}>
                  {t("organigramma.persone", { count: n.u.persone.length })}
                  {n.u.addettiTotali > n.u.persone.length ? ` · ${t("organigramma.conSotto", { count: n.u.addettiTotali })}` : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
