"use client";

/**
 * apps/web/src/components/dichiarazione-equita.tsx — la dichiarazione del controllo di equità
 * (E12, ADR-0063, voce F6b) che accompagna ogni proposta sulle persone.
 *
 * Dice, in chiaro: se la proposta ha superato il controllo, quali tratti protetti sono stati
 * guardati, quali gruppi sono stati confrontati, il rapporto misurato contro la soglia, che
 * nessun tratto protetto entra nel calcolo e quali ingressi gli sono vicini. Sotto soglia la
 * proposta si annuncia come non raccomandabile. Compone primitive di @heuresys/ui; è specifico
 * di advanced perché legge il contratto `EquitaDichiarazione` di @heuresys/shared.
 */
import { useTranslation } from "react-i18next";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { EquitaDichiarazione, EquitaEsito, EquitaGruppo, EquitaTratto } from "@heuresys/shared";
import { useFormat } from "@/lib/format";

const ESITO_BADGE: Record<EquitaEsito, "success" | "destructive" | "secondary"> = {
  SUPERATO: "success",
  NON_SUPERATO: "destructive",
  DATI_INSUFFICIENTI: "secondary",
};

export function DichiarazioneEquita({ equita }: { equita: EquitaDichiarazione }) {
  const { t } = useTranslation("common");
  const fmt = useFormat();

  const nomeGruppo = (tratto: EquitaTratto, g: string): string => {
    if (g === "NON_DICHIARATO" || g === "GRUPPI_PICCOLI") return t(`equita.gruppoSpeciale.${g}`);
    if (tratto === "NAZIONALITA") return fmt.paese(g);
    return t(`equita.gruppo.${tratto}.${g}`, { defaultValue: g });
  };
  const descriviGruppo = (tratto: EquitaTratto, g: EquitaGruppo): string =>
    g.confrontato && g.quota !== null
      ? t("equita.gruppoConQuota", { gruppo: nomeGruppo(tratto, g.gruppo), favorevoli: fmt.numero(g.favorevoli), persone: fmt.numero(g.persone), quota: fmt.percento(g.quota, "0-1") })
      : t("equita.gruppoSenzaQuota", { gruppo: nomeGruppo(tratto, g.gruppo), persone: fmt.numero(g.persone) });

  return (
    <Card data-testid="equita-dichiarazione" data-esito={equita.esito} data-raccomandabile={String(equita.raccomandabile)}>
      <CardHeader>
        <CardTitle as="h2" className="flex flex-wrap items-center gap-3">
          {t("equita.titolo")}
          <Badge data-testid="equita-esito" variant={ESITO_BADGE[equita.esito]}>{t(`equita.esito.${equita.esito}`)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p data-testid="equita-sintesi" className={equita.raccomandabile ? "text-foreground" : "font-semibold text-danger"} role={equita.raccomandabile ? undefined : "alert"}>
          {equita.raccomandabile ? t(`equita.sintesi.${equita.esito}`) : t("equita.nonRaccomandabile")}
        </p>
        <p className="text-muted-foreground">
          {t("equita.metodo", {
            favorevole: t(`equita.favorevole.${equita.esitoFavorevole}`, { defaultValue: equita.esitoFavorevole }),
            persone: fmt.numero(equita.persone),
            soglia: fmt.numeroFisso(equita.soglia, 2),
            minimo: fmt.numero(equita.minimoGruppo),
          })}
        </p>
        <table className="w-full text-left" data-testid="equita-tratti">
          <caption className="sr-only">{t("equita.titolo")}</caption>
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">{t("equita.colTratto")}</th>
              <th scope="col" className="py-1 pr-3 font-medium">{t("equita.colGruppi")}</th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">{t("equita.colRapporto")}</th>
              <th scope="col" className="py-1 font-medium">{t("equita.colEsito")}</th>
            </tr>
          </thead>
          <tbody>
            {equita.tratti.map((c) => (
              <tr key={c.tratto} data-testid="equita-tratto" data-tratto={c.tratto} className="border-t border-border align-top">
                <td className="py-1.5 pr-3 font-medium text-foreground">{t(`equita.tratto.${c.tratto}`)}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">
                  {c.gruppi.length === 0 ? t("equita.nessunGruppo") : c.gruppi.map((g) => descriviGruppo(c.tratto, g)).join(" · ")}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono">{c.rapporto === null ? t("equita.nonMisurato") : fmt.numeroFisso(c.rapporto, 2)}</td>
                <td className="py-1.5">
                  <Badge variant={ESITO_BADGE[c.esito]}>{t(`equita.esito.${c.esito}`)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p data-testid="equita-ingressi" className="text-muted-foreground">
          {equita.ingressiProtetti.length === 0
            ? t("equita.ingressiPuliti")
            : t("equita.ingressiProtetti", { ingressi: equita.ingressiProtetti.join(", ") })}
          {equita.ingressiVicini.length > 0 && (
            <> {t("equita.ingressiVicini", {
              elenco: equita.ingressiVicini.map((v) => t("equita.vicino", { ingresso: t(`equita.ingresso.${v.ingresso}`, { defaultValue: v.ingresso }), tratto: t(`equita.tratto.${v.tratto}`) })).join(", "),
            })}</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
