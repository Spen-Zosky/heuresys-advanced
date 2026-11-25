# Modello nuovo dei ruoli di heuresys-advanced

Proposta del 10/11/2026, da approvare prima di toccare qualunque dato. Misura fatta su una copia privata del dump di produzione delle 03:42 del 10/11 (ripristino fedele: 425 concessioni, 319 posizioni); la produzione non è stata letta. File di misura sulla VM: `~/heuresys-advanced/_da_eliminare/ruoli-misura-20261110/` (MISURA_RUOLI.md, POSIZIONI_RTL.tsv, RUOLI_FUNZIONALI_RTL.tsv).

## 1. Perché c'è disordine

Il disordine non nasce da errori singoli ma da come i ruoli vengono scritti. Oggi le concessioni attive sono 402 su 167 utenti di RTL Bank, e quasi nessuna dice chi l'ha data e perché (375 senza motivo né concedente). Le cause misurate sono cinque.

1. Dieci migrazioni concedono ruoli (000049, 000111, 000150, 000155, 000205, 000259, 000272, 000295, 000389, 000479) e nessuna è marcata `@migrate: once`: si riapplicano a ogni rilascio. Una revoca fatta a mano torna indietro al rilascio dopo.
2. Ognuna usa un criterio diverso: la 000259 dà MANAGER a chi dirige un'unità che ne contiene altre e TEAM_LEADER a chi dirige un'unità foglia, la 000272 aggiunge BRANCH_MANAGER ai direttori di filiale, la 000155 dà USER e TEAM_MEMBER a tutti. Il risultato è una pila: i 10 direttori di filiale hanno quattro ruoli (BRANCH_MANAGER, TEAM_LEADER, TEAM_MEMBER, USER), Esposito e Paolo Caputo pure (MANAGER, TEAM_LEADER, TEAM_MEMBER, USER).
3. I ruoli funzionali sono stati aggiunti uno sopra l'altro: Valentina Conti ne ha sei (TENANT_ADMIN, HRMS_MANAGER, ORG_DIRECTOR, HIRING_MANAGER, TEAM_LEADER, USER), mentre TENANT_ADMIN da solo contiene già tutti i permessi di ORG_DIRECTOR e HIRING_MANAGER e quasi tutti quelli di HRMS_MANAGER (ne mancano 3).
4. Nessun mandato ha l'atto di approvazione previsto da ADR-0050 (sys_mandate_acts è vuota): 0 su 402.
5. Le 15 utenze di collaudo, spente, tengono ancora 13 ruoli funzionali.

Una precisazione su «ruoli assegnati in unità non coerenti»: la concessione di un ruolo non porta un'unità (è solo persona, ruolo, tenant). Il perimetro viene dalla posizione della persona nell'organigramma. L'incoerenza vera è fra il ruolo e la posizione: per esempio TEAM_LEADER dato ai titolari di filiali, direzioni, divisioni, uffici e della sede, oppure Federica Marchetti che guida la Direzione Generale ma ha la posizione nell'unità radice.

## 2. Le regole del modello

R1. Due assi separati, come in ADR-0027: il ruolo di comando viene dall'organigramma, il ruolo funzionale dal lavoro della persona.

R2. Il ruolo di comando non si concede mai a mano: si calcola dall'unità di cui la persona è titolare, ogni volta che l'organigramma cambia. Ognuno ne ha al massimo uno.

| Titolare di | Ruolo di comando |
|---|---|
| sede (HEADQUARTERS) o Direzione Generale | CEO |
| un'unità che contiene altre unità attive (divisione, direzione o area con figlie) | MANAGER |
| una filiale (BRANCH) | BRANCH_MANAGER |
| un'unità foglia che non è una filiale (ufficio, direzione o divisione senza figlie) | TEAM_LEADER |
| nessuna unità | nessuno |

