"use client";

/**
 * apps/web/src/components/barra-laterale.tsx — la barra laterale con i gruppi riordinabili.
 *
 * Richiesta di Enzo (2026-11-21): la persona sceglie la sequenza dei gruppi che preferisce. Ogni
 * titolo di gruppo porta, all'estrema destra, la maniglia ⠿: si tiene premuto e ci si muove in su
 * e in giù, e una linea continua fra due gruppi mostra dove finirà quello che si sta spostando.
 * Da tastiera la maniglia si prende con Invio/Spazio e si muove con le frecce (Esc annulla).
 *
 * Perché non `DashboardSidebar` di `@heuresys/ui`: quella rende il titolo come un solo pulsante e
 * non lascia posto a una maniglia né a un ordine deciso fuori. Qui l'involucro (scheda a destra,
 * comando di compressione, memoria dei gruppi chiusi, classi `sidebar-group*`) è lo stesso, così
 * stile, stato e prove restano quelli di prima. Quando il riordino sarà richiesto da un secondo
 * repo si porta in `ux-design-shared`.
 *
 * L'ordine scelto si salva sul server, accanto alle altre preferenze della persona
 * (`PATCH /v1/me/preferences`, campo `sidebarOrder`): vale a ogni accesso e su ogni dispositivo.
 * Chi non l'ha mai cambiato (`null`) vede l'ordine standard del registro; «Ripristina ordine
 * standard» riporta il valore a `null`.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { NavGroup } from "@heuresys/ui";
import { applicaOrdine, spostaPrima } from "@/lib/menu-testi";

const STORAGE_SIDEBAR = "heuresys-sidebar";
const STORAGE_GROUPS = "heuresys-sidebar-groups";
function applySidebarState(collapsed: boolean) {
  const grid = document.querySelector<HTMLElement>('[data-shell="grid"]');
  if (collapsed) {
    document.body.setAttribute("data-sidebar", "collapsed");
    grid?.style.setProperty("--sidebar-w", "72px");
  } else {
    document.body.removeAttribute("data-sidebar");
    grid?.style.setProperty("--sidebar-w", "260px");
  }
}

export interface BarraLateraleProps {
  groups: ReadonlyArray<NavGroup>;
  /** L'ordine scelto dalla persona (dal server); `null` = ordine standard. */
  ordineSalvato: string[] | null;
  /** Salva il nuovo ordine; `null` = ripristina quello standard. */
  onCambiaOrdine: (ordine: string[] | null) => void;
  /** Testo del comando «Ripristina ordine standard». */
  etichettaRipristina: string;
  title: ReactNode;
  ariaLabel: string;
  toggleLabel: string;
  /** Nome accessibile della maniglia, dato il titolo del gruppo. */
  etichettaManiglia: (titolo: string) => string;
  /** Suggerimento di quello che fa la maniglia (tooltip). */
  suggerimentoManiglia: string;
  footerSlot?: ReactNode;
}

interface Trascinamento {
  id: string;
  /** Il gruppo prima del quale cadrebbe; `null` = in fondo. */
  prima: string | null;
}

