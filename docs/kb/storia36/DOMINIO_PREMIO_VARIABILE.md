# storia36 C3 — Dominio: premio variabile e compensation nel credito italiano

> Esito della ricerca Step 3.1 del piano (`docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md`,
> Task C3), eseguita 2026-07-28. Ogni parametro usato dal seed C3 DEVE citare una
> riga di questo documento; ciò che non è sorgentato qui non entra nel seed.

## 1. VAP / Premio aziendale (CCNL Credito, art. 51)

- Il **premio aziendale (VAP)** è il premio annuale legato ai risultati della
  banca; l'importo varia da poche centinaia a diverse migliaia di euro secondo
  banca e risultati ([ccnlbancari.it — art. 51](https://www.ccnlbancari.it/art-51-premio-aziendale/),
  [ccnlbancari.it](https://www.ccnlbancari.it/)).
- **Indicatori tipici** usati per il premio: redditività (ROE, ROA, risultato
  lordo di gestione corretto per il rischio), efficienza (costi operativi /
  margine di intermediazione, costo del lavoro / margine), produttività (valore
  aggiunto per dipendente, margine di intermediazione per dipendente, raccolta+
  impieghi per dipendente) ([businessonline.it](https://www.businessonline.it/articoli/premi-produttivita-contratto-bancario-importi-limiti-e-regole.html)).
- **Gate d'accesso**: se l'attività ordinaria chiude in PERDITA, nessun premio
  viene erogato, a prescindere dalle performance individuali (stessa fonte).
- **Importi di riferimento** (3ª area professionale): tipicamente **1.500-6.000 €**
  annui, differenziati per inquadramento ([businessonline.it](https://www.businessonline.it/articoli/premi-produttivita-contratto-bancario-importi-limiti-e-regole.html)).
- L'importo NON è uniforme: cresce con l'inquadramento (stessa fonte).
- Prassi di **erogazione a giugno dell'anno successivo** all'esercizio di
  riferimento (consuetudine di settore; l'art. 51 lascia la definizione alla
  contrattazione aziendale — [ccnlbancari.it art. 51](https://www.ccnlbancari.it/art-51-premio-aziendale/)).

## 2. Sistema incentivante MBO (ruoli commerciali)

- **Cap del singolo premio: ≤ 30% della RAL** del dipendente; i premi concorrono
  all'incidenza complessiva del variabile sul fisso
  ([Politiche di Incentivazione ViViBanca 2024, §limiti](https://vivibanca.it/public/assemblea_2024/ORG-PLGN000045-IT%20Politiche%20di%20Incentivazione%202024_v.7.0.pdf)).
- **Platea**: fino a ~50% dei potenziali destinatari percepisce l'incentivo in
  un esercizio ([FABI su MBO Gruppo BPER](https://fabigruppobper.it/sistema-disincentivante-2023-mbo-e-disincentivo-di-performance/)).
- **Pesi tipici di una scheda commerciale**: risultato commerciale ~40%, nuovi
  clienti ~25%, soddisfazione cliente ~20%, obiettivo aziendale ~15%
  ([Randstad — MBO](https://www.randstad.it/gestione-risorse-umane/gestione-del-personale/mbo-significato-vantaggi/)).
- **Gate di conformità**: per il personale rilevante gli incentivi sono
  riconosciuti in base alla performance dell'istituto **al netto dei rischi** e
  dei risultati effettivi complessivi (ViViBanca, §principi).

## 3. Vincoli di vigilanza (Banca d'Italia / EBA)

- Le disposizioni della Banca d'Italia (Circolare 285/2013, 25° aggiornamento)
  recepiscono **CRD V** e gli orientamenti **EBA 2021** su politiche di
  remunerazione ([dirittobancario.it](https://dirittobancario.it/approfondimenti/corporate-governance/il-25-aggiornamento-delle-disposizioni-di-vigilanza-di-banca-d-italia),
  [FCHub](https://fchub.it/le-nuove-disposizioni-sulle-remunerazioni-nelle-banche/)).
- **Risk takers**: elenco (non esaustivo) del personale più rilevante; per loro
  il variabile è calibrato al rischio assunto.
- **Rapporto variabile/fisso**: le banche con rapporto **> 100%** per il
  personale chiave devono trasmettere informativa individuale a Banca d'Italia
  ([tidona.com](https://www.tidona.com/la-banca-ditalia-si-conforma-agli-orientamenti-delleba-in-materia-di-politiche-di-remunerazione-di-banche-e-imprese-di-investimento/)) —
  per una banca media come RTL la prassi è restare largamente sotto il 100%.
- **Malus e claw-back**: meccanismi obbligatori rafforzati sul variabile
  (stesse fonti).

## 4. Parametri che il seed C3 può derivare da qui

| Parametro | Valore da fonte | Riga fonte |
|---|---|---|
| Gate VAP | utile ordinario > 0, altrimenti zero premi | §1 gate |
| Indicatori gate/curva | cost/income, ROE, margine per dipendente | §1 indicatori |
| VAP 3ª area | 1.500-6.000 € per inquadramento crescente | §1 importi |
| Erogazione | giugno N+1 per esercizio N | §1 erogazione |
| Cap MBO | ≤ 30% RAL individuale | §2 cap |
| Platea MBO | ~50% dei destinatari con payout > 0 | §2 platea |
| Pesi scheda commerciale | 40/25/20/15 | §2 pesi |
| Variabile/fisso | << 100% (banca media, no notifica BdI) | §3 rapporto |
| Malus/claw-back | previsti sui risk takers | §3 |

Aperture da chiudere in C3 con le shape reali dei moduli (`sys_reward_gates`,
`sys_payout_curves`, `sys_reward_gate_results`, `sys_payroll_handoff_records`):
la curva soglia/target/cap (es. 80%/100%/150%) citata dal piano va ancorata a
una fonte o dichiarata convenzione aziendale RTL nel seed.

## 5. Rinnovo CCNL Credito 23/11/2023 (adeguamenti retributivi)

- Aumento medio a regime **435 EUR mensili** (figura media 3A4L) in tranches:
  **+250 dal 1/12/2023, +100 dal 1/9/2024, +50 dal 1/6/2025, +35 dal 1/3/2026**
  (rinnovo 2023; il rinnovo successivo da 518 EUR e' del 2026 —
  [pmi.it](https://www.pmi.it/professioni/regole-e-compensi/425869/contratto-bancari-aumento-di-stipendio.html),
  [ccnlbancari.it](https://www.ccnlbancari.it/)). Scala per parametro di livello
  (floor livello / floor 3A4L); i Dirigenti sono su CCNL separato (RAL flat).

## 6. Convenzioni RTL dichiarate (scelte aziendali del seed, non sorgentabili)

| Convenzione | Valore | Perche' |
|---|---|---|
| Curva MBO_STANDARD | CAPPED {soglia 0,8 - payout min 0,5 - target 1,0 - cap 1,5} | modella la curva payout tipica (§2); nessuna fonte pubblica con la curva esatta |
| Target % per livello | Dirigente 15% - QD/Quadro 12% - 3A4L 8% - 3A3L 7% - altri 5% | coerente col cap 30% (§2) e con gli importi legacy FY2024 |
| Attainment | rating C2 / 3,45 (media MID = 1,0) | aggancia il variabile alla storia di performance |
| Attrito platea | -5%/anno via hash + uscite CAUSALI da gate BLOCKED | persistenza dei percettori FY2024 (68 utenti su 121 righe legacy) |
| Cap 30% | PER SINGOLO premio (§2 "singolarmente"); aggregato per esercizio <= 100% RAL (§3) | multi-premio legacy (annual+Q4+semestrale) legittimo |
| Range 1.500-6.000 (§1) | riferimento del VAP; l'MBO dei livelli alti puo' superarlo (code ~7,6k su 3A4L) | il "tipicamente" della fonte tollera code |
