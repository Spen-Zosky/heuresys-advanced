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
 * un clic e ricordano lo stato; il ramo che contiene la pagina attiva si apre da sé quando si arriva
 * sulla pagina, e dopo si chiude come gli altri (`lib/menu-aperture.ts`).
 */
import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Ramo, VoceMenu } from "@/lib/menu-albero";
import { apriVersoPagina, catenaVersoPagina, CHIAVE_RAMI, eAperto, iscrivi, istantanea, leggiMemoria, scrivi } from "@/lib/menu-aperture";

const CHIAVE_SCORRIMENTO = "hrx-menu-scorrimento";

/* Lo stato dei rami vive nella memoria del browser (`lib/menu-aperture.ts`); il server non la
   conosce e rende tutto aperto. `useSyncExternalStore` con un'istantanea del server diversa da
   quella del client è il modo che React prevede per non creare una discordanza d'idratazione
   (errore #418). */
const memoriaRami = () => istantanea(CHIAVE_RAMI);

function Voce({ v, attiva, icona, livello }: { v: VoceMenu; attiva: boolean; icona: ReactNode; livello: number }) {
  return (
    <li>
      <Link
        href={v.href}
        prefetch={false}
        aria-current={attiva ? "page" : undefined}
        // Con la barra ridotta alle sole icone l'etichetta visibile sparisce: il nome accessibile e
        // il suggerimento restano (axe: link-name; E-SENZA-NOME del giro del 15/11).
        aria-label={v.label}
        title={v.label}
        data-menu-attiva={attiva ? "" : undefined}
        className={`nav-link flex items-center gap-2 rounded-control py-1.5 pr-2 text-sm transition ${
          attiva ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        style={{ paddingLeft: `${0.5 + livello * 0.75}rem`, ...(attiva ? { boxShadow: "inset 2px 0 0 var(--primary)" } : {}) }}
      >
        <span className="shrink-0">{icona}</span>
        {/* Forense 15/11 (Enzo): nessuna voce si tronca: «Consolidamento con il pro…» non si
            riconosceva. L'etichetta va a capo; il suggerimento resta per la barra a sole icone. */}
        <span className="nav-label min-w-0 whitespace-normal break-words leading-snug">{v.testId ? <span data-testid={v.testId}>{v.label}</span> : v.label}</span>
      </Link>
    </li>
  );
}

function RamoMenu({
  ramo, idPadre, attiva, icone, livello,
}: { ramo: Ramo; idPadre: string; attiva: string | null; icone: (v: VoceMenu) => ReactNode; livello: number }) {
  const { t } = useTranslation();
  const id = `${idPadre}/${ramo.chiave}`;
  const memoria = useSyncExternalStore(iscrivi, memoriaRami, () => "{}");
  // Il ramo della pagina attiva si apre da sé solo quando si arriva sulla pagina (CorpoGruppo);
  // poi decide la persona: prima era aperto per forza e il clic non cambiava niente (28/11).
  const visibile = eAperto(leggiMemoria(memoria), id);
  const cambia = useCallback(() => {
    scrivi(CHIAVE_RAMI, (m) => ({ ...m, [id]: !eAperto(m, id) }));
  }, [id]);
  const titolo = t(`shell:nav.rami.${ramo.chiave}`, { defaultValue: ramo.chiave });
  return (
    <li>
      <button
        type="button"
        aria-expanded={visibile}
        onClick={cambia}
        // `nav-link`: con la barra ridotta alle sole icone il pulsante si centra e l'etichetta
        // (`nav-label`) sparisce, invece di andare a capo lettera per lettera («Str utt ura»).
        title={titolo}
        className="nav-link flex w-full items-center gap-1.5 rounded-control py-1.5 pr-2 text-left text-xs font-medium text-muted-foreground transition hover:text-foreground"
        style={{ paddingLeft: `${0.5 + livello * 0.75}rem` }}
      >
        <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${visibile ? "rotate-90" : ""}`} aria-hidden />
        <span className="nav-label min-w-0 whitespace-normal break-words leading-snug">{titolo}</span>
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
  const { id, albero, attiva } = props;
  useEffect(() => {
    const catena = catenaVersoPagina(albero, id, attiva);
    if (catena && attiva) apriVersoPagina(id, catena, attiva);
  }, [albero, id, attiva]);
  return (
    <li className="list-none">
      <ContenutoRamo ramo={albero} idPadre={id} attiva={attiva} icone={props.icone} livello={0} />
    </li>
  );
}

/**
 * Tiene la posizione di scorrimento della barra: la salva mentre si scorre, la rimette dopo un
 * ricaricamento, e porta in vista la voce attiva se non si vede.
 */
export function useScorrimentoMenu(attiva: string | null, pronto = true) {
  // La barra esiste solo quando la sessione e il registro sono caricati: prima il layout mostra
  // «Caricamento». Per questo l'ascolto dipende da `pronto`: con una dipendenza vuota l'effetto
  // girava sul layout di attesa, non trovava la barra e non si agganciava più (C6, giro 11/11).
  useEffect(() => {
    if (!pronto) return;
    const nav = document.querySelector<HTMLElement>("aside nav");
    if (!nav) return;
    const salva = () => {
      try {
        window.sessionStorage.setItem(CHIAVE_SCORRIMENTO, String(nav.scrollTop));
      } catch {
        /* niente memoria: si parte dall'alto */
      }
    };
    nav.addEventListener("scroll", salva, { passive: true });
    return () => nav.removeEventListener("scroll", salva);
  }, [pronto]);
  useEffect(() => {
    if (!pronto) return;
    const nav = document.querySelector<HTMLElement>("aside nav");
    if (!nav) return;
    // A ogni cambio di pagina si rimette la barra dove l'aveva lasciata la persona: se nel
    // frattempo è stata ricreata, ripartirebbe dall'alto.
    try {
      const salvato = Number(window.sessionStorage.getItem(CHIAVE_SCORRIMENTO));
      if (Number.isFinite(salvato) && salvato > 0 && Math.abs(nav.scrollTop - salvato) > 1) nav.scrollTop = salvato;
    } catch {
      /* idem */
    }
    const voce = nav.querySelector<HTMLElement>("[data-menu-attiva]");
    if (!voce) return;
    const n = nav.getBoundingClientRect();
    const v = voce.getBoundingClientRect();
    if (v.top < n.top || v.bottom > n.bottom) voce.scrollIntoView({ block: "nearest" });
  }, [attiva, pronto]);
}