export function BarraLaterale(p: BarraLateraleProps) {
  const predefinito = useMemo(() => p.groups.map((g) => g.id), [p.groups]);
  // Il valore del server, con sopra la scelta appena fatta: l'ordine cambia subito, senza aspettare
  // la risposta. Quando il server risponde (nuovo valore) la scelta locale decade.
  const [locale, setLocale] = useState<{ base: string[] | null; valore: string[] | null } | null>(null);
  const salvato = locale && locale.base === p.ordineSalvato ? locale.valore : p.ordineSalvato;
  const setSalvato = (valore: string[] | null) => setLocale({ base: p.ordineSalvato, valore });
  const ordine = useMemo(() => applicaOrdine(predefinito, salvato), [predefinito, salvato]);
  const perId = useMemo(() => new Map(p.groups.map((g) => [g.id, g])), [p.groups]);

  const [drag, setDrag] = useState<Trascinamento | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    applySidebarState(window.localStorage.getItem(STORAGE_SIDEBAR) === "collapsed");
  }, []);
  function toggleSidebar() {
    const compressa = document.body.getAttribute("data-sidebar") === "collapsed";
    applySidebarState(!compressa);
    window.localStorage.setItem(STORAGE_SIDEBAR, !compressa ? "collapsed" : "expanded");
  }

  const conferma = (d: Trascinamento) => {
    const nuovo = spostaPrima(ordine, d.id, d.prima);
    if (nuovo.join("|") === ordine.join("|")) return;
    setSalvato(nuovo);
    p.onCambiaOrdine(nuovo);
  };

  /** Dato l'ordinata del puntatore, il gruppo prima del quale cadrebbe quello trascinato. */
  function dove(id: string, y: number): string | null {
    const nav = navRef.current;
    if (!nav) return null;
    const altri = ordine.filter((x) => x !== id);
    for (const g of altri) {
      const el = nav.querySelector<HTMLElement>(`[data-group="${CSS.escape(g)}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) return g;
    }
    return null;
  }

  function inizia(id: string, e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, prima: dove(id, e.clientY) });
  }
  function muovi(e: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const nav = navRef.current;
    if (nav) {
      // Vicino ai bordi la barra scorre da sola, così si può portare un gruppo lontano.
      const r = nav.getBoundingClientRect();
      if (e.clientY < r.top + 28) nav.scrollTop -= 12;
      else if (e.clientY > r.bottom - 28) nav.scrollTop += 12;
    }
    const prima = dove(drag.id, e.clientY);
    if (prima !== drag.prima) setDrag({ id: drag.id, prima });
  }
  function finisci(e: PointerEvent<HTMLButtonElement>, annulla: boolean) {
    if (!drag) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!annulla) conferma(drag);
    setDrag(null);
  }
  function tastiera(id: string, e: KeyboardEvent<HTMLButtonElement>) {
    const i = ordine.indexOf(id);
    if (e.key === "ArrowUp" && i > 0) {
      e.preventDefault();
      conferma({ id, prima: ordine[i - 1] ?? null });
    } else if (e.key === "ArrowDown" && i < ordine.length - 1) {
      e.preventDefault();
      conferma({ id, prima: ordine[i + 2] ?? null });
    }
  }

  return (
    <aside
      aria-label={p.ariaLabel}
      className="min-h-0 overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="sidebar-section-label text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{p.title}</span>
          <button
            id="js-sidebar-toggle"
            type="button"
            aria-label={p.toggleLabel}
            onClick={toggleSidebar}
            className="inline-flex h-8 w-8 items-center justify-center rounded-control text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <svg className="sidebar-icon-collapse h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <polyline points="14 9 11 12 14 15" />
            </svg>
            <svg className="sidebar-icon-expand hidden h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <polyline points="11 9 14 12 11 15" />
            </svg>
          </button>
        </div>
        <nav ref={navRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-3" data-trascinamento={drag ? "" : undefined}>
          {ordine.map((id) => {
            const g = perId.get(id);
            if (!g) return null;
            const titolo = typeof g.label === "string" ? g.label : id;
            const linea = drag && drag.prima === id ? "prima" : undefined;
            return (
              <GruppoBarra
                key={id}
                group={g}
                titolo={titolo}
                maniglia={{
                  etichetta: p.etichettaManiglia(titolo),
                  suggerimento: p.suggerimentoManiglia,
                  onPointerDown: (e) => inizia(id, e),
                  onPointerMove: muovi,
                  onPointerUp: (e) => finisci(e, false),
                  onPointerCancel: (e) => finisci(e, true),
                  onKeyDown: (e) => tastiera(id, e),
                }}
                trascinato={drag?.id === id}
                linea={linea}
              />
            );
          })}
          {/* La linea «in fondo»: il gruppo trascinato finirebbe dopo l'ultimo. */}
          <div className="sidebar-drop-line sidebar-drop-line-fine" data-visibile={drag && drag.prima === null ? "" : undefined} aria-hidden />
        </nav>
        {salvato ? (
          <div className="nav-label shrink-0 border-t border-border px-3 py-1.5">
            <button
              type="button"
              data-testid="menu-ripristina-ordine"
              onClick={() => {
                setSalvato(null);
                p.onCambiaOrdine(null);
              }}
              className="text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
            >
              {p.etichettaRipristina}
            </button>
          </div>
        ) : null}
        {p.footerSlot}
      </div>
    </aside>
  );
}

interface Maniglia {
  etichetta: string;
  suggerimento: string;
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

function GruppoBarra({ group, titolo, maniglia, trascinato, linea }: { group: NavGroup; titolo: string; maniglia: Maniglia; trascinato: boolean; linea: "prima" | undefined }) {
  const [aperto, setAperto] = useState(group.defaultExpanded ?? true);
  useEffect(() => {
    try {
      const stato = JSON.parse(window.localStorage.getItem(STORAGE_GROUPS) || "{}") as Record<string, boolean>;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- memoria del browser, letta dopo l'idratazione
      if (stato[group.id] === false) setAperto(false);
    } catch {
      /* memoria illeggibile: aperto */
    }
  }, [group.id]);
  function cambia() {
    setAperto((prev) => {
      const next = !prev;
      try {
        const stato = JSON.parse(window.localStorage.getItem(STORAGE_GROUPS) || "{}") as Record<string, boolean>;
        stato[group.id] = next;
        window.localStorage.setItem(STORAGE_GROUPS, JSON.stringify(stato));
      } catch {
        /* idem */
      }
      return next;
    });
  }
  return (
    <div className="sidebar-group" data-group={group.id} data-trascinato={trascinato ? "" : undefined}>
      <div className="sidebar-drop-line" data-visibile={linea ? "" : undefined} aria-hidden />
      <div className="sidebar-group-testata flex items-center">
        <button
          type="button"
          data-group-toggle={group.id}
          aria-expanded={aperto}
          onClick={cambia}
          className="sidebar-group-toggle flex min-h-6 min-w-0 flex-1 items-center gap-1.5 rounded-control px-2 py-1 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
        >
          <svg data-group-chevron className="h-3 w-3 shrink-0 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span>{titolo}</span>
        </button>
        <button
          type="button"
          data-group-handle={group.id}
          aria-label={maniglia.etichetta}
          title={maniglia.suggerimento}
          onPointerDown={maniglia.onPointerDown}
          onPointerMove={maniglia.onPointerMove}
          onPointerUp={maniglia.onPointerUp}
          onPointerCancel={maniglia.onPointerCancel}
          onKeyDown={maniglia.onKeyDown}
          className="sidebar-group-handle inline-flex h-6 w-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-control text-muted-foreground transition hover:bg-accent hover:text-foreground active:cursor-grabbing"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {[7, 12, 17].flatMap((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
          </svg>
        </button>
      </div>
      <ul className="sidebar-group-content mt-0.5 space-y-0.5">{group.customContent}</ul>
    </div>
  );
}
