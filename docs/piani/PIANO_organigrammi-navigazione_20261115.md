# Piano — organigrammi navigabili, vertice al Direttore Generale, rete organizzativa corretta (15/11/2026)

Mandato di Enzo del 15/11/2026 (thread «Correggere navigazione e dati degli organigrammi»), con quattro schermate: in tutte le viste organigramma fit all'apertura, zoom con rotella e tasti + e −, doppio clic sul vuoto = ritorno al fit, pan con il trascinamento a clic sinistro, doppio clic su un oggetto apre la modale, modali che scorrono e si ridimensionano; al vertice il CEO/Direttore Generale e la società solo come etichetta; la vista a nodi con la stessa struttura dell'organigramma (divisioni al primo posto, tutti i collegamenti); la pagina «Rete organizzativa» con numeri verificati sul database e grafici spiegati in italiano. Delega completa fino al rilascio. Segue il piano `PIANO_organigrammi-a-blocchi_20261114.md`.

## Misure di partenza (15/11/2026, database di produzione in sola lettura, `BEGIN READ ONLY`)

Struttura di RTL: l'unità «RTL Bank S.p.A.» (tipo HEADQUARTERS, senza padre) contiene la posizione «Direttore Generale» (Marchetti) e, come figlie, le cinque direzioni di staff (Affari Legali e Societari, Antiriciclaggio, Compliance e Protezione Dati, Gestione dei Rischi, Internal Audit) e l'unità «Direzione Generale» (tipo GENERAL_MANAGEMENT), che non ha posizioni e contiene le sette divisioni. Per questo le viste mostravano «RTL Bank S.p.A.» come casella al vertice e, nella vista a nodi, le direzioni di staff al primo livello con le divisioni nascoste sotto un solo ramo chiuso.

Rete organizzativa: la query di `apps/api/src/modules/analytics/repository.ts` (`getOrgNetwork`) non filtrava `position_is_active`. RTL ha 162 posizioni attive e 154 disattivate: la pagina ne mostrava 316, i livelli 1/16/71/174/54, 16 riporti diretti del Direttore Generale e un raggio di 315, con «Analista Rischio» fra i responsabili con 6-7 riporti (tutti da posizioni disattivate). Sulle sole attive: 162 posizioni, 1 vertice (Direttore Generale), 57 responsabili, media 2,82 riporti diretti, livelli 1/12/37/64/48, 4 posizioni scoperte, nessuna posizione attiva che riporta a una disattivata.

Classe del difetto «posizioni disattivate contate»: le altre query che aggregano su `sys_positions` passano dagli incarichi attivi o dai profili retributivi; misurati 0 incarichi attivi e 0 profili su posizioni disattivate, quindi oggi la classe tocca solo la rete organizzativa.

