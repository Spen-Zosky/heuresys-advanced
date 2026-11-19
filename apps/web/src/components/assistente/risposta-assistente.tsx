"use client";

/**
 * apps/web/src/components/assistente/risposta-assistente.tsx — la risposta dell'assistente formattata
 * (richiesta di Enzo del 2026-11-18): Markdown con tabelle, elenchi, codice e diagrammi, e per ogni
 * tabella, blocco di testo o diagramma il pulsante «Apri» che lo mostra nell'ispettore, grande e
 * ridimensionabile.
 *
 * Compone `MarkdownView` e `MermaidDiagram` di @heuresys/ui (il diagramma dal sotto-percorso `/markdown`, caricato
 * solo nel browser: porta mermaid e katex, che non servono al resto della pagina).
 */
import dynamic from "next/dynamic";
import { isValidElement, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Expand } from "lucide-react";
import { MarkdownView } from "@heuresys/ui";
import type { ContenutoIspezionabile } from "./ispettore-assistente";

const MermaidDiagram = dynamic(() => import("@heuresys/ui/markdown").then((m) => ({ default: m.MermaidDiagram })), {
  ssr: false,
  loading: () => null,
});

type Apri = (c: ContenutoIspezionabile) => void;

export function RispostaAssistente({ testo, onApri }: { testo: string; onApri: Apri }) {
  return (
    <MarkdownView
      content={testo}
      className="prose-sm max-w-none break-words prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-table:my-0 prose-pre:my-0"
      components={{
        // `node` (l'albero di react-markdown) non va sul DOM: si toglie e si passano solo gli attributi.
        table: (p: { node?: unknown } & React.TableHTMLAttributes<HTMLTableElement>) => {
          const { node, ...props } = p;
          void node;
          return <TabellaRisposta onApri={onApri} {...props} />;
        },
        pre: ({ children }: { children?: ReactNode }) => <BloccoRisposta onApri={onApri}>{children}</BloccoRisposta>,
      }}
    />
  );
}

function PulsanteBarra({ onClick, etichetta, testId, children }: { onClick: () => void; etichetta: string; testId: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <span>{etichetta}</span>
    </button>
  );
}

function TabellaRisposta({ onApri, ...props }: { onApri: Apri } & React.TableHTMLAttributes<HTMLTableElement>) {
  const { t } = useTranslation("common");
  const ref = useRef<HTMLTableElement>(null);
  const righe = () =>
    Array.from(ref.current?.querySelectorAll("tr") ?? []).map((tr) =>
      Array.from(tr.querySelectorAll("th,td")).map((c) => (c.textContent ?? "").trim()),
    );
  return (
    <figure className="not-prose my-3 overflow-hidden rounded-lg border border-border" data-testid="agente-risposta-tabella">
      <div className="flex items-center justify-end border-b border-border bg-muted/40 px-1">
        <PulsanteBarra onClick={() => onApri({ tipo: "tabella", righe: righe() })} etichetta={t("agente.apriContenuto")} testId="agente-apri-tabella">
          <Expand className="h-3.5 w-3.5" aria-hidden />
        </PulsanteBarra>
      </div>
      <div className="max-h-80 overflow-auto">
        <table
          ref={ref}
          {...props}
          className="w-full border-collapse text-xs [&_td]:border-b [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:sticky [&_th]:top-0 [&_th]:border-b [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold"
        />
      </div>
    </figure>
  );
}

/** Il testo e la lingua di un blocco di codice dal suo figlio `<code class="language-x">`. */
function codiceDi(children: ReactNode): { testo: string; lingua: string | null } {
  const figlio = Array.isArray(children) ? children[0] : children;
  if (!isValidElement(figlio)) return { testo: String(children ?? ""), lingua: null };
  const p = figlio.props as { className?: string; children?: ReactNode };
  const lingua = /language-([\w-]+)/.exec(p.className ?? "")?.[1] ?? null;
  const testo = Array.isArray(p.children) ? p.children.join("") : String(p.children ?? "");
  return { testo: testo.replace(/\n$/, ""), lingua };
}

function BloccoRisposta({ onApri, children }: { onApri: Apri; children: ReactNode }) {
  const { t } = useTranslation("common");
  const [copiato, setCopiato] = useState(false);
  const { testo, lingua } = codiceDi(children);

  if (lingua === "mermaid") {
    return (
      <figure className="not-prose my-3 overflow-hidden rounded-lg border border-border" data-testid="agente-risposta-diagramma">
        <div className="flex items-center justify-end border-b border-border bg-muted/40 px-1">
          <PulsanteBarra
            onClick={() => onApri({ tipo: "diagramma", nodo: <MermaidDiagram source={testo} ariaLabel={t("agente.ispettoreDiagramma")} /> })}
            etichetta={t("agente.apriContenuto")}
            testId="agente-apri-diagramma"
          >
            <Expand className="h-3.5 w-3.5" aria-hidden />
          </PulsanteBarra>
        </div>
        {/* Nella risposta il diagramma sta in un riquadro basso, intero; grande si apre con «Apri». */}
        <div className="flex max-h-72 justify-center overflow-hidden p-2 [&_img]:max-h-64 [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain">
          <MermaidDiagram source={testo} ariaLabel={t("agente.ispettoreDiagramma")} />
        </div>
      </figure>
    );
  }

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(testo);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 1500);
    } catch {
      /* appunti negati: il testo resta selezionabile */
    }
  };
  return (
    <figure className="not-prose my-3 overflow-hidden rounded-lg border border-border" data-testid="agente-risposta-blocco">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 pl-3 pr-1">
        <span className="text-xs text-muted-foreground">{lingua ?? t("agente.testo")}</span>
        <div className="flex items-center">
          <PulsanteBarra onClick={() => void copia()} etichetta={copiato ? t("agente.copiato") : t("agente.copia")} testId="agente-copia-blocco">
            {copiato ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          </PulsanteBarra>
          <PulsanteBarra onClick={() => onApri({ tipo: "testo", testo, lingua })} etichetta={t("agente.apriContenuto")} testId="agente-apri-blocco">
            <Expand className="h-3.5 w-3.5" aria-hidden />
          </PulsanteBarra>
        </div>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed">{testo}</pre>
    </figure>
  );
}