R3. USER vale per tutti e non si scrive (lo aggiunge già il codice). TEAM_MEMBER non si concede più: i suoi 13 permessi sono tutti dentro USER, nessuno lo tiene senza USER, e l'appartenenza a un team la decide la tabella dei team, non il ruolo (misurato nel codice: modules/teams/repository.ts legge sys_team_members).

R4. Il ruolo funzionale lo decide Enzo per nome, con il motivo legato alla posizione. Ognuno ne ha al massimo uno; un'eccezione si scrive con il suo motivo.

R5. Un ruolo che ne contiene un altro sostituisce quello contenuto: non si tengono tutti e due.

R6. Ogni mandato (TENANT_ADMIN, HRMS_MANAGER, PEOPLE_MANAGER, DPO, PLATFORM_ADMIN, SECURITY_ADMIN, WHISTLEBLOWING_CUSTODIAN) regge su un atto approvato da un secondo titolare di mandato, come vuole ADR-0050.

R7. Le utenze di collaudo non tengono ruoli a riposo: lo script del collaudo li dà all'inizio di un giro e li toglie alla fine.

R8. C'è una sola fonte: un elenco dichiarato dei ruoli funzionali e una funzione che porta il database a quello stato, con giornale di ritorno. Le migrazioni di oggi smettono di concedere ruoli.

## 3. Chi ha che cosa: RTL Bank

### Ruoli funzionali

| Persona | Posizione | Ruolo funzionale proposto | Oggi | Perché |
|---|---|---|---|---|
| Conti, Valentina | HR Director | TENANT_ADMIN | TENANT_ADMIN, HRMS_MANAGER, ORG_DIRECTOR, HIRING_MANAGER | Vertice HR con il mandato del tenant; TENANT_ADMIN contiene gli altri tre (vedi decisione D1) |
| Colombo, Maria | Resp. Ufficio Amministrazione del Personale | PEOPLE_MANAGER | DATA_STEWARD | La gestione operativa delle persone è il lavoro dell'Amministrazione del Personale (D2) |
| Bruno, Marco | Addetto Amministrazione del Personale | DATA_STEWARD | nessuno | Custode del dato del personale che arriva da fuori, nello stesso ufficio |
| Barbieri, Paolo | Resp. Ufficio Sviluppo, Formazione e Organizzazione | BLUEPRINT_MANAGER | PEOPLE_MANAGER | Il modello dell'organizzazione è il lavoro dell'Organizzazione; decisione tua del 5/11 |
| Russo, Beatrice | Specialista Formazione e Sviluppo | RECRUITER e TAXONOMY_STEWARD (eccezione) | gli stessi | Competenze e selezione sono entrambe Sviluppo; in HR ci sono solo cinque persone (D3) |
| Santoro, Laura | Specialista Compliance | DPO | DPO | Protezione dei dati |
| Martino, Andrea | Head of Legal & Compliance | WHISTLEBLOWING_CUSTODIAN | lo stesso | Custode delle segnalazioni |
| Costa, Alice | System Administrator | SECURITY_ADMIN | lo stesso | Sicurezza degli accessi |
| Bianchi, Luca | Operations Director | PROCESS_OWNER | lo stesso | Titolare dei processi |

Senza titolare in RTL, perché i loro permessi sono già dentro TENANT_ADMIN: HRMS_MANAGER (con D1), ORG_DIRECTOR, HIRING_MANAGER, READ_ONLY. Restano nel catalogo.

Ai cinque titolari di mandato in RTL (Conti, Colombo, Santoro, Costa, Martino) basta l'uno all'altra per approvare gli atti, senza passare dalla piattaforma. Nessuna coppia è fra quelle incompatibili di ADR-0050 D7.

### Ruoli di comando (calcolati, nessuno scelto a mano)

