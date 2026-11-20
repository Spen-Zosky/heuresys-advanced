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

- 23 processi con codici `00`–`22`, creati il 2026-10-27 dal modello in vigore: hanno responsabile, unità e le 131 attività. Dal blocco C del 2026-11-11 (`db/scripts/rtl-allinea/C1_processi.sql`, catalogo dei 21 processi unici approvato da Enzo il 2026-11-10) `08` è accorpato in `07` «Servizi di investimento» e `22` in `16` «IT e cybersecurity»: restano 21 processi attivi.
- 21 processi con codici `P01`–`P30` (numerazione con buchi), creati il 2026-11-17 dall'adozione nel consolidamento: nessun responsabile, nessuna unità, nessuna attività. Sono i processi del prototipo che il catalogo approvato voleva come blocchi dentro i processi unici (per esempio `P12`–`P14` dentro `03`, `P22`–`P25` e `P28` dentro `17`), e il consolidamento li ha invece adottati alla pari.

Le partecipazioni delle unità ai processi `08` e `22` del modello puntano ai processi `07` e `16` del tenant: è l'accorpamento del blocco C, non un difetto. Ne segue però che lo stesso processo compare con nomi diversi a seconda che la pagina legga il nome del modello o quello del tenant.

Progetti: 26 (25 RTL, 1 piattaforma), 174 appartenenze, nessuna tabella di fasi, attività, milestone o dipendenze, nessun progetto collegato a un processo (`project_tenant_process_id` valorizzato su 0 di 26). Oggi un Gantt non ha dati su cui poggiare.

Il numero «22» visto da Enzo non è attribuito con certezza a una pagina: nessun conteggio naturale dà 22. La correzione V0 lo rende irrilevante, perché tutte le pagine contano lo stesso oggetto.

