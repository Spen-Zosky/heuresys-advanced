"use client";

/**
 * apps/web/src/components/organigramma/area-navigabile.tsx — l'area in cui si guarda un organigramma.
 *
 * Piano docs/piani/PIANO_organigrammi-navigazione_20261115.md (N1). Enzo, 15/11/2026: ogni
 * organigramma si apre adattato all'area; con il mouse nell'area la rotella e i tasti + e −
 * ingrandiscono e riducono; un doppio clic in una zona vuota torna alla vista adattata; il
 * trascinamento con il tasto sinistro sposta il contenuto; il doppio clic su un oggetto lo apre
 * (lo gestisce l'oggetto, che ferma l'evento). La stessa area per i blocchi, i nodi e i grafi salvati.
 *
 * Il contenuto si disegna alla sua grandezza naturale: o la dichiara chi lo usa (`larghezza`,
 * `altezza`, il caso dell'SVG disegnato da noi), o l'area la misura (un diagramma di terzi).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, Minus, Plus } from "lucide-react";
import { adatta, altezzaArea, zoomIntorno, PASSO_ZOOM, type Vista } from "@/lib/navigazione-area";

/** Gli oggetti che si aprono con il doppio clic portano questo attributo: lì il doppio clic non riadatta. */
export const ATTR_OGGETTO = "data-oggetto";
const SOGLIA_TRASCINAMENTO = 4;

function pxDa(massimo: string): number {
  const m = /^(\d+(?:\.\d+)?)vh$/.exec(massimo.trim());
  if (m && typeof window !== "undefined") return (window.innerHeight * Number(m[1])) / 100;
  const p = /^(\d+(?:\.\d+)?)px$/.exec(massimo.trim());
  return p ? Number(p[1]) : 600;
}