| Chi | Ruolo di comando | Oggi |
|---|---|---|
| Marchetti, Federica (sede e Direzione Generale) | CEO | CEO, TEAM_LEADER, USER |
| Titolari delle 7 divisioni con figlie, delle 2 aree e delle direzioni con figlie (fra cui Conti, De Rosa, Paolo Caputo, Sergio Caputo, Bianchi, Bellini, Leone X., Pellegrini) | MANAGER | misto: MANAGER o TEAM_LEADER, spesso più TEAM_MEMBER |
| 10 direttori di filiale | BRANCH_MANAGER | BRANCH_MANAGER, TEAM_LEADER, TEAM_MEMBER, USER |
| Titolari degli uffici e delle direzioni foglia (fra cui Colombo, Barbieri, Costa A., Martino, Esposito se foglia) | TEAM_LEADER | TEAM_LEADER più TEAM_MEMBER |
| Tutti gli altri | nessuno (solo USER) | TEAM_MEMBER e USER |

L'elenco esatto, persona per persona, lo produce la funzione nella prova: è calcolato, non scritto a mano.

### Permessi da riallineare perché la regola R5 regga

- BRANCH_MANAGER non contiene 10 dei 20 permessi di TEAM_LEADER (fra cui approval:decide, team:read, project:manage): senza aggiungerli, un direttore di filiale perderebbe l'approvazione delle richieste del suo personale. Si aggiungono.
- CEO non contiene 5 permessi di TEAM_LEADER e 2 di BRANCH_MANAGER: si aggiungono.
- TENANT_ADMIN non contiene 3 permessi di HRMS_MANAGER (agent_capability:activate, consolidation:decide, consolidation:run): si aggiungono, con D1.

## 4. Chi ha che cosa: Heuresys System

| Persona | Oggi | Proposto | Perché |
|---|---|---|---|
| Spenuso, Enzo | PLATFORM_ADMIN, BLUEPRINT_MANAGER, IMPLEMENTATION_CONSULTANT, PLATFORM_OPERATOR, SALES, MANAGER, USER | PLATFORM_ADMIN, più CEO calcolato dalla sede | PLATFORM_ADMIN contiene tutti gli altri cinque (0 permessi mancanti, misurato) |
| Spenuso, Andrea (COO) | TEAM_LEADER, USER | TEAM_LEADER calcolato | Titolare di una divisione senza figlie |
| Spenuso, Chiara (Head of Product) | TEAM_LEADER, USER | TEAM_LEADER calcolato | Come sopra |
| platform-test-admin (collaudo) | PLATFORM_ADMIN | nessuno a riposo | Regola R7 |

## 5. Le decisioni che ti chiedo

- D1. Valentina Conti tiene TENANT_ADMIN e lascia HRMS_MANAGER, ORG_DIRECTOR e HIRING_MANAGER (consiglio). In alternativa tiene HRMS_MANAGER e TENANT_ADMIN resta senza titolare in RTL: in quel caso le mancherebbero l'assegnazione dei ruoli, le politiche di accesso, la cancellazione GDPR e l'approvazione dei blueprint (44 permessi).
- D2. PEOPLE_MANAGER passa da Paolo Barbieri a Maria Colombo, e Barbieri prende BLUEPRINT_MANAGER (consiglio). Cambia la tua decisione del 31/10 su Barbieri, e conferma quella del 5/11.
- D3. Beatrice Russo tiene due ruoli funzionali come eccezione scritta (consiglio), oppure TAXONOMY_STEWARD resta senza titolare.
- D4. TEAM_MEMBER smette di essere concesso (consiglio): toglie circa 150 righe senza cambiare un solo permesso.
- D5. Le utenze di collaudo perdono i ruoli a riposo (consiglio).

## 6. Come lo costruisco, dopo il tuo sì

