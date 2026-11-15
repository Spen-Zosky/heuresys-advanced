"use client";

/**
 * apps/web/src/components/organigramma/nodi.tsx — la vista a nodi.
 *
 * Piano docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V5): un nodo per unità organizzativa,
 * un albero ordinato da sinistra a destra, la grandezza del nodo dice quante persone lavorano
 * nell'unità e sotto di lei.
 *
 * Piano docs/piani/PIANO_organigrammi-navigazione_20261115.md (N4). Enzo, 15/11/2026: la vista
 * mostrava un solo ramo aperto e una struttura diversa dall'organigramma (la società come nodo al
 * vertice, le direzioni di staff al primo livello). Ora:
 *  - gli stessi dati dei blocchi, passati per `conVertice`: il Direttore Generale al vertice, la
 *    società come etichetta, sotto prima le divisioni e poi le direzioni di staff;
 *  - tutti i rami aperti; un clic sul pallino chiude o riapre un ramo;
 *  - SVG disegnato qui (non più ECharts) dentro `AreaNavigabile`: fit, rotella e + −,
 *    trascinamento e doppio clic come nei blocchi; il doppio clic su un nodo apre la scheda.
 */
import { useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { disponiAlbero } from "@/lib/organigramma-nodi";
import type { UnitaBlocco } from "@/lib/organigramma-blocchi";
import { AreaNavigabile, ATTR_OGGETTO } from "./area-navigabile";

export function OrganigrammaNodi({
  unita, onApri, evidenzia, ariaLabel, testId, altezzaMax = "75vh",
}: {
  unita: UnitaBlocco[];
  onApri?: (id: string) => void;
  evidenzia?: ReadonlySet<string>;
  ariaLabel: string;
  testId?: string;
  altezzaMax?: string;
}) {
  const { t } = useTranslation("common");
  const [chiusi, setChiusi] = useState<ReadonlySet<string>>(new Set());
  const a = useMemo(() => disponiAlbero(unita, chiusi), [unita, chiusi]);
  const radice = a.nodi.find((n) => n.livello === 0);
  const apriChiudi = (id: string) => setChiusi((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const tasto = (id: string, figlie: number) => (e: KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); onApri?.(id); }
    else if (e.key === " " && figlie) { e.preventDefault(); apriChiudi(id); }
  };

  return (
    <div data-testid={testId} data-profondita={a.profondita} data-nodi={a.nodi.length}>
      <AreaNavigabile larghezza={a.larghezza} altezza={a.altezza} altezzaMax={altezzaMax} ariaLabel={ariaLabel} {...(testId ? { testId: `${testId}-area` } : {})}>
        <svg role="group" aria-label={ariaLabel} width={a.larghezza} height={a.altezza} viewBox={`0 0 ${a.larghezza} ${a.altezza}`} fontFamily="Inter, Arial, Helvetica, sans-serif" className="block">
          {a.etichetta && radice ? (
            <text data-etichetta-societa="" x={radice.x} y={22} textAnchor="middle" fontSize={15} fontWeight={700} style={{ fill: "var(--foreground)" }}>{a.etichetta}</text>
          ) : null}
          <path d={a.linee.join("")} fill="none" style={{ stroke: "var(--muted-foreground)" }} strokeWidth={1.2} />
          {a.nodi.map((n) => {
            const daAprire = n.u.apri ?? n.u.id;
            const scelto = evidenzia?.has(n.u.id) || evidenzia?.has(daAprire) || false;
            const colore = n.livello === 0 ? "var(--foreground)" : n.u.filiale ? "var(--palette-3)" : "var(--palette-1)";
            // Le unità con figlie hanno il nome sopra il pallino (a destra passano i tratti verso le
            // figlie); le foglie a destra, dove non passa niente.
            const sopra = n.figlie > 0 && !n.chiuso;
            return (
              <g
                key={n.u.id}
                data-nodo={n.u.id}
                data-livello={n.livello}
                {...{ [ATTR_OGGETTO]: "" }}
                role={onApri ? "button" : undefined}
                tabIndex={onApri ? 0 : undefined}
                aria-label={`${n.u.nome}, ${t("organigramma.conSotto", { count: n.u.addettiTotali })}`}
                aria-expanded={n.figlie ? !n.chiuso : undefined}
                onDoubleClick={onApri ? (e) => { e.stopPropagation(); onApri(daAprire); } : undefined}
                onKeyDown={tasto(daAprire, n.figlie)}
                style={{ cursor: "pointer", outline: "none" }}
                className="focus-visible:opacity-80"
              >
                <title>{`${n.u.nome} — ${t("organigramma.conSotto", { count: n.u.addettiTotali })}`}</title>
                <circle
                  cx={n.x} cy={n.y} r={n.r}
                  style={{ fill: n.chiuso ? "var(--background)" : colore, stroke: scelto ? "var(--primary)" : colore }}
                  strokeWidth={scelto ? 4 : n.chiuso ? 2.5 : 1}
                  data-pallino=""
                  onClick={n.figlie ? (e) => { e.stopPropagation(); apriChiudi(n.u.id); } : undefined}
                />
                {n.chiuso ? <text x={n.x} y={n.y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} style={{ fill: colore, pointerEvents: "none" }}>+</text> : null}
                <text
                  x={sopra ? n.x : n.x + n.r + 6}
                  y={sopra ? n.y - n.r - 6 : n.y + 4}
                  textAnchor={sopra ? "middle" : "start"}
                  fontSize={12}
                  fontWeight={scelto || n.livello === 0 ? 700 : 400}
                  style={{ fill: scelto ? "var(--primary)" : "var(--foreground)", paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 4, strokeLinejoin: "round" }}
                >
                  {n.testo}
                </text>
              </g>
            );
          })}
        </svg>
      </AreaNavigabile>
    </div>
  );
}