export function AreaNavigabile({
  larghezza, altezza, altezzaMax = "70vh", strumenti, children, testId, ariaLabel,
}: {
  /** Grandezza naturale del contenuto; se manca, l'area la misura. */
  larghezza?: number;
  altezza?: number;
  altezzaMax?: string;
  /** Pulsanti in più nella barra (per esempio «Esporta SVG»). */
  strumenti?: ReactNode;
  children: ReactNode;
  testId?: string;
  ariaLabel?: string;
}) {
  const { t } = useTranslation("common");
  const area = useRef<HTMLDivElement>(null);
  const dentro = useRef<HTMLDivElement>(null);
  const [misura, setMisura] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [larghezzaArea, setLarghezzaArea] = useState(0);
  // La vista scelta dalla persona; null = adattata. Finché è null, ogni cambio di grandezza
  // (dell'area o dei dati) riadatta da sé, senza un effetto che la ricalcoli.
  const [scelta, setScelta] = useState<Vista | null>(null);
  const [trascinando, setTrascinando] = useState(false);
  const sopra = useRef(false);
  const trascina = useRef<{ x0: number; y0: number; vx: number; vy: number; mosso: boolean; id: number } | null>(null);
  const appenaTrascinato = useRef(false);

  const nw = larghezza ?? misura.w;
  const nh = altezza ?? misura.h;
  const hArea = larghezzaArea ? altezzaArea(larghezzaArea, nw, nh, pxDa(altezzaMax)) : 240;
  const fit = adatta(larghezzaArea, hArea, nw, nh);
  const vista = scelta ?? fit;

  // Grandezza naturale misurata, quando non è dichiarata (offsetWidth ignora la trasformazione).
  useLayoutEffect(() => {
    if (larghezza != null && altezza != null) return;
    // Il contenitore interno è largo «max-content»: la sua grandezza è quella del contenuto.
    const el = dentro.current;
    if (!el) return;
    const leggi = () => setMisura({ w: el.offsetWidth, h: el.offsetHeight });
    leggi();
    const ro = new ResizeObserver(leggi);
    ro.observe(el);
    return () => ro.disconnect();
  }, [larghezza, altezza]);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const leggi = () => setLarghezzaArea(el.clientWidth);
    leggi();
    const ro = new ResizeObserver(leggi);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const riadatta = useCallback(() => setScelta(null), []);

  const zoom = useCallback((fattore: number, cx?: number, cy?: number) => {
    setScelta((v) => zoomIntorno(v ?? fit, fattore, cx ?? larghezzaArea / 2, cy ?? hArea / 2));
  }, [fit, larghezzaArea, hArea]);

  // La rotella: ascoltatore nativo non passivo, perché deve fermare lo scorrimento della pagina.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ruota = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const f = Math.pow(PASSO_ZOOM, -Math.sign(e.deltaY) * Math.min(3, Math.abs(e.deltaY) / 100 || 1));
      zoom(f, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", ruota, { passive: false });
    return () => el.removeEventListener("wheel", ruota);
  }, [zoom]);

  // I tasti + e − (e 0 per riadattare) valgono con il mouse nell'area o con l'area a fuoco.
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      const el = area.current;
      if (!el || !(sopra.current || el.contains(document.activeElement))) return;
      const dest = e.target as HTMLElement | null;
      if (dest && (dest.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(dest.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoom(PASSO_ZOOM); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoom(1 / PASSO_ZOOM); }
      else if (e.key === "0") { e.preventDefault(); riadatta(); }
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [zoom, riadatta]);

  return (
    <div data-testid={testId} className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <span className="mr-auto text-[11px] text-muted-foreground">{t("organigramma.navigazione.aiuto")}</span>
        <button type="button" aria-label={t("organigramma.riduci")} title={t("organigramma.riduci")} onClick={() => zoom(1 / PASSO_ZOOM)} className="rounded border border-border p-1 hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
        <span className="min-w-12 text-center text-xs tabular-nums" data-testid={testId ? `${testId}-scala` : undefined}>{Math.round(vista.s * 100)}%</span>
        <button type="button" aria-label={t("organigramma.ingrandisci")} title={t("organigramma.ingrandisci")} onClick={() => zoom(PASSO_ZOOM)} className="rounded border border-border p-1 hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={riadatta} data-testid={testId ? `${testId}-adatta` : undefined} className="ml-1 inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"><Maximize2 className="h-3.5 w-3.5" />{t("organigramma.navigazione.adatta")}</button>
        {strumenti}
      </div>
      <div
        ref={area}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        data-area-navigabile=""
        className="relative select-none overflow-hidden rounded-md border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{ height: hArea, cursor: trascinando ? "grabbing" : "grab", touchAction: "none" }}
        onPointerEnter={() => { sopra.current = true; }}
        onPointerLeave={() => { sopra.current = false; }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          trascina.current = { x0: e.clientX, y0: e.clientY, vx: vista.x, vy: vista.y, mosso: false, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          const d = trascina.current;
          if (!d || d.id !== e.pointerId) return;
          const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
          if (!d.mosso && Math.hypot(dx, dy) < SOGLIA_TRASCINAMENTO) return;
          if (!d.mosso) {
            d.mosso = true;
            // La cattura solo quando il trascinamento è iniziato: prima lascerebbe i clic
            // e i doppi clic all'area invece che all'oggetto sotto il mouse.
            area.current?.setPointerCapture(e.pointerId);
            setTrascinando(true);
          }
          setScelta((v) => ({ ...(v ?? fit), x: d.vx + dx, y: d.vy + dy }));
        }}
        onPointerUp={(e) => {
          const d = trascina.current;
          trascina.current = null;
          if (d?.mosso) {
            setTrascinando(false);
            appenaTrascinato.current = true;
            area.current?.releasePointerCapture(e.pointerId);
            setTimeout(() => { appenaTrascinato.current = false; }, 0);
          }
        }}
        onPointerCancel={() => { trascina.current = null; setTrascinando(false); }}
        // Un clic che chiude un trascinamento non apre e non chiude niente.
        onClickCapture={(e) => { if (appenaTrascinato.current) { e.stopPropagation(); e.preventDefault(); } }}
        onDoubleClick={(e) => {
          const el = e.target as Element | null;
          if (el?.closest(`[${ATTR_OGGETTO}]`)) return;
          riadatta();
        }}
      >
        <div
          ref={dentro}
          className="absolute left-0 top-0"
          style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.s})`, transformOrigin: "0 0", ...(larghezza != null ? { width: larghezza, height: altezza } : { width: "max-content" }) }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
