# Piano — organigrammi navigabili, vertice al Direttore Generale, rete organizzativa corretta (15/11/2026)

Mandato di Enzo del 15/11/2026 (thread «Correggere navigazione e dati degli organigrammi»), con quattro schermate: in tutte le viste organigramma fit all'apertura, zoom con rotella e tasti + e −, doppio clic sul vuoto = ritorno al fit, pan con il trascinamento a clic sinistro, doppio clic su un oggetto apre la modale, modali che scorrono e si ridimensionano; al vertice il CEO/Direttore Generale e la società solo come etichetta; la vista a nodi con la stessa struttura dell'organigramma (divisioni al primo posto, tutti i collegamenti); la pagina «Rete organizzativa» con numeri verificati sul database e grafici spiegati in italiano. Delega completa fino al rilascio. Segue il piano `PIANO_organigrammi-a-blocchi_20261114.md`.

## Misure di partenza (15/11/2026, database di produzione in sola lettura, `BEGIN READ ONLY`)

Struttura di RTL: l'unità «RTL Bank S.p.A.» (tipo HEADQUARTERS, senza padre) contiene la posizione «Direttore Generale» (Marchetti) e, come figlie, le cinque direzioni di staff (Affari Legali e Societari, Antiriciclaggio, Compliance e Protezione Dati, Gestione dei Rischi, Internal Audit) e l'unità «Direzione Generale» (tipo GENERAL_MANAGEMENT), che non ha posizioni e contiene le sette divisioni. Per questo le viste mostravano «RTL Bank S.p.A.» come casella al vertice e, nella vista a nodi, le direzioni di staff al primo livello con le divisioni nascoste sotto un solo ramo chiuso.

Rete organizzativa: la query di `apps/api/src/modules/analytics/repository.ts` (`getOrgNetwork`) non filtrava `position_is_active`. RTL ha 162 posizioni attive e 154 disattivate: la pagina ne mostrava 316, i livelli 1/16/71/174/54, 16 riporti diretti del Direttore Generale e un raggio di 315, con «Analista Rischio» fra i responsabili con 6-7 riporti (tutti da posizioni disattivate). Sulle sole attive: 162 posizioni, 1 vertice (Direttore Generale), 57 responsabili, media 2,82 riporti diretti, livelli 1/12/37/64/48, 4 posizioni scoperte, nessuna posizione attiva che riporta a una disattivata.

Classe del difetto «posizioni disattivate contate»: le altre query che aggregano su `sys_positions` passano dagli incarichi attivi o dai profili retributivi; misurati 0 incarichi attivi e 0 profili su posizioni disattivate, quindi oggi la classe tocca solo la rete organizzativa.

## Voci

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| N1 | Componente `AreaNavigabile` (`apps/web/src/components/organigramma/area-navigabile.tsx`): fit all'apertura e al ridimensionamento finché non si tocca, rotella e tasti + − 0 con il mouse nell'area, doppio clic sul vuoto = fit, trascinamento = pan (il clic dopo un trascinamento non apre niente), pulsanti − % + e «Adatta» | Claude | prova unitaria della matematica del fit e dello zoom; prova dal vivo nel browser | aperta |
| N2 | `OrganigrammaBlocchi` dentro `AreaNavigabile`; doppio clic (o Invio) sul riquadro apre la scheda | Claude | E2E e prova dal vivo | aperta |
| N3 | Vertice: funzione pura `conVertice` in `lib/organigramma-blocchi.ts` — la radice di tipo sede con una sola figlia «direzione generale» diventa etichetta; la direzione generale prende le persone della radice (il Direttore Generale) e le sue figlie; sotto il vertice prima le divisioni di linea, poi le direzioni di staff | Claude | prova unitaria; schermata | aperta |
| N4 | Vista a nodi riscritta in SVG con la stessa disposizione dei dati di N3 (albero da sinistra a destra, tutti i rami aperti, clic sul pallino apre e chiude, doppio clic sull'etichetta apre la scheda) dentro `AreaNavigabile` | Claude | prova unitaria della disposizione; schermata | aperta |
| N5 | Modali che scorrono e si ridimensionano: classe comune per tutte le `DialogContent` di `apps/web` (8 file) | Claude | prova dal vivo sulla scheda | aperta |
| N6 | Diagramma del grafo salvato (`/visualizations/[graphId]`, Mermaid) dentro `AreaNavigabile` | Claude | prova dal vivo o, se la persona non vede la pagina, compilazione | aperta |
| N7 | Rete organizzativa: filtro `position_is_active` in `getOrgNetwork`; posizioni scoperte nel riepilogo; titoli e note in italiano chiaro; etichette dei grafici «posizione — unità (titolare)»; prova di integrazione che confronta con il conteggio diretto | Claude | test di integrazione verde; numeri dal vivo uguali alle misure | aperta |
| N9 | Rilievi del thread forense (15/11): riallineamento ORG_CHART con tipo, gruppo e posizione di ogni nodo (storia36 C11a rosso: 141 nodi della v3 senza tipo e posizione); responsabile nel profilo dal titolare della posizione superiore (D2-01); elenco e conteggio dei grafi solo sulle versioni in uso; scheda /analytics/* solo con `analytics:view` (S-02); «(unassigned)» in italiano | Claude | prove di integrazione verdi; misure prima/dopo; v3 riparata dal vivo | aperta |
| N10 | Dopo il rilascio: «Aggiorna dai dati vivi» su RTL_ORG_CHART v3 (backup verificato prima), poi C11a verde | Claude | `verify-storia36` C11a verde | aperta |
| N8 | PR, CI verde, unione; rilascio con backup verificato, `verifica-deploy.sh` DEPLOYATO; verifica dal vivo con schermate | Claude | esiti scritti qui sotto | aperta |

## Cosa non si chiude in questo ciclo

Niente di previsto. Il riquadro su `/consolidation` resta verificabile dal vivo solo con una persona con mandato HR che gli strumenti possono far entrare; se non c'è, lo si dice con la sola prova di compilazione, come il 14/11.

## Esiti

(da compilare)