1. ADR-0057 «Il modello dei ruoli» con le regole R1-R8.
2. Una migrazione nuova con l'elenco dichiarato dei ruoli funzionali (persona, ruolo, motivo, decisione), la funzione che calcola i ruoli di comando dall'organigramma e la funzione che allinea il database, con giornale di ritorno `staging.modello_ruoli_undo`, misura prima, guardia e controllo dopo che le persone, le posizioni e le unità non sono cambiate.
3. Emendo le migrazioni che oggi concedono ruoli, così smettono di farlo (ADR-0035), e allineo i permessi della sezione 3.
4. Aggiorno le prove e il README che citano ancora Marchetti come Tenant Admin e Colombo come HRMS Manager.
5. Provo tutto due volte sul database usa-e-getta già pronto sulla VM, e misuro prima e dopo persona per persona.
6. PR in bozza. Non la unisco mentre è armato un rilascio. In produzione l'allineamento dei ruoli funzionali e gli atti di conferma dei mandati richiedono una tua frase scritta.

## 7. Fuori da questo ciclo

Tre difetti dell'organigramma, non dei ruoli: la posizione di Federica Marchetti sta nell'unità radice ma lei guida anche la Direzione Generale; la «Divisione Risk & Compliance» è inattiva ma ha 38 posizioni vuote ed è un doppione della Direzione Risk Management; una direzione attiva non ha titolare. Se vuoi, li tratto nel prossimo ciclo.

## 8. La regola di Enzo sui doppioni (10/11, 15:44)

Lo stesso ruolo tenuto da persone diverse in filiali diverse non è un doppione: è una voce sola del catalogo con più titolari. Un doppione vero è avere due capi della stessa unità nella stessa sede, oppure lo stesso ruolo con due nomi. Il modello la rispetta così: il ruolo di comando nasce dalla titolarità dell'unità, e il dump delle 03:42 dice che in RTL ogni unità ha un solo titolare; i 10 direttori di filiale hanno un solo ruolo, BRANCH_MANAGER, che compare una volta nel catalogo. La funzione di allineamento aggiunge una guardia: se un'unità ha più di un titolare si ferma e lo segnala, invece di dare il comando a due persone.

I doppioni di titolo delle posizioni (Back Office Specialist e Specialista Back Office, Payment Specialist e Specialista Pagamenti, System Administrator e Sistemista; Alice Costa e Pietro Gallo capi con il titolo di un addetto) riguardano il catalogo delle posizioni, non i ruoli di accesso: li tratta il lavoro sul confronto fra la corsa e RTL, e non cambiano questa proposta.

## 9. Rapporto con l'armonizzazione fra la corsa e RTL (10/11, 16:06)

Enzo ha deciso che nell'armonizzazione la corsa del datastore è la fonte di verità: divisioni RTL fuse come nella corsa, livello di Area eliminato, catene gerarchiche risolte dentro la filiale per chi ci lavora. Il modello dei ruoli non cambia per questo, perché i ruoli di comando sono calcolati dall'organigramma: quando l'organigramma cambia, la funzione di allineamento ricalcola chi è CEO, MANAGER, BRANCH_MANAGER o TEAM_LEADER senza scelte a mano. Cambiano invece i nomi della sezione 3: i Responsabili di Area (Leone X., Pellegrini) e i direttori delle divisioni fuse perdono o cambiano il comando secondo dove saranno ricollocati, e i ruoli funzionali seguono la nuova posizione della persona.

Ordine consigliato: prima si costruisce il meccanismo (sezione 6, punti 1-5) e lo si prova sulla copia, poi lo si applica in produzione dopo l'armonizzazione dell'organigramma, così i ruoli si calcolano una volta sola sull'organigramma definitivo.

Aggiornamento 11/11/2026: la CI ha mostrato che TENANT_ADMIN non può ricevere i 3 permessi di HRMS_MANAGER (agent_capability:activate, consolidation:decide, consolidation:run), perché lo vietano l'allowlist D-57 e la regola 000481. D1 diventa: Valentina Conti tiene TENANT_ADMIN e HRMS_MANAGER, e lascia ORG_DIRECTOR e HIRING_MANAGER. Commit ffaac67, PR #225.
