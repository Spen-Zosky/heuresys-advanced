# Piano generale di revisione del frontend di advanced, con le soluzioni del frontend del datastore

Data: 2026-11-21. Stato del piano: **da approvare** (Enzo). Thread: «Pianificare la revisione del frontend di advanced».

## 1. Mandato e metodo

Enzo (2026-11-21): portare nel frontend di advanced (`apps/web`) le soluzioni già presenti nel frontend del datastore (`apps/console` e le pagine di `apps/web` che la console riusa), partendo da un'analisi e da un piano diviso in capitoli. Ogni capitolo si implementa **uno alla volta e per intero**: PR, CI verde, unione, rilascio, prova dal vivo nel browser; Enzo lo vede e lo prova subito, poi si passa al successivo.

Regole che ogni capitolo rispetta: vincolo agentico (ogni soluzione si espone anche all'assistente, non solo alla persona), dati vivi da `/v1/*` (niente mock), regole UI di Enzo (solo italiano, numeri it-IT, persone «Cognome, Nome», tab orizzontali, stato in ultima colonna, niente sigle, dati cliccabili con finestre a cascata, attese visibili, scala di grigi nei disegni), componenti riusabili in `@heuresys/ui` quando sono davvero generici, composizione applicativa in `apps/web`.

Che cosa non si chiude in questa sessione: tutta l'implementazione. Questa sessione consegna solo il piano; nessun capitolo parte senza il sì di Enzo.

## 2. Come è stato fatto l'inventario

Letto il codice di `main` dei due repo il 2026-11-21: datastore `4ae203c` (`apps/console/src/app`, 89 file, e le pagine di `apps/web/src/app` che la console riesporta: cataloghi, cerca, contratti, attese), advanced `8587974` (`apps/web/src`, 145 pagine). Riletta l'analisi del 18/11 (`analisi-console/CONSOLE_DATASTORE_IDEE_PER_HEURESYS_20261118.md` nella cartella del progetto) e verificato voce per voce che cosa è già arrivato in advanced da allora. Le affermazioni «manca in advanced» poggiano su ricerche nel codice (`grep`) e non su una prova dal vivo; ogni capitolo comincia ricontrollandole.

## 3. Già coperto in advanced: non si rifà

| soluzione del datastore | dove sta già in advanced |
|---|---|
| Viste dei processi (corsie, grafo a nodi, Esporta SVG) | `components/processo/diagrammi.tsx`, PR #349 |
| Gantt e dipendenze dei progetti | `components/progetto/gantt.tsx`, PR #349 |
| Organigramma SVG, area navigabile, Esporta SVG | `components/organigramma/*` |
| Proposta con previsione e tetto di spesa, sì o no, registro dei costi | `/admin/agent-requests`, PR #318 |
| Navigatore dei cataloghi (settori, professioni, competenze) | `/tassonomie`, PR #357 e precedenti |
| Contratti del tenant con livelli, minimi e lacune | scheda Contratti di `/tenants/[id]`, PR #321 |
| Confronta corse, vuoti rispetto al completo | `/consolidation` (distanza, registro corse, vocabolario) |
| Ricerca delle pagine con Ctrl+K | `CommandPalette` nel layout autenticato |
| Clic nel menu senza ricaricare la pagina | `components/menu-laterale.tsx` con i `Link` di Next |
| Scheda attiva conservata nell'indirizzo | `components/schede-pagina.tsx` |
| Quadro «servizi: risponde / non risponde» | `/system-health` |
| Gruppi della barra laterale riordinabili | thread «Riordinare i gruppi della sidebar», PR #369 (non si tocca) |
| Cambio di lingua IT/EN della console | non si porta: advanced è solo in italiano per regola |

## 4. I capitoli

Ordine raccomandato: prima ciò che migliora molte pagine con un solo intervento centrale (C1, C2), poi i ritocchi rapidi (C3, C4), poi le pagine singole (C5–C7). C8 è una proposta da decidere.

| # | capitolo | cosa porta dal datastore | file toccati in advanced (previsti) | come si prova dal browser | stato |
|---|---|---|---|---|---|
| C1 | Tabelle che si lavorano | Gli «otto criteri» delle tabelle del datastore (`web/src/app/vista.tsx`, `contratti/strumenti.ts`, `console/.../tabelle.tsx`): ordinare cliccando l'intestazione, filtrare con una casella di testo, raggruppare per una colonna, esportare in CSV **ciò che si vede**, la vista conservata nell'indirizzo (un link riapre la stessa vista), «righe 1–25 di 312» sopra la tabella, intestazione ferma mentre si scorre, comandi di pagina sopra e sotto. Oggi in advanced la tabella si ordina e si filtra solo chiedendolo all'assistente. Agentico: persona e assistente lavorano sulla **stessa** vista (lo stato di `useTabellaAgente`), così ciò che fa uno lo vede l'altro | `components/data-table-panel.tsx`, `lib/agente/use-tabella-agente.ts`, un modulo puro nuovo per ordina/filtra/raggruppa/esporta con le sue prove, `locales/it/common.json` | Come Valentina Conti su «Utenti»: ordina per cognome, filtra «Milano», raggruppa per sede, esporta (il file ha solo le righe filtrate), copia l'indirizzo e riaprilo in un'altra scheda (stessa vista); poi chiedi all'assistente «ordina per ruolo» e guarda i comandi della tabella cambiare. Ripetere su due altre pagine (Posizioni, Approvazioni) | da approvare |
| C2 | Metti a confronto | Dal datastore (cataloghi, contratti): si spuntano due o più righe e una finestra le affianca colonna per colonna, con le differenze segnate. Vale per ogni tabella di C1; l'assistente può proporre il confronto | `components/data-table-panel.tsx`, un componente di confronto in `components/`, `scheda-rapida.tsx` per aprire le voci dal confronto | Su «Posizioni» spunta tre posizioni, «Confronta»: le colonne affiancate, le differenze evidenti, ogni persona o unità si apre a cascata | da approvare (dopo C1) |
| C3 | Schermo intero per i disegni | Il pulsante «Schermo intero» dei disegni della console (organigramma e processi della corsa). In advanced le aree navigabili hanno adatta, zoom ed Esporta SVG ma non lo schermo intero | `components/organigramma/area-navigabile.tsx` (una volta sola, vale per organigrammi, processi e Gantt), `components/progetto/gantt.tsx` se non usa l'area navigabile | Apri l'organigramma, un processo e un progetto: «Schermo intero», zoom e trascinamento funzionano anche lì, Esc torna alla pagina | da approvare |
| C4 | Attesa visibile anche quando si legge | L'indicatore unico del datastore (`web/src/app/attivita.tsx`): ogni chiamata in corso accende una barra in cima e, dopo circa mezzo secondo, un segno al centro; più una prova che rifiuta le attese vuote. In advanced la barra in cima c'è solo per le scritture (`attesa-globale.tsx`) | `components/attesa-globale.tsx`, layout autenticato, una prova in `apps/web/src` | In DevTools rallenta la rete («Slow 4G»), cambia pagina, filtra, apri una scheda: c'è sempre il segno di lavoro in corso e niente lampeggia sulle risposte veloci | da approvare |
| C5 | Ricerca per significato che si legge | Dal datastore (`cerca/ricerca.tsx`, `cerca/istogramma.tsx`, `concetto.tsx`, `grafo.tsx`): l'istogramma dei punteggi con un taglio da spostare (si vede dove i risultati crollano), il pannello che apre una voce accanto all'elenco senza perderlo, con la sua provenienza, e il vicinato della voce disegnato. Taglio e filtri lavorano su ciò che è già arrivato: nessuna chiamata a pagamento in più | `components/semantic-search-panel.tsx`, `app/(authenticated)/tassonomie/_components/navigatore.tsx` | Su «Competenze» cerca «gestione del rischio di credito»: istogramma, sposta il taglio, apri una voce nel pannello accanto, guarda il vicinato e la provenienza | da approvare; da verificare prima quali campi di provenienza dà `/v1/matching/search` |
| C6 | Guida di pagina «Aiuto» | La guida della console (`nuovo-prototipo/guida/`): un pulsante «Aiuto» accanto al titolo, una finestra ridimensionabile che si chiude con Esc, testo in markdown con diagrammi (flusso, nuvola, rete) i cui nodi portano al paragrafo giusto. Agentico: lo stesso testo lo legge l'assistente come conoscenza della pagina | un componente `guida-pagina` in `components/`, `components/intestazione-pagina.tsx`, le guide in markdown accanto alle pagine; prime tre pagine: Consolidamento, Costruzione del tenant, Richieste dell'agente | Apri «Consolidamento», «Aiuto»: la guida si legge, si ridimensiona, i nodi del diagramma portano al punto; poi chiedi all'assistente «come si approva una decisione qui?» e la risposta segue la guida | da approvare |
| C7 | Contratti del tenant più profondi | Dal datastore (`contratti/vista.tsx`): i minimi a una data scelta, le tranche del rinnovo, il confronto fra contratti (via C2). Ordinare e raggruppare arrivano già da C1 | `app/(authenticated)/tenants/[tenantId]/contratti-tenant.tsx`; forse l'API dei contratti se le tranche non sono già esposte | Su RTL Bank, scheda Contratti: scegli una data passata e vedi i minimi di allora; apri le tranche del rinnovo del credito | da approvare; prima un'indagine sui dati (le tranche ci sono nel tenant?) |
| C8 | Catena delle dipendenze e analisi d'impatto | La «Catena dei 31 passi» della console (`catene/passi/catena-passi.tsx`): i passi per livello, un clic dice da chi dipende un passo, chi lo usa e che cosa si rifà a catena se cambia. In advanced servirebbe alla costruzione del tenant e all'analisi d'impatto della tappa T2 | `app/(authenticated)/tenant-blueprints/[id]/versions/[n]/build/page.tsx`, probabilmente un endpoint che dica le dipendenze | Apri la costruzione di una versione del blueprint di RTL, clicca un passo: dipendenze, utilizzatori e catena | da decidere: tocca il lavoro del consolidamento; Enzo sceglie se farlo qui o lì |

## 5. Come si chiude un capitolo

1. Ricontrollo in apertura che ciò che il capitolo porta manchi ancora in `main`.
2. Una PR sola per capitolo, con le prove (unitarie per le funzioni pure, E2E sulla pagina) viste rosse prima e verdi dopo.
3. CI verde, unione in `main`.
4. Rilascio armato dal thread «Verificare e correggere tutte le pagine di advanced» (`scripts/rilascia.sh`), esito letto con `scripts/verifica-deploy.sh`.
5. Prova dal vivo in produzione con la persona indicata nella colonna «come si prova», con comando, esito e ora scritti in fondo a questo file.
6. Messaggio a Enzo con il link alla pagina da provare; la riga passa a «fatto» solo dopo la prova dal vivo.

## 6. Domande a Enzo

- Approvare il piano e l'ordine (C1 → C7), oppure cambiare ordine.
- Soluzioni specifiche del datastore che ha già in mente e che qui mancano: si aggiungono come capitoli.
- C8: farlo qui o lasciarlo al lavoro sul consolidamento.

## 7. Esiti dei capitoli

(vuoto: si compila capitolo per capitolo)
