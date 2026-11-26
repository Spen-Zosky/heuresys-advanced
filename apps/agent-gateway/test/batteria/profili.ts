/**
 * Chi pone le domande: identità di RTL Bank (tenant dimostrativo), scelte per ruolo. La password e
 * il secondo fattore si derivano come negli script `live-*.ts`; qui c'è solo l'indirizzo.
 */
export interface Profilo {
  email: string;
  /** Come si descrive nel campione. */
  chi: string;
}

export const PROFILI: Record<string, Profilo> = {
  "hr": { email: "valentina.conti@rtl-bank.org", chi: "Conti, Valentina (Direttore Risorse Umane)" },
  "capo-retail": { email: "sergio.caputo@rtl-bank.org", chi: "Caputo, Sergio (Divisione Retail Banking)" },
  "capo-crediti": { email: "paolo.caputo@rtl-bank.org", chi: "Caputo, Paolo (Divisione Crediti)" },
  "capo-operations": { email: "luca.bianchi@rtl-bank.org", chi: "Bianchi, Luca (Divisione Operations)" },
  "capo-it": { email: "quintino.bellini@rtl-bank.org", chi: "Bellini, Quintino (Divisione IT & Digital)" },
  "capo-finanza": { email: "federica.derosa@rtl-bank.org", chi: "De Rosa, Federica (Divisione Finanza e Amministrazione)" },
  "responsabile-rischi": { email: "alice.esposito@rtl-bank.org", chi: "Esposito, Alice (Direzione Gestione dei Rischi, senza mandato sui talenti)" },
  "dipendente": { email: "diego.fontana@rtl-bank.org", chi: "Fontana, Diego (dipendente)" },
};
