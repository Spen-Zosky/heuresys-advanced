# Piano: portare le interfacce web di advanced alla qualità di un timone di comando (3 novembre 2026)

Mandato del coordinatore del 2026-11-03 alle 01:48 ora di Roma, su richiesta di Enzo: scrivere il piano granulare e approfondito di miglioramento delle interfacce web di heuresys-advanced, da sottoporre a Enzo per il sì. Parole di Enzo: «non accontentarti di un piano superficiale e di proposte minimali: quelle interfacce saranno il timone di comando dei fruitori quindi la qualità deve essere assoluta».

Questo file è il piano del ciclo. In questo ciclo non si scrive codice e non si tocca la produzione: si consegna il piano. Lo stato delle voci si aggiorna qui, non in chat.

## 1. La sbarra della qualità: quando un'interfaccia è «fatta»

Un'interfaccia è il timone di chi la usa solo se rispetta tutte e dieci le condizioni qui sotto. Ogni voce del piano porta una o più di queste condizioni, e nessuna voce si chiude con un test verde soltanto (ADR-0026).

| n | condizione | come si misura |
|---|---|---|
| Q1 | La pagina si apre solo a chi ha il permesso della sua voce di menu; chi digita l'indirizzo senza permesso vede «non hai accesso a questa pagina», non una pagina a metà con errori 403 | giro delle interfacce (`scripts/analisi/giro-interfacce.ts`, PR #136) con tutte le identità: zero pagine a metà |
| Q2 | Ogni dato arriva da `/v1/*` reale, rispetta i due assi (perimetro gerarchico e modalità `edit/read/mask/none`) e le classi mascherate restano mascherate in ogni colonna, anche negli aggregati | prova di integrazione per classe e ruolo, più confronto di accuratezza del giro (oggi 7 su 9 coincidono, V12) |
| Q3 | Nessun elenco troncato in silenzio: o tutto, o pagine con il totale dichiarato | giro: per ogni elenco, conteggio API uguale al conteggio mostrato |
| Q4 | Italiano corretto e completo: date `gg/mm/aaaa`, decimali con la virgola, migliaia col punto, valute con il simbolo, nessuna parola inglese, nessun codice grezzo, nessun UUID a vista | controllo statico nuovo (voce P-2) e giro dal vivo (oggi 1.379 date grezze, 893 decimali col punto, 487 numeri senza separatore, 312 codici grezzi, 80 UUID, V6 VIVO) |
| Q5 | Ogni stato ha la sua forma: caricamento, vuoto con il motivo, non autorizzato con il motivo, errore con il codice e l'identificativo della richiesta | rassegna pagina per pagina nel giro, con schermata per stato |
| Q6 | Ogni azione che la pagina offre l'utente la può davvero compiere: niente pulsanti che finiscono in 403 | giro: zero 403 dopo un clic su un'azione visibile |
| Q7 | Accessibilità WCAG 2.2 livello AA: tastiera, contrasto, etichette, lettore di schermo | `axe` nelle prove E2E su tutte le 131 pagine, non solo sulla vetrina |
| Q8 | Parità con l'agente: ogni azione della pagina esiste come chiamata API documentata e come strumento MCP con lo stesso permesso, e l'agente vede al più ciò che vede la persona (ADR-0040, ADR-0050 D6) | controllo di parità nuovo (voce P-4) |
| Q9 | Ogni scrittura lascia traccia: chi, per conto di chi (persona o agente), quando, che cosa | registro di audit con `actor_type` e `on_behalf_of` (voce A-1) |
| Q10 | Dimostrazione dal vivo: login di una persona vera del tenant con quel profilo, uso secondo il suo lavoro, orario e percorso scritti in questo file | riga di esito nella tabella delle voci |

## 2. Che cosa ho letto e misurato

Materiale letto per intero, senza campionare: `/mnt/project-files/analisi-interfacce/` dalla V1 alla V12 (mandato e piano del team, V1 guardie e anomalie con 430 righe, V2 regole R1-R35 e incoerenze INC-01..24, V3 primo giro, V4 difetti e prontezza degli agenti, V5 dati e agentica, V6 formattazione, contratti e dati dal vivo, V7 lacune, copertura di 91 funzioni e debiti, V8 confronto con il mercato e integrabilità, V9 rapporto, V11 controvalutazione, V12 giro dal vivo del 2026-11-02 con 131 pagine, 14 identità, 1.685 visite, 6.832 chiamate e zero errori 5xx).

Riscontri sul codice di `main` al commit b635cd7 (2026-11-03), ognuno rimisurabile col comando a fianco.

| riscontro | esito | comando |
|---|---|---|
| Pagine dell'applicazione web | 131 | `find apps/web/src/app -name page.tsx \| wc -l` |
| Ultima migrazione | 000468 (463 file) | `ls db/migrations \| tail -1; ls db/migrations \| wc -l` |
| Elenco delle approvazioni | il contratto ferma `limit` a 200 e non ha né `offset` né cursore (`packages/shared/src/schemas/approvals.ts:144`); la pagina chiede 200 approvazioni e 200 utenti (`apps/web/src/app/(authenticated)/approvals/page.tsx:52` e `:64`) | `grep -n limit` sui due file |
| Logo | il logo sta in `DashboardHeader` del pacchetto `@heuresys/ui` (repository `ux-design-shared`) e punta a `/app`; `apps/web/src/app/app/page.tsx` rimanda a `/login` | lettura dei due file |
| Scheda persona | `apps/web/src/app/(authenticated)/users/[userId]/_components/roles-editor.tsx:71` chiede `/v1/users/:id/roles` a chiunque apra la scheda | lettura del file |
| Peso economico delle posizioni | `apps/api/src/modules/positions/repository.ts:65` restituisce `economicWeight` senza maschera | lettura del file |
| Errori | il gestore degli errori risponde «Unexpected server error» senza identificativo (`apps/api/src/middleware/errorHandler.ts:129-131`); la guardia dei permessi risponde «Missing permission: …» in inglese (`apps/api/src/middleware/rbac.ts:110-111`) | lettura dei file |
| Schede di sezione | `MERGE_GROUPS` scritto nel codice (`apps/web/src/components/section-tabs.tsx:28`) | `grep -n MERGE_GROUPS` |
| Pannello dell'agente | solo in `approvals/[id]` e nella pagina di sviluppo `dev/agent` | `grep -rln AgentPanel apps/web/src` |
| OpenAPI | presente ma spenta da un interruttore (`apps/api/src/app.ts:239`) | lettura del file |
| ADR-0050 | accettato da Enzo il 2026-11-03, ma il testo è ancora nella PR #132 e non su `main` | `git show origin/claude/project-thread-9r3s35 --stat` |
| Divisione per zero in `compensation-intelligence` (V6) | sembra già protetta: la colonna dell'ampiezza mostra «—» se il minimo è zero (`compensation-intelligence/page.tsx:435`) | lettura del file; la voce V-7 la chiude dopo il giro |

