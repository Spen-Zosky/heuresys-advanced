"use client";

/**
 * La guida del Backstage, che si apre dall'icona (i) accanto al titolo (Enzo, 28/11/2026): a che
 * cosa serve e come si usa, in Markdown, con due infografiche mermaid. Il testo sta nella lingua
 * della pagina (`guida-testi.ts`); i diagrammi si disegnano nel browser con `MermaidDiagram` di
 * @heuresys/ui (sotto-percorso `/markdown`, caricato solo qui), dentro una modale ampia e
 * ridimensionabile.
 */
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { BookOpen, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, MarkdownView } from "@heuresys/ui";
import { MODALE } from "@/lib/modale";
import { GUIDA_BACKSTAGE } from "./guida-testi";

const MermaidDiagram = dynamic(() => import("@heuresys/ui/markdown").then((m) => ({ default: m.MermaidDiagram })), {
  ssr: false,
  loading: () => null,
});

const PROSA = "prose prose-sm max-w-none dark:prose-invert prose-headings:mb-2 prose-headings:mt-5 prose-p:my-2 prose-li:my-0.5 prose-table:my-2";

export function GuidaBackstage({ aperta, onChiudi }: { aperta: boolean; onChiudi: () => void }) {
  const { t, i18n } = useTranslation("admin");
  const g = i18n.language?.startsWith("en") ? GUIDA_BACKSTAGE.en : GUIDA_BACKSTAGE.it;
  return (
    <Dialog open={aperta} onOpenChange={(o) => { if (!o) onChiudi(); }}>
      {aperta ? (
        <DialogContent className={MODALE.grande} showCloseButton={false} data-testid="backstage-guida">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary"><BookOpen className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight">{t("backstage.guida.titolo")}</DialogTitle>
              <DialogDescription className="text-xs">{t("backstage.guida.sottotitolo")}</DialogDescription>
            </div>
            <button
              type="button"
              onClick={onChiudi}
              aria-label={t("backstage.guida.chiudi")}
              data-testid="backstage-guida-chiudi"
              className="ml-auto inline-flex items-center rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <article className="mt-3" data-testid="backstage-guida-testo">
            {g.parti.map((p, i) =>
              p.tipo === "md" ? (
                <MarkdownView key={i} content={p.testo} className={PROSA} />
              ) : (
                <figure key={i} className="my-4 rounded-lg border border-border bg-background p-3" data-testid="backstage-guida-diagramma">
                  <div className="flex justify-center overflow-x-auto [&_img]:h-auto [&_img]:max-w-full">
                    <MermaidDiagram source={p.testo} ariaLabel={p.didascalia} />
                  </div>
                  <figcaption className="mt-2 text-center text-xs text-muted-foreground">{p.didascalia}</figcaption>
                </figure>
              ),
            )}
          </article>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