## 2. Piano

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| V0 | Un solo conteggio dei processi del modello in vigore: filtro per versione in `/v1/blueprint-processes`, stessa versione in `/processes` e `/process-owner` (`apps/web/src/lib/versione-attiva.ts`), vista «Processi attivi» del cruscotto ristretta alla versione attivata, nome del processo del tenant in `me/repository.ts`; prova API e prova E2E «stesso numero nelle due pagine» | Claude | PR con CI verde, rilasciata, pagina vista dal vivo con una persona RTL | DONE 2026-11-18: #295 unita (56835ae) e rilasciata, DEPLOYATO su bc5c449f |
| V1 | Decisione: che cosa sono i 21 processi `P01`–`P30` adottati il 17/11 | Enzo | risposta sulla scheda di decisione | DONE 2026-11-18 03:43 di Roma: sottoprocessi dei processi unici |
| V2 | Livello e genitore del processo: migrazione `000498` (`tenant_process_parent_id`, `tenant_process_level`, sentinella `sys.v_tenant_processes_parent_defects`), collocazione dei P con `db/scripts/processi/colloca-sottoprocessi.sql` (mappa dal catalogo approvato, giornale `staging.processi_sottoprocessi_undo`, inversa), lente del quadro sul primo livello, etichette «processi del modello» sulle pagine del catalogo | Claude | CI verde, rilascio, collocazione in produzione dopo backup verificato: 21 processi attivi di primo livello, 21 sottoprocessi, 0 difetti | DONE 2026-11-18: collocazione in produzione, 21 processi di primo livello, 21 sottoprocessi, 0 difetti, seconda corsa senza modifiche |
| V3 | Lessico unico: processo e sottoprocesso, attività (step), partecipazione dell'unità (RACI), esecutore (unità, posizione, ruolo, agente); il glossario (`apps/web/src/lib/glossario.ts`) e le etichette lo seguono; la vista «Attività recenti» del cruscotto Processi diventa «Attività dei processi» (le attività vere, non la timeline), emendando `000316` | Claude | nessuna pagina che chiama «processo» o «attività» un oggetto di un altro tipo (censimento con grep sulle etichette) | ACTIVE 2026-11-20 |
| V4 | Scheda strutturata del processo, con i sottoprocessi come blocchi di attività: `GET /v1/processes/:id/scheda` sul processo del tenant, con scopo, ingressi e uscite, confini, responsabile, fasi e attività ordinate con chi le esegue, RACI per unità e per attività, competenze richieste (dai ruoli), KPI (`sys_process_kpi_templates`), richieste di approvazione e progetti collegati; contratto in `@heuresys/shared`, prova d'integrazione | Claude | rotta in produzione, risposta vista dal vivo con il perimetro di una persona RTL | ACTIVE 2026-11-20 |
| V5 | Pagina del processo: elenco dei processi del tenant con un solo numero, scheda a schede orizzontali, grafo a nodi (processo, attività, unità, ruoli) con le regole di Enzo sugli organigrammi (adatta all'apertura, rotella e +/−, doppio clic sul vuoto adatta, trascinamento, doppio clic su un oggetto apre la finestra ridimensionabile), diagramma a blocchi per corsie (unità) e flusso delle attività, esportazione SVG. Si riusano le viste già fatte nella console del datastore (`apps/console/.../traccia-datastore/corsa/[id]/processi.tsx` e `disegni-processi.ts` di heuresys-datastore: mappa processi per unità, diagramma per fasi, corsie dei ruoli) e il componente SVG degli organigrammi di advanced (`components/organigramma/blocchi.tsx`), non si rifanno da zero; nuovi sono solo il grafo a nodi e il Gantt (analisi in `/mnt/project-files/analisi-console/CONSOLE_DATASTORE_IDEE_PER_HEURESYS_20261118.md`, idea 1) | Claude | giro E2E con login reale, schermate su RTL | ACTIVE 2026-11-20: pagina `/tenant-processes` e scheda, PR #349; chiusa dalla prova dal vivo dopo il rilascio |
| V6 | Modello dati del progetto: fasi (WBS), attività, milestone, dipendenze, date pianificate ed effettive, assegnazioni alle appartenenze esistenti, legame al processo e ai KPI; migrazione idempotente; popolamento di RTL dal datastore (dominio «commesse») e non a mano | Claude | migrazione provata due volte, popolamento con giornale e inversa, conteggi dal vivo | ACTIVE 2026-11-20: migrazione 000503 (tabelle vuote: nessuna fonte porta un piano, misurato in produzione), rotte del piano e prova di integrazione, PR #349 |
| V7 | Scheda e pagina del progetto: `GET /v1/projects/:id/scheda`, viste a grafo, a blocchi e Gantt (solo dove ci sono date e dipendenze) | Claude | giro E2E con login reale | ACTIVE 2026-11-20: piano, Gantt e grafo delle dipendenze sulla pagina del progetto, PR #349 |
| V8 | Processi e progetti come oggetti dell'agente: la scheda è la stessa per la pagina e per l'agente, confinata al perimetro del mandato di chi lo invoca (T2) | Claude | prova dell'agente su un processo e su un progetto di RTL | GATED da V7 |
| V9 | Voce collegata: la «mega API» del Faldone dell'utente, nel thread «Costruire la mega API del Faldone dell'Utente»; la scheda del processo e del progetto ne sono due fonti | altro thread | — | fuori da questo ciclo |

Non si chiude in questa sessione: V3–V8, che sono lavori di più giorni. In questa sessione si chiudono V0, V1 e V2.

## 3. Simulazione di V0

- Vero prima: il registro ha la colonna `blueprint_process_variant_version_id` (000463), l'attivazione ha `blueprint_activation_variant_version_id`; la pagina `/processes` già filtrava per variante (D3-16).
- Strumento: SQL parametrizzato nel repository, filtro in più nel contratto `BlueprintProcessListQuerySchema`; nessuna migrazione, nessuna scrittura sui dati.
- Chi porta il risultato: CI su `main`, rilascio con `scripts/rilascia.sh` nel turno dato dal coordinatore.
- Caso limite: un mandato di piattaforma con più attivazioni non ha una versione sola, e l'elenco resta intero come prima; un tenant senza versione attivata vede l'elenco della variante.

## 4. Raccomandazione per V1 (accolta da Enzo il 2026-11-18)

Tenere i processi del tenant come unica fonte dei «Processi» e trattare i 21 `P01`–`P30` come secondo livello (sottoprocessi) dei 23 processi `00`–`22`, collegandoli a un genitore; finché non sono collocati, la pagina li mostra come «da collocare» e non li somma ai processi di primo livello. Costo: una colonna e un livello (V2) e una tabella di corrispondenze rivista da Enzo o dalla Direzione HR. Rischio: basso, perché le righe restano e il collegamento si annulla. L'alternativa di ritirarli con l'annullamento del consolidamento perde la granularità PCF che serve proprio a fasi, attività e KPI.