## 3. Fuori da questo ciclo, e che cosa non si chiude in questa sessione

Detto all'inizio, come chiede la regola: queste cose non si chiudono con questo piano.

- Tutta l'attuazione. Questo ciclo consegna il piano; ogni voce parte solo dopo il sì di Enzo, lotto per lotto, nell'ordine che fissa il coordinatore.
- Le pagine della Direttrice HR (`/org-director` e le sue tre sottopagine, `/consolidation`, `/tenant-blueprints`, `/recruiting`): nessun giro le ha viste dal vivo, perché chi porta `HRMS_MANAGER`, `TENANT_ADMIN` o `ORG_DIRECTOR` ha il secondo fattore e il giro non lo può usare (V12, limiti). Restano fuori finché Enzo non le vede lui stesso (voce P-5). Dopo ADR-0050 D2 nessuna utenza di collaudo potrà più portare quei mandati, quindi questo limite diventa stabile e va risolto con il giro guidato di Enzo, non con un'utenza di prova.
- L'attuazione di ADR-0050 (D1-D7) è del thread «Analizzare a fondo le interfacce web di advanced» (PR #132). Questo piano prende solo le parti che si vedono nelle pagine (voci S-13, S-14, S-15), e le mette dopo le sue consegne.
- Il logo e gli altri componenti condivisi vivono nel repository `ux-design-shared` (`@heuresys/ui`), che questa sessione non raggiunge. Le voci che li toccano lo dicono e hanno un rimedio dentro advanced che non aspetta l'altro repository.
- I quattro ruoli senza titolare (`READ_ONLY`, `BLUEPRINT_MANAGER`, `RECRUITER`, `HIRING_MANAGER`) e il tenant di piattaforma: senza una persona vera che li porta non si possono dimostrare. Assegnarli è una scelta del tenant secondo il principio «il ruolo segue il lavoro» (voce P-6).
- Le voci di mercato che chiedono una spesa o un fornitore (firma elettronica, connettori verso sistemi terzi, fonti di benchmark): si scrivono con costo e rischio, e decide Enzo.
- La produzione e la CI condivisa: in questo ciclo non si toccano. Il rilascio di `main` 215b6687 è in corso.

## 4. L'ambiente di prova: una decisione di Enzo

Il «gemello» di cui si parlava è la copia ripristinabile di fase (ADR-0052): un tag git, un dump con conteggi, configurazione e impronte, sulla VM in `~/backup-hr/copie-fase/` e cifrata su Drive. Non è un ambiente che gira e non ci si lanciano prove: è il punto a cui tornare se un lotto rompe advanced. Il 2026-11-01 Enzo ha scartato il gemello vivo, e il database copia sul linux-pc è fuori perimetro dal 2026-10-25.

Per provare le interfacce senza timori servono tre cose che oggi non stanno insieme: un database con i dati veri di RTL, l'API e il web accesi su quel database, e le persone vere per il login. Le scelte possibili:

| opzione | che cosa è | costo | rischio |
|---|---|---|---|
| A, raccomandata | Banco di prova usa-e-getta per lotto sulla VM: `bash scripts/copia-prova.sh apri <lotto>` per il codice; un database `heuresys_prova_<lotto>` ricaricato dall'ultima copia di fase; API e web accesi su porte libere, raggiungibili solo da Tailscale; chiuso a fine lotto con `copia-prova.sh chiudi` e con il database spostato fra le cose da eliminare | uno script nuovo (`scripts/banco-prova.sh apri/chiudi`, voce P-1), qualche GB di disco per la durata del lotto, circa 10 minuti per aprirlo | basso: niente scrive sulla produzione; il rischio è dimenticarlo acceso, e la chiusura lo impedisce rifiutando di chiudere il lotto con il banco aperto |
| B | Solo la CI (`heuresys_ci`) e poi il giro sulla produzione dopo il rilascio | nessuno | alto per le interfacce: la CI non ha i dati di RTL, quindi i difetti di forma, di elenco troncato e di perimetro si vedono solo in produzione, davanti agli utenti |
| C | Riaccendere un gemello vivo permanente | una macchina o un cluster sempre acceso, da allineare | contraddice la scelta di Enzo del 2026-11-01 |

Raccomando A. La copia di fase che lo alimenta si fa solo quando tutti i thread attivi sono chiusi; finché non c'è, il banco si può caricare dall'ultima copia di fase già provata.

## 5. La ricetta di ogni lotto

Ogni lotto è una PR, poi la CI, poi un rilascio con copia e ritorno provato. Il coordinatore fissa l'ordine e la finestra della CI condivisa. La ricetta, simulata qui una volta per tutte, vale per ogni lotto della tabella.

