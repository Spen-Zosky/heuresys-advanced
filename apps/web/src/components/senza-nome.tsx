"use client";

/**
 * apps/web/src/components/senza-nome.tsx — F-3 del piano interfacce (L6, 2026-11-04).
 *
 * Quando una riga non ha un nome da mostrare (la persona, la posizione, il tenant), la
 * pagina mostrava la testa dell'identificativo («3f2a9c1e»), che nessuno sa leggere. Qui
 * si dice che il nome manca; l'identificativo resta nel suggerimento, per chi deve
 * ritrovare il record, e nel testo accessibile.
 */
import { useTranslation } from "react-i18next";

export function SenzaNome({ id }: { id?: string | null }) {
  const { t } = useTranslation("common");
  return (
    <span className="italic text-muted-foreground" title={id ?? undefined} data-testid="senza-nome">
      {t("unnamed")}
    </span>
  );
}

/** Il nome se c'è; altrimenti «senza nome», con l'identificativo nel suggerimento. */
export function NomeOppure({ nome, id }: { nome: string | null | undefined; id?: string | null }) {
  return nome ? <>{nome}</> : <SenzaNome id={id ?? null} />;
}