## Voci

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| N1 | Componente `AreaNavigabile` (`apps/web/src/components/organigramma/area-navigabile.tsx`): fit all'apertura e al ridimensionamento finché non si tocca, rotella e tasti + − 0 con il mouse nell'area, doppio clic sul vuoto = fit, trascinamento = pan (il clic dopo un trascinamento non apre niente), pulsanti − % + e «Adatta» | Claude | prova unitaria della matematica del fit e dello zoom; prova dal vivo nel browser | fatta |
| N2 | `OrganigrammaBlocchi` dentro `AreaNavigabile`; doppio clic (o Invio) sul riquadro apre la scheda | Claude | E2E e prova dal vivo | fatta |
| N3 | Vertice: funzione pura `conVertice` in `lib/organigramma-blocchi.ts` — la radice di tipo sede con una sola figlia «direzione generale» diventa etichetta; la direzione generale prende le persone della radice (il Direttore Generale) e le sue figlie; sotto il vertice prima le divisioni di linea, poi le direzioni di staff | Claude | prova unitaria; schermata | fatta |
| N4 | Vista a nodi riscritta in SVG con la stessa disposizione dei dati di N3 (albero da sinistra a destra, tutti i rami aperti, clic sul pallino apre e chiude, doppio clic sull'etichetta apre la scheda) dentro `AreaNavigabile` | Claude | prova unitaria della disposizione; schermata | fatta |
| N5 | Modali che scorrono e si ridimensionano: classe comune per tutte le `DialogContent` di `apps/web` (8 file) | Claude | prova dal vivo sulla scheda | fatta |
| N6 | Diagramma del grafo salvato (`/visualizations/[graphId]`, Mermaid) dentro `AreaNavigabile` | Claude | prova dal vivo o, se la persona non vede la pagina, compilazione | fatta |
| N7 | Rete organizzativa: filtro `position_is_active` in `getOrgNetwork`; posizioni scoperte nel riepilogo; titoli e note in italiano chiaro; etichette dei grafici «posizione — unità (titolare)»; prova di integrazione che confronta con il conteggio diretto | Claude | test di integrazione verde; numeri dal vivo uguali alle misure | fatta |
| N9 | Rilievi del thread forense (15/11): riallineamento ORG_CHART con tipo, gruppo e posizione di ogni nodo (storia36 C11a rosso: 141 nodi della v3 senza tipo e posizione); responsabile nel profilo dal titolare della posizione superiore (D2-01); elenco e conteggio dei grafi solo sulle versioni in uso; scheda /analytics/* solo con `analytics:view` (S-02); «(unassigned)» in italiano | Claude | prove di integrazione verdi; misure prima/dopo; v3 riparata dal vivo | fatta |
| N10 | Dopo il rilascio: «Aggiorna dai dati vivi» su RTL_ORG_CHART v3 (backup verificato prima), poi C11a verde | Claude | `verify-storia36` C11a verde | fatta |
| N8 | PR, CI verde, unione; rilascio con backup verificato, `verifica-deploy.sh` DEPLOYATO; verifica dal vivo con schermate | Claude | esiti scritti qui sotto | fatta |

## Cosa non si chiude in questo ciclo

Niente di previsto. Il riquadro su `/consolidation` resta verificabile dal vivo solo con una persona con mandato HR che gli strumenti possono far entrare; se non c'è, lo si dice con la sola prova di compilazione, come il 14/11.

## Esiti

PR 261 (organigrammi, nodi, rete organizzativa, rilievi forensi, salute organizzativa) unita con CI verde su 3b6164b4, in produzione con il rilascio eb3ad837 (`scripts/verifica-deploy.sh`: DEPLOYATO, 15/11/2026 12:16 UTC). PR 266 (modale ancorata, «1 grafico», elenco dei plurali per il thread forense) unita con CI verde su 3f7b0721, rilascio armato su 063cf774 dopo backup verificato (`heuresys_advanced_20261115T013107Z.dump`, 4071 voci), DEPLOYATO alle 20:01 UTC.

Prove unitarie (vitest apps/web): `navigazione-area`, `organigramma-nodi`, `conVertice` in `organigramma-blocchi`, verdi. Prove di integrazione nuove (CI test-integration verde): rete organizzativa confrontata numero per numero con una query indipendente; riallineamento del grafo con tipo e posizione di ogni nodo e nodo bloccato fermo; responsabile nel profilo dal titolare; conteggio dei grafi sulle sole versioni in uso; salute organizzativa con tutte le unità attive.

N10: «Aggiorna dai dati vivi» premuto su RTL_ORG_CHART v3 dalla persona RTL-PEOPLE_MANAGER dopo il backup verificato; prima `staging.storia36_check_c11a()` rosso (141 nodi senza posizione e senza tipo), dopo verde (162 nodi, 0 senza tipo, 0 senza posizione).

Verifica dal vivo su https://www.heuresys.com con l'adattatore qa-web, persone RTL-CEO e RTL-PEOPLE_MANAGER, schermate a 2x: blocchi (panoramica, sede centrale, filiali) e nodi entrano nell'area all'apertura; rotella, tasti + e −, trascinamento e doppio clic sul vuoto funzionano in ogni area; al vertice «Direzione Generale — Marchetti, Federica», «RTL Bank S.p.A.» solo come etichetta; vista a nodi con 37 nodi, prima le 7 divisioni e poi le 5 direzioni di staff; doppio clic su un riquadro apre la scheda; la scheda scorre e, dopo la PR 266, segue il mouse (+200, −300 px in larghezza, −200 px in altezza: 1024→1224→924, 776→576). Rete organizzativa: 162 posizioni, 1 vertice, 57 responsabili, 4 scoperte, media 2,82, livelli 1/12/37/64/48, primo «Direttore Generale — Marchetti, Federica» con 12 riporti diretti e 161 posizioni sotto, nessun gergo inglese a video. Salute organizzativa: 38 unità, Direzione Generale con 0 persone e senza fascia, 158 persone. Profilo: responsabile dal titolare (per esempio Colombo → «Martini, Riccardo»; misurato su RTL da 123 persone su 158 senza responsabile a 1, il Direttore Generale). Il Direttore Generale (ruolo CEO, senza `analytics:view`) non vede più la scheda «Rete organizzativa» che lo portava a un 403. Elenco grafi: «1 grafico», la sola v3. Grafo salvato (N6): fit al 44%, rotella al 58%, doppio clic sul vuoto di nuovo al 44%.

Non visto dal vivo, come dichiarato sopra: il riquadro su `/consolidation` (nessuna persona con quel mandato è nell'accesso degli strumenti); c'è la compilazione verde in CI (build-web).

Segnalato ad altri thread, fuori da questo ciclo: 101 chiavi con {{count}} senza singolare (`docs/piani/plurali-mancanti_20261115.md`, al thread forense); il ruolo CEO non ha `analytics:view` (scelta di ruoli, al thread dei ruoli RTL).

CICLO CHIUSO — 10/10 voci fatte, non resta niente.