1. Precondizioni: il sì di Enzo al piano e il via del coordinatore al lotto; nessun altro lotto in CI; banco di prova aperto (opzione A).
2. Ramo dal `main` corrente; per ogni oggetto condiviso che si tocca, `python docs/kb/tools/chi_sorveglia.py <nome>` scritto nella PR.
3. Prima la prova nuova, vista rossa; poi il codice; poi la prova verde. Per le pagine, la prova E2E del caso e il controllo `axe`.
4. `pnpm typecheck`, `cd apps/api && pnpm typecheck:test`, le prove del modulo toccato, e per chi tocca `db/` la prova d'idempotenza della migrazione sul banco.
5. Giro delle interfacce sul banco con tutte le identità del giro V12: le pagine toccate devono migliorare e nessun'altra peggiorare (confronto con gli esiti del 2026-11-02).
6. PR in bozza, CI verde, unione nell'ordine del coordinatore.
7. Copia di fase (`bash scripts/copia-fase.sh copia <lotto>`, poi `prova` e `drive`).
8. Rilascio armato secondo la delega di Enzo (`scripts/close-propagate.sh`), esito letto con `scripts/verifica-deploy.sh`; si scrive «armato», poi «DEPLOYATO» solo quando lo dice lo script.
9. Dimostrazione dal vivo in produzione: login di una persona vera per ogni profilo toccato, uso delle pagine del lotto, esito scritto nella riga con comando, ora e percorso.
10. Se qualcosa non torna: ritorno alla copia del passo 7 con `copia-fase.sh ritorna`, che si esegue solo con il sì di Enzo.

## 6. Le voci

Chi: **C** = Claude, in un thread dedicato al lotto; **E** = Enzo; **C+E** = Claude prepara, Enzo decide o dimostra. Rischio: **B** basso, **M** medio, **A** alto, con la ragione. La colonna «agenti e API» dice che cosa cambia per un agente o per chi integra: un'interfaccia che serve solo alle persone non basta (regola di Enzo del 2026-10-31, piattaforma agentica). La colonna «fonte» rimanda al documento dell'analisi, in `/mnt/project-files/analisi-interfacce/`.

### 6.0 Preparazione: gli strumenti che rendono misurabile la qualità (lotto L0)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| P-1 | Banco di prova usa-e-getta per lotto (opzione A del §4) | `scripts/banco-prova.sh` nuovo (apri, stato, chiudi), appoggiato a `scripts/copia-prova.sh` e all'ultima copia di fase; database `heuresys_prova_<lotto>` sul cluster della VM | C+E | aperto e chiuso una volta per prova, con conteggi uguali alla copia di fase e nessuna scrittura sul database di produzione | precondizione: sì di Enzo all'opzione A. Strumento: `pg_restore` dalla copia di fase in un database a nome nuovo. Chi lo porta altrove: nessuno, vive solo sulla VM. Guardia: lo script rifiuta un nome di database che non inizia con `heuresys_prova_` e rifiuta di partire se la porta è occupata | B: disco; mitigato dalla chiusura obbligatoria | gli strumenti MCP si provano sul banco, mai sulla produzione | messaggio del coordinatore del 2026-11-03; ADR-0052 |
| P-2 | Controllo statico della forma: vieta `toLocale*` senza lingua, date ISO a vista, UUID a vista, stringhe inglesi scritte nelle pagine, codici di stato grezzi | `docs/kb/tools/check_forma_ui.py` nuovo, chiamato dalla CI web | C | visto rosso sui casi noti (37 `toLocale` senza lingua, `time-off/page.tsx:35`, `me/time-off/page.tsx:82`, `recruiting` candidature riga 258, `generated-origins:127-129`, `provenance:88`) e verde dopo il lotto L6 | il controllo nasce in modalità «avviso» e diventa «rosso» solo a fine L6, così non blocca i lotti intermedi | B | le stesse regole valgono per i testi che l'API restituisce all'agente | V6 formattazione.tsv, V6 VIVO |
| P-3 | Giro delle interfacce come cancello ripetibile, con confronto automatico contro l'esito di riferimento del 2026-11-02 | `scripts/analisi/giro-interfacce.ts` (PR #136); uscita in un file di esiti per lotto | C | il giro gira sul banco e in produzione con le 14 identità e produce l'elenco «migliorato, uguale, peggiorato» per pagina | il giro non cambia dati (solo letture e clic che non scrivono); la correzione dell'errore di misura su `kpi-definitions` (definizioni globali, 233 contro 0) entra qui | B | il giro chiama anche gli endpoint che gli strumenti MCP usano, e confronta | V12 ESITO_E_VERDETTO, ESITI_GREZZI |
| P-4 | Controllo di parità persona-agente: per ogni azione di pagina (da `sys_ui_interfaces`) esiste l'endpoint, e lo strumento MCP equivalente chiede lo stesso permesso | `docs/kb/tools/check_parita_agente.py` nuovo; legge `apps/agent-gateway` e le rotte API | C | elenco delle azioni senza strumento e degli strumenti con permesso diverso, visto rosso e reso verde lotto dopo lotto | solo lettura del codice; nessun database | B | è la misura della prontezza agentica | V4 prontezza_agenti.md, V6 prontezza_agenti.tsv |
| P-5 | Giro guidato di Enzo sulle pagine dei mandati | documento passo passo per `/org-director` e tre sottopagine, `/consolidation`, `/tenant-blueprints`, `/recruiting`, con che cosa guardare e che cosa annotare | C+E | Enzo ha aperto le pagine con la sua identità e ha annotato l'esito; le annotazioni diventano voci di questo piano | serve Enzo, per il secondo fattore; dura circa 30 minuti | B | stesso giro con il pannello dell'agente aperto, dove c'è | V12 limiti |
| P-6 | Titolari per i quattro ruoli senza persona e per il tenant di piattaforma | `READ_ONLY`, `BLUEPRINT_MANAGER`, `RECRUITER`, `HIRING_MANAGER`; tenant Heuresys System | E | ogni ruolo ha una persona vera con la posizione che lo giustifica, oppure Enzo decide che il ruolo si ritira | decisione di prodotto; la concessione segue ADR-0050 D4 quando sarà attiva | M: un ruolo senza titolare è un profilo mai provato | un agente non riceve ruoli propri (ADR-0050 D6) | V12 limiti; regola «il ruolo segue il lavoro» |

