"use client";

/**
 * apps/web/src/components/menu-laterale.tsx — il contenuto della barra laterale (classe C6 del
 * piano docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Perché non le voci di `DashboardSidebar`: quel componente rende ogni voce con `<a href>`, e
 * ogni clic ricaricava l'intera applicazione. La barra tornava in cima, il menu si ricostruiva
 * da capo e la pagina ripartiva dal caricamento (Enzo, 2026-11-11: «sidebar che non mantiene il
 * posizionamento e che ad ogni caricamento pagina torna in alto»). Qui le voci sono `Link` di
 * Next: si cambia pagina senza ricaricare, la barra resta dov'era. In più la posizione si salva
 * nella sessione del browser, così regge anche un ricaricamento vero, e la voce attiva si porta
 * in vista se è fuori dallo schermo.
 *
 * I rami (secondo e terzo livello) vengono da `lib/menu-albero.ts`; si aprono e si chiudono con
 * un clic, ricordano lo stato, e il ramo che contiene la pagina attiva è sempre aperto.
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Ramo, VoceMenu } from "@/lib/menu-albero";

const CHIAVE_RAMI = "hrx-menu-rami";
const CHIAVE_SCORRIMENTO = "hrx-menu-scorrimento";

function leggiRami(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(CHIAVE_RAMI) || "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function contiene(r: Ramo, attiva: string | null): boolean {
  return r.voci.some((v) => v.href === attiva) || r.rami.some((x) => contiene(x, attiva));
}

function Voce({ v, attiva, icona, livello }: { v: VoceMenu; attiva: boolean; icona: ReactNode; livello: number }) {
  return (
    <li>
      <Link
        href={v.href}
        prefetch={false}
        aria-current={attiva ? "page" : undefined}
        data-menu-attiva={attiva ? "" : undefined}
        className={`nav-link flex items-center gap-2 rounded-control py-1.5 pr-2 text-sm transition ${
          attiva ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        style={{ paddingLeft: `${0.5 + livello * 0.75}rem`, ...(attiva ? { boxShadow: "inset 2px 0 0 var(--primary)" } : {}) }}
      >
        <span className="shrink-0">{icona}</span>
        <span className="nav-label truncate">{v.testId ? <span data-testid={v.testId}>{v.label}</span> : v.label}</span>
      </Link>
    </li>
  );
}

function RamoMenu({
  ramo, idPadre, attiva, icone, livello,
}: { ramo: Ramo; idPadre: string; attiva: string | null; icone: (v: VoceMenu) => ReactNode; livello: number }) {
  const { t } = useTranslation();
  const id = `${idPadre}/${ramo.chiave}`;
  const dentro = contiene(ramo, attiva);
  // la barra si rende solo nel browser, dopo l'accesso: la memoria si legge al primo render
  const [aperto, setAperto] = useState(() => typeof window === "undefined" || leggiRami()[id] !== false);
  const cambia = () => {
    const nuovo = !aperto;
    setAperto(nuovo);
    try {
      const s = leggiRami();
      s[id] = nuovo;
      window.localStorage.setItem(CHIAVE_RAMI, JSON.stringify(s));
    } catch {
      /* il browser può negare la memoria: si resta col comportamento predefinito */
    }
  };
  const visibile = aperto || dentro;
  return (
    <li>
      <button
        type="button"
        aria-expanded={visibile}
        onClick={cambia}
        className="flex w-full items-center gap-1.5 rounded-control py-1.5 pr-2 text-left text-xs font-medium text-muted-foreground transition hover:text-foreground"
        style={{ paddingLeft: `${0.5 + livello * 0.75}rem` }}
      >
        <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${visibile ? "rotate-90" : ""}`} aria-hidden />
        <span className="truncate">{t(`shell:nav.rami.${ramo.chiave}`, { defaultValue: ramo.chiave })}</span>
      </button>
      {visibile ? <ContenutoRamo ramo={ramo} idPadre={id} attiva={attiva} icone={icone} livello={livello + 1} /> : null}
    </li>
  );
}

function ContenutoRamo({
  ramo, idPadre, attiva, icone, livello,
}: { ramo: Ramo; idPadre: string; attiva: string | null; icone: (v: VoceMenu) => ReactNode; livello: number }) {
  return (
    <ul className="space-y-0.5">
      {ramo.voci.map((v) => (
        <Voce key={v.id} v={v} attiva={v.href === attiva} icona={icone(v)} livello={livello} />
      ))}
      {ramo.rami.map((r) => (
        <RamoMenu key={r.chiave} ramo={r} idPadre={idPadre} attiva={attiva} icone={icone} livello={livello} />
      ))}
    </ul>
  );
}

/** Il corpo di un gruppo della barra laterale, da passare a `NavGroup.customContent`. */
export function CorpoGruppo(props: { id: string; albero: Ramo; attiva: string | null; icone: (v: VoceMenu) => ReactNode }) {
  return (
    <li className="list-none">
      <ContenutoRamo ramo={props.albero} idPadre={props.id} attiva={props.attiva} icone={props.icone} livello={0} />
    </li>
  );
}

/**
 * Tiene la posizione di scorrimento della barra: la salva mentre si scorre, la rimette dopo un
 * ricaricamento, e porta in vista la voce attiva se non si vede.
 */
export function useScorrimentoMenu(attiva: string | null) {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>("aside nav");
    if (!nav) return;
    try {
      const salvato = Number(window.sessionStorage.getItem(CHIAVE_SCORRIMENTO));
      if (Number.isFinite(salvato) && salvato > 0 && nav.scrollTop === 0) nav.scrollTop = salvato;
    } catch {
      /* niente memoria: si parte dall'alto */
    }
    const salva = () => {
      try {
        window.sessionStorage.setItem(CHIAVE_SCORRIMENTO, String(nav.scrollTop));
      } catch {
        /* idem */
      }
    };
    nav.addEventListener("scroll", salva, { passive: true });
    return () => nav.removeEventListener("scroll", salva);
  }, []);
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>("aside nav");
    const voce = nav?.querySelector<HTMLElement>("[data-menu-attiva]");
    if (!nav || !voce) return;
    const n = nav.getBoundingClientRect();
    const v = voce.getBoundingClientRect();
    if (v.top < n.top || v.bottom > n.bottom) voce.scrollIntoView({ block: "center" });
  }, [attiva]);
}
