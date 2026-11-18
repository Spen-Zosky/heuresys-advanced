# Piano — processi e progetti trattati in modo sistematico (2026-11-18)

Mandato: messaggio di Enzo del 2026-11-18 alle 03:24 di Roma, nel thread «Rendere sistematici processi e progetti». Si collega alla T2 già decisa (organizzazione e comitati, poi processi e KPI, poi progetti, poi l'agente come motore di richieste). La «mega API» del Faldone dell'utente ha un thread suo ed è qui solo come voce collegata (V9).

## 1. Diagnosi misurata

Misura in sola lettura sul database di produzione `heuresys_advanced`, 2026-11-18 tra le 02:30 e le 02:50 UTC. Comandi: `count(*)` e raggruppamenti su `sys.sys_tenant_processes`, `sys.sys_tenant_process_steps`, `sys.sys_blueprint_process_registry`, `sys.sys_blueprint_activations`, `sys.sys_organization_unit_processes`, `sys.sys_projects`, e `pg_stat_user_tables` per le tabelle che il ruolo di sola lettura non legge (quei numeri sono stime delle statistiche e lo dicono).

La parola «processo» oggi copre cinque oggetti diversi, e le pagine contano ora l'uno ora l'altro.

| oggetto | tabella | RTL Bank | chi lo mostra come «Processi» |
|---|---|---|---|
| A. processo del modello (catalogo) | `sys_blueprint_process_registry`, unico per versione dalla 000463 | 53 righe in due versioni; 23 nella versione in vigore per RTL | `/processes` (23, filtrava la sola variante), `/process-owner` e la vista «Processi attivi» del cruscotto (tutto il registro) |
| B. processo del tenant | `sys_tenant_processes` | 44 righe, 42 attive | lente del quadro «processi senza responsabile», consolidamento, distanza dal modello |
| C. partecipazione di un'unità al processo (RACI) | `sys_organization_unit_processes` | 96 righe, 16 unità, 23 processi del modello | console del responsabile di processo, vista dell'owner |
| C'. lo stesso nel contenuto del modello | `sys_blueprint_content_unit_processes` | circa 63 righe (stima delle statistiche) | dossier del modello e consolidamento |
| D. attività (fase) del processo | `sys_tenant_process_steps` | 131 attività su 21 processi | vista dell'owner, richieste di approvazione |
| E. «attività» che non sono di un processo | eventi della timeline, `sys_activity_classifications` (classi economiche), attività degli agenti | — | la vista «Attività recenti» del cruscotto Processi mostra eventi della timeline delle persone |

Il gruppo B è a sua volta fatto di due tassonomie sovrapposte:

- 23 processi con codici `00`–`22`, creati il 2026-10-27 dal modello in vigore: hanno responsabile, unità e le 131 attività (`08` e `22` sono disattivati e vuoti).
- 21 processi con codici `P01`–`P30` (numerazione con buchi), creati il 2026-11-17 dall'adozione nel consolidamento: nessun responsabile, nessuna unità, nessuna attività. Sono la tassonomia di tipo PCF del prototipo del datastore e si sovrappongono per significato ai primi (per esempio `P12`–`P14` conti con `03`, `P23`–`P25` e `P28` con `17` capitale umano, `P27` con `18`, `P05` con `10`, `P19` con `14`, `P15` con `09`).

Anomalie di collegamento: le 5 righe di partecipazione del processo del modello `08` «Investimenti retail» puntano al processo del tenant `07`, e le 4 del `22` «Dati e analytics» al `16` «IT e cybersecurity»; il processo `07` del tenant si chiama «Servizi di investimento» mentre la sua origine è «Consulenza patrimoniale». Quindi lo stesso processo compare con nomi diversi a seconda che la pagina legga il nome del modello o quello del tenant.

Progetti: 26 (25 RTL, 1 piattaforma), 174 appartenenze, nessuna tabella di fasi, attività, milestone o dipendenze, nessun progetto collegato a un processo (`project_tenant_process_id` valorizzato su 0 di 26). Oggi un Gantt non ha dati su cui poggiare.

Il numero «22» visto da Enzo non è attribuito con certezza a una pagina: nessun conteggio naturale dà 22. La correzione V0 lo rende irrilevante, perché tutte le pagine contano lo stesso oggetto.

## 2. Piano

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| V0 | Un solo conteggio dei processi del modello in vigore: filtro per versione in `/v1/blueprint-processes`, stessa versione in `/processes` e `/process-owner` (`apps/web/src/lib/versione-attiva.ts`), vista «Processi attivi» del cruscotto ristretta alla versione attivata, nome del processo del tenant in `me/repository.ts`; prova API e prova E2E «stesso numero nelle due pagine» | Claude | PR con CI verde, rilasciata, pagina vista dal vivo con una persona RTL | ACTIVE |
| V1 | Decisione: che cosa sono i 21 processi `P01`–`P30` adottati il 17/11 | Enzo | risposta sulla scheda di decisione | WAIT-INPUT |
| V2 | Lessico unico e modello dati del processo: processo (livello 1 e 2, con `tenant_process_parent_id` e livello), attività (step), partecipazione dell'unità (RACI), esecutore (unità, posizione, ruolo, agente); il glossario (`apps/web/src/lib/glossario.ts`) e le etichette lo seguono; la vista «Attività recenti» del cruscotto Processi diventa «Attività dei processi» (le attività vere, non la timeline), emendando `000316` | Claude | migrazione provata due volte sulla copia, glossario e cruscotto allineati, nessuna pagina che chiama «processo» o «attività» un oggetto di un altro tipo (censimento con grep sulle etichette) | GATED da V1 |
| V3 | Correzione dei collegamenti `08`→`07` e `22`→`16` e del nome di `07` con uno script del repo, misura prima, giornale di ritorno, backup verificato | Claude | conteggi dopo uguali a quelli attesi, inversa provata su copia | GATED da V1 |
| V4 | Scheda strutturata del processo: `GET /v1/processes/:id/scheda` sul processo del tenant, con scopo, ingressi e uscite, confini, responsabile, fasi e attività ordinate con chi le esegue, RACI per unità e per attività, competenze richieste (dai ruoli), KPI (`sys_process_kpi_templates`), richieste di approvazione e progetti collegati; contratto in `@heuresys/shared`, prova d'integrazione | Claude | rotta in produzione, risposta vista dal vivo con il perimetro di una persona RTL | GATED da V2 |
| V5 | Pagina del processo: elenco dei processi del tenant con un solo numero, scheda a schede orizzontali, grafo a nodi (processo, attività, unità, ruoli) con le regole di Enzo sugli organigrammi (adatta all'apertura, rotella e +/−, doppio clic sul vuoto adatta, trascinamento, doppio clic su un oggetto apre la finestra ridimensionabile), diagramma a blocchi per corsie (unità) e flusso delle attività, esportazione SVG | Claude | giro E2E con login reale, schermate su RTL | GATED da V4 |
| V6 | Modello dati del progetto: fasi (WBS), attività, milestone, dipendenze, date pianificate ed effettive, assegnazioni alle appartenenze esistenti, legame al processo e ai KPI; migrazione idempotente; popolamento di RTL dal datastore (dominio «commesse») e non a mano | Claude | migrazione provata due volte, popolamento con giornale e inversa, conteggi dal vivo | GATED da V5 |
| V7 | Scheda e pagina del progetto: `GET /v1/projects/:id/scheda`, viste a grafo, a blocchi e Gantt (solo dove ci sono date e dipendenze) | Claude | giro E2E con login reale | GATED da V6 |
| V8 | Processi e progetti come oggetti dell'agente: la scheda è la stessa per la pagina e per l'agente, confinata al perimetro del mandato di chi lo invoca (T2) | Claude | prova dell'agente su un processo e su un progetto di RTL | GATED da V7 |
| V9 | Voce collegata: la «mega API» del Faldone dell'utente, nel thread «Costruire la mega API del Faldone dell'Utente»; la scheda del processo e del progetto ne sono due fonti | altro thread | — | fuori da questo ciclo |

Non si chiude in questa sessione: V1 (serve Enzo), e di conseguenza V2–V8, che sono lavori di più giorni. In questa sessione si chiude V0.

## 3. Simulazione di V0

- Vero prima: il registro ha la colonna `blueprint_process_variant_version_id` (000463), l'attivazione ha `blueprint_activation_variant_version_id`; la pagina `/processes` già filtrava per variante (D3-16).
- Strumento: SQL parametrizzato nel repository, filtro in più nel contratto `BlueprintProcessListQuerySchema`; nessuna migrazione, nessuna scrittura sui dati.
- Chi porta il risultato: CI su `main`, rilascio con `scripts/rilascia.sh` nel turno dato dal coordinatore.
- Caso limite: un mandato di piattaforma con più attivazioni non ha una versione sola, e l'elenco resta intero come prima; un tenant senza versione attivata vede l'elenco della variante.

## 4. Raccomandazione per V1

Tenere i processi del tenant come unica fonte dei «Processi» e trattare i 21 `P01`–`P30` come secondo livello (sottoprocessi) dei 23 processi `00`–`22`, collegandoli a un genitore; finché non sono collocati, la pagina li mostra come «da collocare» e non li somma ai processi di primo livello. Costo: una colonna e un livello (V2) e una tabella di corrispondenze rivista da Enzo o dalla Direzione HR. Rischio: basso, perché le righe restano e il collegamento si annulla. L'alternativa di ritirarli con l'annullamento del consolidamento perde la granularità PCF che serve proprio a fasi, attività e KPI.