### 6.1 Sicurezza e permessi (lotti L1, L2, L3)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| S-1 | Guardia di pagina: oggi il proxy controlla solo che il cookie esista, quindi chi digita l'indirizzo di una pagina non sua la vede a metà. Ogni pagina autenticata chiede il permesso della sua voce di menu prima di disegnarsi | `apps/web/src/proxy.ts`; `apps/web/src/app/(authenticated)/layout.tsx`; componente nuovo `lib/page-guard` che legge `/v1/me/interfaces`; pagina «non hai accesso» con il motivo | C | giro con le 14 identità: per ogni pagina fuori menu, schermata «non hai accesso» e zero chiamate 403 a valle | precondizione: la mappa pagina-permesso esiste già in `sys_ui_interfaces` (V12: 579 voci coerenti). Guardia nel caso limite: se `/v1/me/interfaces` non risponde, la pagina non si apre (si chiude per difetto, non si apre per difetto) | M: una mappa sbagliata nasconde una pagina a chi ne ha diritto; il giro lo vede | nessun cambio per l'agente: l'autorità resta l'API | V1 LEGGIMI (guardie a quattro strati); V12 D-26; V11 D-18 |
| S-2 | Le nove voci di menu disattivate restano raggiungibili digitando l'indirizzo | le 9 pagine con voce disattivata in V1 `anomalie.tsv`; regola in S-1 che rispetta lo stato attivo della voce | C | le 9 pagine rispondono «non disponibile» a tutte le identità | dipende da S-1; nessuna migrazione | B | gli endpoint di quelle pagine restano dietro i loro permessi | V11 D-18; V1 anomalie.tsv |
| S-3 | La voce «Salute del sistema» compare a `TENANT_ADMIN`: è un mandato tecnico, va solo a `PLATFORM_ADMIN` | `sys_ui_interfaces` (emendare la migrazione che crea la voce, ADR-0035); `system-health/page.tsx` | C | il menu di `TENANT_ADMIN` non la mostra; quello di `PLATFORM_ADMIN` sì; prova di integrazione su `/v1/me/interfaces` | `chi_sorveglia.py sys_ui_interfaces`; migrazione nuova piccola e idempotente, provata sul banco | B | nessuno | V11 D-14 |
| S-4 | La pagina di sviluppo `/dev/agent` e la pagina orfana `/app` sono raggiungibili in produzione | `apps/web/src/app/(authenticated)/dev/agent/page.tsx`; `apps/web/src/app/app/page.tsx` (vedi V-2) | C | `/dev/agent` esiste solo se l'ambiente non è di produzione, oppure solo per `PLATFORM_ADMIN` | scelta raccomandata: esclusa dalla build di produzione; il pannello vero dell'agente arriva con A-8 | B | il pannello di sviluppo non deve essere la via degli agenti | V1 anomalie.tsv (pagine orfane) |
| S-5 | Pulsanti di scrittura mostrati a chi non ha il permesso: 12 pagine finiscono in 403 al clic | `approvals`, `approvals/[id]`, `content`, `dev/agent`, `leads`, le cinque pagine di `recruiting`, `enterprise-typing`, `whistleblowing-console`; aggancio `useCan(<permesso>)` comune | C | per ogni pagina, un'identità senza permesso non vede il pulsante e una con permesso lo usa con esito; zero 403 dopo un clic nel giro | il permesso di ogni azione si legge dalla stessa mappa di S-1; prova E2E per pagina con due identità | B | l'agente vede le azioni che può compiere dallo stesso elenco (Q8) | V1 anomalie.tsv (scritture non controllate nell'interfaccia) |
| S-6 | Scheda persona a metà fuori dalla catena: `GET /v1/users/:id/roles` risponde 404 nove volte per sette persone, più alcuni 403, e la scheda resta mezza vuota | `apps/api/src/modules/users/routes.ts:133-147`; `users/[userId]/page.tsx`; `_components/roles-editor.tsx:71`; `_components/identity-editor.tsx` | C | fuori catena, la scheda mostra le sezioni visibili e, al posto delle altre, «non visibile: fuori dalla tua catena organizzativa»; nessuna chiamata parte per le sezioni che il ruolo non può vedere; giro con capo, PM e TS senza 404 né 403 | decisione da prendere nella PR: dentro lo stesso tenant l'esistenza della persona è già nota dalla rubrica, quindi la risposta giusta è 403 con codice `OUT_OF_SCOPE` e non 404. Guardia: prova che fuori tenant resta 404 | M: tocca un endpoint usato da più pagine | lo strumento MCP della scheda restituisce la stessa risposta strutturata con il motivo | V12 D-26 |
| S-7 | Il peso economico della posizione esce in chiaro a chi non vede la classe `COMPENSATION` | `apps/api/src/modules/positions/repository.ts:65`; maschera in `apps/api/src/lib/scope/mask.ts`; pagina `positions` | C | prova di integrazione per i ruoli senza la classe: il campo è mascherato; giro: la colonna mostra il segno di maschera | `chi_sorveglia.py position_economic_weight`; prova vista rossa sul codice di oggi | M: il dato è una retribuzione indiretta | lo strumento MCP delle posizioni maschera allo stesso modo | V11 D-03 |
| S-8 | `PEOPLE_MANAGER` può scrivere dati che non può leggere | matrice dei permessi del ruolo (migrazioni dei permessi, `docs/kb/xtras/RBAC_COME_FUNZIONA_DAVVERO.md`); controllo nuovo «chi scrive una classe la legge» | C | il controllo è rosso sui casi di oggi e verde dopo l'emendamento; giro con la persona PM | `PEOPLE_MANAGER` vede tutto il tenant per mandato (Mandato K, migrazione 000432, D-01 ritirato): qui si allinea la lettura alla scrittura, non si restringe il mandato | M: tocca un mandato HR | stessa regola per l'agente che agisce per la persona | V11 D-08; decisione di Enzo del 2026-10-31 |
| S-9 | La maschera del DPO campo per campo non è mai stata verificata | prove di integrazione per ogni endpoint che restituisce `COMPENSATION`, `EVALUATION` o dati personali, con l'identità DPO (perimetro tenant mascherato, ADR-0036 §5) | C | prova verde su ogni endpoint dell'elenco; giro con la persona DPO senza un valore in chiaro | l'elenco degli endpoint si ricava dalla classe dei campi nei contratti Zod | M: se un campo sfugge è una fuga di dati | lo strumento MCP del DPO ha la stessa maschera | V11 D-04 |
| S-10 | Diciannove endpoint senza guardia: per ognuno, pubblico per scelta o da proteggere | elenco in V1 `anomalie.tsv`; per ciascuno, il permesso o la ragione scritta | C | tabella dei 19 con esito e, per quelli da proteggere, prova che senza sessione rispondono 401 | indagine prima, codice dopo; nessuna migrazione | M | un endpoint pubblico è raggiungibile anche dagli agenti esterni | V1 LEGGIMI (19 pubblici) |
| S-11 | Contratti che espongono `tenantId` nelle risposte | `SeedCandidateRecordSchema.tenantId`, `GdprRequestSchema.tenantId` in `packages/shared`; da verificare `apps/api/src/modules/me/routes.ts:825` e `surveys.totalInvitations` | C | i contratti di risposta non portano l'identificativo del tenant; prova di contratto | cambiare un contratto condiviso tocca web e API insieme: un solo commit | B | il contratto è quello che l'agente legge: più pulito per lui | V6 contratti.tsv |
| S-12 | Errori leggibili e utili: oggi un 500 dice «Unexpected server error» e un 403 «Missing permission: …» in inglese | `apps/api/src/middleware/errorHandler.ts:127-131` (codice `RESPONSE_CONTRACT_VIOLATION` quando la risposta non rispetta il contratto, sempre con `requestId`); `apps/api/src/middleware/rbac.ts:103-112` (codice e permesso mancante); mappa codice-messaggio italiano nel web | C | ogni risposta d'errore ha codice, messaggio-chiave, `requestId`; la pagina mostra il messaggio italiano e l'identificativo da citare | prova di integrazione per i tre casi (403, 422, 500); i testi in `apps/web` vengono dalla traduzione | B | è la condizione perché un agente capisca perché ha fallito e non riprovi a vuoto | V6 sintesi (errori) |
| S-13 | Il tetto dei 5.000 risultati risponde 500 | il limitatore dei risultati nell'API; risposta 422 con codice e suggerimento di filtro o paginazione | C | prova: oltre il tetto risponde 422 con codice, non 500 | si fa con A-10 (paginazione a cursore) | B | l'agente riceve un'istruzione invece di un errore | V6 sintesi (paginazione) |
| S-14 | Parti visibili di ADR-0050: concessione di un mandato come atto (proposta, approvazione di un secondo titolare, effetto), esenzioni con scadenza e autore, nuova conferma del secondo fattore prima di aprire retribuzioni e valutazioni per mandato | pagine `admin` dei ruoli e della politica MFA (`admin/mfa-policy/page.tsx`), dialogo di riconferma comune | C, dopo il thread di ADR-0050 | ogni passo dimostrato dal vivo con due titolari veri di mandato | dipende dalle consegne D3, D4, D5 del thread della PR #132; qui non si duplica la logica | A: tocca l'identificazione di chi vede tutto | l'agente non porta mandati (D6) e chiede la conferma alla persona | ADR-0050 (PR #132); V12 osservazione su `/admin/mfa-policy` |
| S-15 | La pagina della politica MFA si mostra a chi non può cambiarla | `admin/mfa-policy/page.tsx`; voce in `sys_ui_interfaces` | C | visibile e modificabile da `SECURITY_ADMIN` (e da chi Enzo indica), invisibile agli altri | rientra in S-1 se la voce di menu è giusta; altrimenti emendamento della voce | B | nessuno | V12 osservazione |

### 6.2 Difetti visibili (lotti L4, L5)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| V-1 | Le approvazioni si fermano a 200 su 741, senza dirlo | `packages/shared/src/schemas/approvals.ts:141-145` (cursore, `sortBy`, totale); rotta delle approvazioni nell'API; `approvals/page.tsx:52`; `me/approvals/page.tsx` | C | la pagina mostra «741 approvazioni», si sfoglia fino all'ultima, si filtra per stato, processo e attività; il conteggio coincide con l'API nel giro | contratto prima, poi API, poi pagina, in un solo commit; prova con più di 200 righe sul banco | M: pagina molto usata | stesso cursore per lo strumento MCP | V12 D-24 |
| V-2 | La scelta della persona nelle approvazioni carica 200 utenti e basta | `approvals/page.tsx:64` (`/v1/users?limit=200`); campo di ricerca con suggerimenti sull'API utenti | C | si trova qualunque persona del perimetro digitando tre lettere | riusa la ricerca della voce M-1 se è già pronta, altrimenti un filtro `q` sulla lista utenti | B | lo strumento di ricerca persone dell'agente usa lo stesso filtro | V12 D-24 |
| V-3 | Una colonna «processo e attività» nelle approvazioni (ADR-0049) | `approvals/page.tsx`, contratto della lista | C | ogni approvazione dice a quale processo e attività appartiene | i dati esistono dal 2026-10-27 (ADR-0049) | B | l'agente filtra le approvazioni per processo | V7 lacune |
| V-4 | Il logo porta al login: `/app` rimanda a `/login` | `apps/web/src/app/app/page.tsx`; in `ux-design-shared`, proprietà `homeHref` di `DashboardHeader` | C | clic sul logo porta alla pagina iniziale del profilo (`/dashboard` o `/me`) senza passare dal login, per tutte le identità | rimedio dentro advanced subito: `/app` calcola la pagina iniziale dalla sessione; nel repository condiviso, quando raggiungibile, il collegamento diretto | B | nessuno | V12 D-25; V11 D-23 |
| V-5 | `enterprise-typing` manda POST dove l'API aspetta PUT | pagina `enterprise-typing`, rotta corrispondente | C | il salvataggio funziona dal vivo con la persona che ne ha il permesso | prova E2E del salvataggio | B | lo strumento MCP usa il verbo giusto | V11 D-11 |
| V-6 | D-13, mai verificato | come descritto in V11 | C | rimisurato; se vero si corregge, se falso si chiude con la prova | indagine | B | da valutare | V11 D-13 |
| V-7 | Ore di straordinario mostrate come zero quando il dato manca (`?? 0`) | pagina degli straordinari | C | dato assente mostrato come «non registrato», distinto da zero | prova con un caso senza dato | B | l'API distingue `null` da 0 anche per l'agente | V6 sintesi |
| V-8 | Divisione per zero in `compensation-intelligence` | `compensation-intelligence/page.tsx:435` | C | confermato dal giro che non succede più, oppure corretto | il codice di oggi sembra già protetto | B | nessuno | V6 sintesi |
| V-9 | Testi inglesi in pagine italiane: paginazione di `/dashboard/tenant`, `SystemHealthLive`, intestazioni di `generated-origins` (127-129) e `provenance` (88) | file citati; chiavi di traduzione | C | nessuna parola inglese nel giro su queste pagine | parte del lotto della forma, se ne anticipa la correzione perché si vede | B | nessuno | V6 VIVO; V6 formattazione.tsv |
| V-10 | Stati grezzi in `tenant-blueprints` | pagina `tenant-blueprints` | C | etichette italiane per ogni stato | etichette dal dato (catalogo degli stati), non scritte nella pagina | B | l'API restituisce codice ed etichetta | V6 formattazione.tsv |
| V-11 | Grafici con assi senza unità | componenti di grafico in `_charts-client.tsx` e nelle pagine `analytics`, `insights`, `visualizations` | C | ogni asse ha unità e scala; ogni grafico ha una tabella equivalente per chi non vede il grafico | da coordinare con `@heuresys/ui` se il componente sta lì | B | la tabella equivalente è anche la forma leggibile dall'agente | V6 sintesi |

### 6.3 Forma: lingua, numeri, date, stati, accessibilità (lotti L6, L7)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| F-1 | Un solo modo di formattare: `formatDate`, `formatDateTime`, `formatNumber`, `formatCurrency`, `formatPercent`, `formatDuration`, con la lingua dell'utente | modulo nuovo in `apps/web/src/lib/format`; sostituzione delle 37 chiamate `toLocale*` senza lingua | C | P-2 verde su tutto `apps/web`; giro: zero date grezze, zero decimali col punto, zero numeri senza separatore | lotto diviso in tre PR per area (persone, organizzazione, analisi) per tenere piccole le revisioni | B | l'API resta in formato standard (ISO, punto decimale): la forma è compito della pagina | V6 formattazione.tsv; V6 VIVO |
| F-2 | Codici grezzi a vista (312 nel giro) | dizionari di etichette dal dato (cataloghi `sys.*`) con traduzione | C | zero codici grezzi nel giro | etichette lette dall'API, non scritte nelle pagine | B | l'API restituisce codice ed etichetta | V6 VIVO |
| F-3 | UUID a vista (80 nel giro, 26 punti nel codice che ne mostrano la testa) | pagine segnalate in V6; area «dettagli tecnici» richiudibile per chi deve citarli | C | zero UUID nel testo normale | | B | l'agente continua a ricevere gli identificativi | V6 formattazione.tsv |
| F-4 | Messaggi d'errore in inglese da `e.message` | tutte le pagine che stampano `e.message`; usa la mappa di S-12 | C | nessun messaggio inglese nel giro con errori provocati sul banco | dipende da S-12 | B | | V6 sintesi |
| F-5 | Stati uniformi: caricamento, vuoto con motivo, non autorizzato con motivo, errore con codice | componente comune (in `@heuresys/ui` se esiste lì, altrimenti in `apps/web/src/components`) | C | ogni pagina usa lo stesso componente; giro con schermata per stato | | B | | V9 rapporto; Q5 |
| F-6 | Accessibilità WCAG 2.2 AA su tutte le pagine | `axe` nella suite E2E (`apps/web`, `a11y.spec.ts` oggi copre la vetrina) estesa alle 131 pagine; navigazione da tastiera; contrasto | C | zero violazioni gravi o critiche; elenco delle minori con data | lungo: prima la misura, poi correzioni a gruppi | M: molte pagine | un'interfaccia accessibile è anche più leggibile da un agente che usa il browser | V8 buone_pratiche; mercato |
| F-7 | Pagine personali (`/me`) usabili da telefono | `apps/web/src/app/(authenticated)/me/**`; disposizione a una colonna; prova E2E con schermo stretto | C | le pagine `/me` passano la prova a 390 pixel di larghezza senza scorrimento orizzontale | | B | | V8 mercato (mobile) |

### 6.4 Prontezza agentica (lotti L8, L9, L10)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| A-1 | L'API distingue l'agente dalla persona: ogni chiamata dell'agente porta `actor_type=agent`, l'identità dell'agente e la persona per cui agisce; il registro di audit li conserva tutti e due | autenticazione dell'API, `apps/agent-gateway`, registro di audit | C | ogni scrittura fatta da un agente si legge nel registro con agente e persona; prova di integrazione | dipende da ADR-0050 D6 (thread della PR #132) | A: tocca l'identità | è il fondamento | V4 prontezza_agenti M-1 |
| A-2 | Restringere l'agente sotto la persona, per compito | gettoni dell'agente con perimetro e permessi ridotti per compito | C | prova: un agente con compito «leggere le approvazioni» non scrive niente | | M | | V4 M-2 |
| A-3 | La sessione dell'agente non porta il rinnovo | gettone breve, senza rinnovo | C | prova: scaduto il gettone, l'agente deve ripassare dalla persona | | M | | V4 M-6 |
| A-4 | Il pavimento dell'area personale per l'agente | regola: un agente per una persona con solo `USER` raggiunge solo `/v1/me/*` | C | prova di integrazione | | M | | V4 M-5 |
| A-5 | Deleghe usabili dagli agenti (ADR-0051), dopo l'identità di A-1 | tabella delle deleghe (000314, oggi 0 righe), gateway | C | prova con una delega vera fra due persone | dipende da A-1 e da G-2 | M | | V4 M-4; ADR-0051 |
| A-6 | Soglie 25 e 40 tarate solo su RTL | parametri per tenant | C | soglie lette dal tenant, con il valore di RTL come predefinito | | B | | V4 M-7 |
| A-7 | Un agente per profilo: catalogo di agenti per ruolo, con i compiti che il ruolo svolge | documento di progetto e poi configurazione | C+E | Enzo approva il catalogo | è progettazione: decide Enzo | M | | V4 M-3 |
| A-8 | Pannello dell'agente su tutte le pagine adatte (oggi 1, le adatte sono 83 su 115) | componente comune guidato da `sys_ui_interfaces`; oggi solo in `approvals/[id]/page.tsx` | C | il pannello è presente sulle 83 pagine; dimostrazione dal vivo su tre pagine di tre profili diversi | il pannello mostra solo ciò che la persona vede (ADR-0040) | M | | V7 ultimi_sviluppi (#159) |
| A-9 | OpenAPI accesa come prodotto, versionata, dietro autenticazione, generata dai contratti Zod | `apps/api/src/app.ts:239`; pubblicazione per versione | C+E | la specifica si scarica, è completa, e P-4 la usa | accenderla in produzione è una decisione di Enzo | M | è il contratto per chi integra | V6 sintesi (34 criteri: 8 sì, 16 parziali, 10 assenti); V8 integrabilità |
| A-10 | Qualità dell'API per gli agenti: paginazione a cursore e `sortBy` ovunque, chiave d'idempotenza sulle POST, `ETag` e `If-Match` sulle modifiche | moduli API, a famiglie | C | i 10 criteri assenti diventano presenti, misurati dalla stessa griglia di V6 | a famiglie di moduli, un lotto per famiglia | M | un agente che riprova non duplica e non sovrascrive | V6 prontezza_agenti.tsv |
| A-11 | Mettere in servizio il gateway degli agenti sulla VM | `apps/agent-gateway`, unità di servizio | E | dopo A-1, A-2, A-3: acceso, e dimostrato con una persona vera | è un rilascio nuovo: decide Enzo | A | | V4 prontezza_agenti |
| A-12 | La vista `v_agente_persone_per_conversazione` è vuota | vista e chi la alimenta | C | spiegato e popolato, oppure ritirato | indagine | B | | V5 agentica |

### 6.5 Funzioni che esistono nell'API o nei dati e non hanno una pagina (lotti L11 e seguenti, un lotto per riga o per coppia)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| G-1 | Attività e partecipanti del processo per l'owner | `apps/api/src/modules/me/routes.ts:450` e `:457`; pagina in `process-owner` | C | l'owner vero di un processo vede e governa attività e partecipanti dal vivo | | B | strumento MCP corrispondente | V7 lacune |
| G-2 | Deleghe (ADR-0051): creare, vedere, revocare; nelle approvazioni «per conto di» | pagina nuova in `/me`; colonna in `approvals` | C | una delega vera fra due persone, dal vivo | dipende dal thread delle attività delegate (migrazione 000468) | M | | V7 lacune; ADR-0051 |
| G-3 | Console del DPO: richieste GDPR, consensi, esportazioni; nell'area personale consensi ed esportazione dei propri dati | pagine nuove; endpoint esistenti | C | il DPO vero gestisce una richiesta dall'inizio alla fine | | M: dati personali | | V7 lacune |
| G-4 | Preferenze di notifica | `/me` | C | | | B | | V7 lacune |
| G-5 | Recupero della parola d'ordine | pagine pubbliche di login | C | dimostrato con una persona vera | passa dalla posta: verificare il servizio di invio | M | | V7 lacune (#8) |
| G-6 | Accesso unico (SSO) | | C+E | | chiede un fornitore d'identità: decide Enzo | A | | V7 lacune (#52); V8 integrabilità |
| G-7 | Avviso sui livelli di gerarchia e stato «ereditato, mantenuto, proprio» dei dati (ADR-0047, ADR-0048) | pagine `organization`, `positions` | C | lo stato si vede su ogni riga | | B | l'API lo restituisce già, l'agente lo legge | V7 lacune |
| G-8 | Ricevute del fascicolo (000460) e contenuti (000458) | pagine nuove | C | | | B | | V7 lacune |
| G-9 | Pagine HR oggi in sola lettura che devono poter scrivere: obiettivi, OKR, valutazione, coinvolgimento, ferie e permessi, revisione dei talenti, retribuzione, progetti | `goals`, `okrs`, `performance`, `engagement`, `time-off`, `talent-review`, `compensation-intelligence`, `projects` | C | una riga per pagina in fase di attuazione, ciascuna con la persona che ne ha il lavoro | otto lotti; l'ordine lo propone il giro di Enzo (P-5) | M | ogni scrittura nasce anche come strumento MCP | V7 lacune |
| G-10 | Inserimento dei nuovi assunti | pagina nuova e processo | C+E | | è una funzione di prodotto: decide Enzo il perimetro | M | | V7 lacune |
| G-11 | Altre funzioni solo API: assegnazioni persona-posizione, sedi, storia delle unità, ciclo di vita dei team, mentorship, previsioni, valutazioni delle competenze, feedback di coinvolgimento, importazioni del tenant, bacini dei successori | una riga di attuazione ciascuna | C | | prima l'ordine, dal valore per il lavoro dei profili | M | | V7 copertura.tsv (21 funzioni solo API) |
| G-12 | Dati che nessuna pagina mostra: requisiti di competenza per occupazione (126 mila righe), misure dei KPI, previsioni dei modelli, nove riquadri, storia delle unità, processi del tenant | pagine esistenti da arricchire | C | | | B | | V5 LEGGIMI |
| G-13 | Aree vuote: selezione (una riga), origini generate, contenuti multimediali | | E | Enzo decide: popolare, nascondere con spiegazione, o ritirare | | B | | V5 LEGGIMI |
| G-14 | Le 29 azioni API senza pagina (creare una persona, eliminare una posizione, creare obiettivi, OKR, cicli di valutazione, altre) | elenco in V1 `anomalie.tsv` | C | ogni azione ha una pagina o una ragione scritta | | M | | V1 anomalie.tsv |
| G-15 | Endpoint orfani: 329 è un tetto, non una misura | `verifica_orfani.py` | C | misura vera, poi classificazione: da usare, da ritirare | | B | un endpoint senza pagina può essere un endpoint per agenti: si scrive | V11; V1 |
| G-16 | Schede di sezione scritte nel codice | `apps/web/src/components/section-tabs.tsx:28` (`MERGE_GROUPS`) | C | le schede vengono dal dato | primo passo verso la composizione da dati (L12) | B | | V7 debiti (D-66) |
| G-17 | File morto `language-switcher.tsx` | | C | ritirato | | B | | V1 anomalie.tsv |

### 6.6 Interfacce composte dai dati (lotto L12, con un ADR)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| D-1 | ADR: modello dei dati della composizione (pagina, sezione, componente, campo, azione), legato alla classe del dato e ai due assi, con varianti per tenant e preferenze personali | `docs/architecture/adr/` nuovo | C+E | Enzo accetta l'ADR | cambiamento architetturale: decide Enzo | M | l'agente legge la stessa composizione: sa che cosa la persona vede e può fare | V9 rapporto (l) |
| D-2 | Prima attuazione su una famiglia già fatta di dati (i cruscotti `/dashboard/[famiglia]`) | migrazione, motore di disegno | C | una famiglia disegnata dal modello, dimostrata dal vivo | dopo D-1 | M | | V9 rapporto (l) |
| D-3 | Estensione alle altre famiglie, a lotti | | C | | | M | | V9 rapporto (l) |

### 6.7 Confronto con il mercato (lotti dopo L12, ciascuno con una decisione di Enzo)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| M-1 | Ricerca globale: persone, posizioni, unità, processi, nel perimetro di chi cerca | API di ricerca, campo nell'intestazione | C | | | M | strumento MCP di ricerca | V8 schede_gruppi |
| M-2 | Storia della posizione nel tempo (il modello è centrato sulla posizione, I1) | `positions` | C | | | B | | V8 |
| M-3 | Organigrammi distinti: gerarchico, funzionale, per processo | `organization` | C | | | B | | V8 |
| M-4 | Gestione dei casi HR (richieste dei dipendenti) | | C+E | | funzione di prodotto | M | | V8 |
| M-5 | Firma elettronica | | E | | chiede un fornitore e una spesa | M | | V8 |
| M-6 | Integrazioni: credenziali per applicazione, identificativi esterni, importazione di prova, notifiche verso l'esterno, SCIM, OIDC e SAML, connettori (JetHR, SAP, Workday, Zucchetti), standard HR Open, registro delle integrazioni | | C+E | | dieci aperture in V8 §9, ognuna con costo e rischio | A | | V8 integrabilita §9 |
| M-7 | Confronti con il mercato (benchmark) | | E | | chiede una fonte di dati | M | | V8 |

## 7. I lotti e l'ordine proposto

L'ordine segue la richiesta: prima sicurezza e permessi, poi i difetti visibili, poi la prontezza agentica, poi le lacune rispetto al mercato. Il coordinatore lo può cambiare.

| lotto | voci | una PR | rilascio | dipende da |
|---|---|---|---|---|
| L0 | P-1, P-2, P-3, P-4 (P-5 e P-6 vanno a Enzo) | sì, strumenti | no: non cambia la produzione | sì di Enzo all'opzione A |
| L1 | S-1, S-2, S-3, S-4, S-5, S-15 | sì | sì | L0 |
| L2 | S-6, S-7, S-8, S-9, S-10, S-11 | sì | sì | L1 |
| L3 | S-12, S-13, F-4 | sì | sì | L1 |
| L4 | V-1, V-2, V-3 | sì | sì | L3 |
| L5 | V-4, V-5, V-6, V-7, V-8, V-9, V-10, V-11 | sì | sì | L1 |
| L6 | F-1, F-2, F-3 (tre PR per area) | tre | uno alla fine | L5 |
| L7 | F-5, F-6, F-7 | sì | sì | L6 |
| L8 | S-14, G-2 | sì | sì | consegne di ADR-0050 (PR #132) e ADR-0051 |
| L9 | A-1, A-2, A-3, A-4, A-5, A-6 | sì | sì | ADR-0050 D6 |
| L10 | A-8, A-9, A-10, A-12 (A-7 e A-11 vanno a Enzo) | per famiglia | sì | L9 |
| L11 | G-1, G-3 ... G-17, una PR per riga | molte | una per riga | L1, giro di Enzo P-5 |
| L12 | D-1, D-2, D-3 | sì | sì | ADR accettato |
| L13 | M-1 ... M-7 | per voce | per voce | decisione di Enzo per voce |

## 8. Registro delle scoperte fuori ciclo

Ciò che emerge strada facendo va qui e si propone una volta sola a Enzo come «fuori da questo ciclo: lo vuoi nel prossimo?».

- Il CLAUDE.md di advanced indica ancora il linux-pc come gemello per le prove (tabella «Dove si esegue il lavoro sul database»); il coordinatore dice che quel database è fuori perimetro dal 2026-10-25 e che il gemello vivo è stato scartato il 2026-11-01. Il CLAUDE.md va riallineato.
- Il testo di ADR-0050 è accettato ma non è ancora su `main` (PR #132).

## 9. Chiusura

CICLO NON CHIUSO: manca il sì di Enzo al piano e la sua scelta sull'ambiente di prova (§4).
