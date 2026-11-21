# Revisione del frontend di advanced con le soluzioni del datastore: mappa a passi piccoli

Data: 2026-11-21. Stato: **da approvare** (Enzo). Thread: «Pianificare la revisione del frontend di advanced».

## 1. Metodo (Enzo, 2026-11-21)

Niente piano da realizzare tutto insieme. Questo file è solo la **mappa**: elenca passi piccoli e autonomi, ciascuno visibile nel browser e rilasciabile da solo in poche ore (una pagina o un elemento per volta). Un passo alla volta, ciascuno in un thread nuovo: PR, CI verde, unione, rilascio, prova dal vivo, link a Enzo per vederlo. Solo dopo il suo sguardo si apre il passo seguente. L'ordine si può cambiare a ogni passo.

Ogni passo rispetta: vincolo agentico (ciò che vede la persona lo vede e lo usa anche l'assistente), dati vivi da `/v1/*`, regole UI di Enzo (italiano, numeri it-IT, «Cognome, Nome», tab orizzontali, stato in ultima colonna, niente sigle, attese visibili, scala di grigi nei disegni, nessun testo troncato), componenti generici in `@heuresys/ui`, composizione in `apps/web`.

## 2. Che cosa ha il datastore e advanced no (sintesi dell'inventario)

Letto il codice di `main` dei due repo il 2026-11-21 (datastore `4ae203c`, advanced `8587974`). Le affermazioni «manca» poggiano su ricerche nel codice; ogni passo le ricontrolla in apertura.

- **Ispezionabilità a cascata** (fondativa). Nel datastore ogni identificativo che compare in pagina o dentro una scheda diventa cliccabile da sé e apre una finestra sopra la precedente: otto tipi di oggetto nel banco (processo, unità, ruolo, terna processo-unità-ruolo, obiettivo, metrica, obbligo normativo, livello del contratto, `apps/banco/public/ispeziona.mjs`), con sezioni contate, diagrammi dentro la scheda (fasi, corsie, struttura sotto l'unità), fonti. In advanced la cascata copre **tre tipi** (persona, posizione, unità: `components/scheda-rapida.tsx`, `TipoScheda`), si attiva solo dove il nome passa dalla rete di leggibilità, e le schede sono meno articolate (niente diagrammi del processo, niente obiettivi o metriche collegati, niente fonti). Processi, attività, competenze, mansioni, obiettivi, KPI, progetti, contratti e livelli non si aprono a cascata. Le finestre sono già ridimensionabili (`lib/modale.ts`).
- **Processi**. Il datastore ha la **mappa processi × unità** (responsabile, esecutrici, consultate, conteggio E/C, clic sul processo), il diagramma per fasi, l'elenco con motivo e fonti. Advanced ha l'elenco dei processi del tenant e, nella scheda, corsie e grafo a nodi (`components/processo/diagrammi.tsx`); la mappa d'insieme e il diagramma per fasi mancano. I dati per la mappa ci sono nello schema: ruolo RACI dell'unità nel processo (`sys_organization_unit_processes`, `TenantProcessUnitRoleSchema`); quanti ne ha RTL si misura nel passo P1.
- **Catena dei passi**. Sono 31 passi (contratto v0.3); le corse fatte con la v0.2 ne hanno 25 (mancano strategia, capability, mestieri, decisioni, agenti, principi). La console lo dice in modo incoerente: menu e guida «31», tabella «Prototipi e corse» «25» (difetto del datastore, va segnalato al suo repo). La vista per livelli con «legge da / lo usano / si rifanno a catena» non ha un equivalente in advanced.
- **Tabelle**. Nel datastore ogni elenco si ordina, si filtra, si raggruppa, si confronta, si esporta in CSV (ciò che si vede) e conserva la vista nell'indirizzo. In advanced la tabella comune (`components/data-table-panel.tsx`) lo fa solo su comando dell'assistente.
- **Altro**: schermo intero nei disegni, attesa visibile anche sulle letture (`attesa-globale.tsx` copre solo le scritture), ricerca per significato con istogramma dei punteggi, guida «Aiuto» di pagina, contratti a una data.
- **Design**: confronto dal vivo con schermate affiancate in corso; i passi di design si aggiungono alla tabella quando arriva, senza fermare i primi passi.

Già coperto in advanced, non si rifà: corsie e grafo dei processi, Gantt, organigrammi con Esporta SVG, coda dell'agente con previsione di spesa, navigatore delle tassonomie, contratti del tenant con lacune, consolidamento e confronto corse, Ctrl+K, menu senza ricarica, schede nell'indirizzo, stato dei servizi, riordino della barra laterale (PR #369).

## 3. I passi

Ordine raccomandato: prima ciò che Enzo ha indicato come più visibile (processi), poi la cascata un tipo alla volta, poi le tabelle una funzione alla volta.

| # | passo (uno per PR, poche ore) | dove si vede | come si prova dal browser | stato |
|---|---|---|---|---|
| P1 | Mappa processi × unità: righe i processi, colonne le unità, R/E/C nelle celle, conteggio E/C, nome intero dell'unità al passaggio, clic sul processo che ne apre la scheda | `/tenant-processes`, nuova scheda «Mappa» | Come Valentina Conti: apri Processi, scheda Mappa; leggi chi è responsabile di un processo, passa sopra un'intestazione, clicca un processo | **primo passo** |
| P2 | Diagramma per fasi nella scheda del processo, accanto a corsie e grafo | `/tenant-processes/[id]` | Apri un processo con fasi: diagramma, schermo pieno della modale, Esporta SVG | da fare |
| P3 | Cascata: la scheda del **processo** (quadro, unità coinvolte con il loro ruolo, attività, diagrammi) apribile ovunque compaia un processo, anche dentro altre schede | tutte le pagine che nominano un processo | Da una persona apri la sua unità, dall'unità un processo, dal processo un'altra unità: le schede si impilano, il filo riporta indietro | da fare |
| P4 | Cascata: **competenza** e **mansione** | Competenze, Posizioni, Faldone | Da una posizione apri una competenza richiesta e da lì le altre posizioni che la chiedono | da fare |
| P5 | Cascata: **obiettivo** e **KPI** | Obiettivi, KPI, scheda del processo | Da un processo apri un obiettivo e la sua metrica | da fare |
| P6 | Cascata: **livello del contratto** | Contratti del tenant, persone | Da una persona apri il suo livello e i minimi | da fare |
| P7 | Cascata: **progetto** e fase | Progetti, Faldone | Da una persona apri un suo progetto e una fase | da fare |
| P8 | Identificativi cliccabili da sé: ogni nome di oggetto noto, anche nel testo libero e dentro le schede, diventa apribile senza scriverlo pagina per pagina | trasversale | Apri una scheda con testo descrittivo: i nomi citati si aprono | da fare |
| P9 | Schermo intero nei disegni (organigrammi, processi, Gantt), Esc per uscire | area navigabile comune | Apri organigramma e un processo, «Schermo intero» | da fare |
| P10 | Tabelle: ordinare cliccando l'intestazione (la stessa vista che usa l'assistente) | tutte le tabelle | Su Utenti ordina per cognome e poi chiedi all'assistente un altro ordine | da fare |
| P11 | Tabelle: filtro con casella di testo e «righe 1–25 di 312» | tutte le tabelle | Su Utenti filtra «Milano» | da fare |
| P12 | Tabelle: esporta in CSV ciò che si vede | tutte le tabelle | Esporta dopo un filtro: il file ha solo le righe filtrate | da fare |
| P13 | Tabelle: vista conservata nell'indirizzo | tutte le tabelle | Copia l'indirizzo, riaprilo: stessa vista | da fare |
| P14 | Tabelle: raggruppa per una colonna | tutte le tabelle | Su Posizioni raggruppa per unità | da fare |
| P15 | Metti a confronto due o più righe | tutte le tabelle | Su Posizioni spunta tre righe, «Confronta» | da fare |
| P16 | Attesa visibile anche quando la pagina legge (barra in cima, segno al centro dopo mezzo secondo) | trasversale | Rete lenta in DevTools: si vede sempre il lavoro in corso | da fare |
| P17 | Ricerca per significato: istogramma dei punteggi con taglio mobile | Competenze | Cerca una frase e sposta il taglio | da fare |
| P18 | Guida «Aiuto» in finestra, letta anche dall'assistente: prima pagina Consolidamento | Consolidamento | «Aiuto» accanto al titolo, poi una domanda all'assistente | da fare |
| P19 | Contratti: minimi a una data e tranche del rinnovo (prima si verifica che i dati ci siano) | Contratti del tenant | Scegli una data passata | da fare |
| P20 | Catena della costruzione del tenant per livelli, con dipendenze e rifacimenti a catena | Costruzione del blueprint | Clic su un passo: da chi dipende, chi lo usa | da decidere (tocca il consolidamento) |
| D… | Passi di design dal confronto con schermate affiancate | — | — | in arrivo |

## 4. Come si chiude un passo

1. In apertura si ricontrolla che il passo manchi ancora e che i dati ci siano (se mancano, il passo lo dice subito a Enzo invece di partire).
2. Una PR con le prove viste rosse prima e verdi dopo; CI verde; unione.
3. Rilascio armato dal thread «Verificare e correggere tutte le pagine di advanced», esito con `scripts/verifica-deploy.sh`.
4. Prova dal vivo in produzione con la persona indicata; esito, ora e link scritti nella sezione 5.
5. Link a Enzo per vederlo; il passo seguente parte in un thread nuovo.

## 5. Esiti dei passi

(vuoto)
