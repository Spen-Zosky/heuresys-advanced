# Piano: portare le interfacce web di advanced alla qualità di un timone di comando (3 novembre 2026)

Mandato del coordinatore del 2026-11-03 alle 01:48 ora di Roma, su richiesta di Enzo: scrivere il piano granulare e approfondito di miglioramento delle interfacce web di heuresys-advanced, da sottoporre a Enzo per il sì. Parole di Enzo: «non accontentarti di un piano superficiale e di proposte minimali: quelle interfacce saranno il timone di comando dei fruitori quindi la qualità deve essere assoluta».

Questo file è il piano del ciclo. In questo ciclo non si scrive codice e non si tocca la produzione: si consegna il piano. Lo stato delle voci si aggiorna qui, non in chat.

Seconda versione, 2026-11-03 circa alle 02:30 Roma. Rispetto alla prima: lettura completa dichiarata file per file (§2), numerazione dei difetti allineata a V9 §(m) (D-23 logo, D-27 approvazioni, D-28 scheda persona), 31 voci nuove nate dalla seconda lettura (fra cui S-16 maschera delle valutazioni di carriera e successione, S-17 cancellazione delle persone per `HRMS_MANAGER`, S-24 identificativi dei valutatori, S-25 chiamate negate al caricamento, V-12 chiamate ripetute del layout, V-13 barra finale, V-14 pagina d'arrivo del CEO, V-16 dati scritti nelle pagine), e un conteggio di copertura che si rifà con un comando (§10).

## 1. La sbarra della qualità: quando un'interfaccia è «fatta»

Un'interfaccia è il timone di chi la usa solo se rispetta tutte e dieci le condizioni qui sotto. Ogni voce del piano porta una o più di queste condizioni, e nessuna voce si chiude con un test verde soltanto (ADR-0026).

| n | condizione | come si misura |
|---|---|---|
| Q1 | La pagina si apre solo a chi ha il permesso della sua voce di menu; chi digita l'indirizzo senza permesso vede «non hai accesso a questa pagina», non una pagina a metà con errori 403 | giro delle interfacce (`scripts/analisi/giro-interfacce.ts`, PR #136) con tutte le identità: zero pagine a metà |
| Q2 | Ogni dato arriva da `/v1/*` reale, rispetta i due assi (perimetro gerarchico e modalità `edit/read/mask/none`) e le classi mascherate restano mascherate in ogni colonna, anche negli aggregati | prova di integrazione per classe e ruolo, più confronto di accuratezza del giro (oggi 7 su 9 coincidono, V12, e una delle due differenze è un errore del giro) |
| Q3 | Nessun elenco troncato in silenzio: o tutto, o pagine con il totale dichiarato | giro: per ogni elenco, conteggio API uguale al conteggio mostrato |
| Q4 | Italiano corretto e completo: date `gg/mm/aaaa`, decimali con la virgola, migliaia col punto, valute con il simbolo della valuta del dato, nessuna parola inglese, nessun codice grezzo, nessun UUID a vista | controllo statico P-2 e giro dal vivo (al 31/10: 1.379 date grezze, 893 decimali col punto, 487 numeri senza separatore, 312 codici grezzi, 80 UUID, V6 VIVO) |
| Q5 | Ogni stato ha la sua forma: caricamento, vuoto con il motivo, non autorizzato con il motivo, errore con il codice e l'identificativo della richiesta | rassegna pagina per pagina nel giro, con schermata per stato |
| Q6 | Ogni azione o sezione che la pagina offre l'utente la può davvero usare: niente pulsanti che finiscono in 403, niente chiamate negate al caricamento | giro: zero 403 dopo un clic e zero 403 all'apertura (V12: da 28 a 82 chiamate 403 per persona) |
| Q7 | Accessibilità WCAG 2.2 livello AA: tastiera, contrasto, etichette, lettore di schermo | `axe` nelle prove E2E su tutte le pagine di prodotto, non solo sulla vetrina |
| Q8 | Parità con l'agente: ogni azione della pagina esiste come chiamata API documentata e come strumento MCP con lo stesso permesso, e l'agente vede al più ciò che vede la persona (ADR-0040, ADR-0050 D6) | controllo di parità P-4 |
| Q9 | Ogni scrittura lascia traccia: chi, per conto di chi (persona o agente), quando, che cosa | registro di audit con `actor_type` e `on_behalf_of` (voce A-1) |
| Q10 | Dimostrazione dal vivo: login di una persona vera del tenant con quel profilo, uso secondo il suo lavoro, orario e percorso scritti in questo file | riga di esito nella tabella delle voci |

## 2. Che cosa ho letto, e come

La cartella `/mnt/project-files/analisi-interfacce/` contiene 94 file (`find . -type f | wc -l`). Ecco come li ho letti, senza campionare.

| gruppo | file | come |
|---|---|---|
| Documenti dell'analisi | `00_MANDATO_APPUNTI`, `01_PIANO_E_TEAM`; i `LEGGIMI` di V1, V2, V4, V5, V6, V7, V8, V9; V2 `regole.md`; V3 `RESOCONTO_1`, `DATI_GIRO_LEGGIMI`, `errori-v1.md`, `aggregato-endpoint-persona.md`; V4 `difetti.md`, `prontezza_agenti.md`, `V4b_verifiche_vm`; V5 `agentica.md`, `ampiezza.md`, `sentinelle.md`, `viste-vuote.txt`; V6 `sintesi.md`, `VIVO_forma_e_accuratezza`; V7 `lacune.md`, `ultimi_sviluppi.md`; V8 `buone_pratiche_consulenza.md`, `integrabilita.md`, `schede_gruppi.md`; V9 `RAPPORTO_INTERFACCE` comprese le sezioni (l) e (m) aggiornate al 3/11; V10 `REGISTRO_TEMI` aggiornato al 3/11; V11 `CONTROVALUTAZIONE`; V12 `ESITO_E_VERDETTO`, `ESITI_GREZZI_PARTE1`, `ESITI_GREZZI_PARTE2` | letti per intero da me |
| Tabelle dei rilievi | V1 `anomalie.tsv` (430 righe); V2 `incoerenze.tsv` (24); V4 `pagine_attese_vs_viste.tsv` (1.755), `concessioni_attese_vs_reali.tsv` (1.213); V5 `copertura_tabelle.tsv` (373); V6 `formattazione.tsv` (46), `contratti.tsv` (13), `prontezza_agenti.tsv` (34); V7 `copertura.tsv` (91), `debiti.tsv` (56); V8 `matrice_funzioni.tsv` (42); V11 `orfani_v1.tsv` (329, le stesse righe di `endpoint_orfano` di V1) | ogni riga passata dal programma di copertura (§10): nessuna riga resta senza voce o senza motivo |
| Tabelle di riferimento | V1 `pagine.tsv`, `endpoint.tsv`, `pagina_endpoint.tsv`, `dati/*.json`; V2 `matrice_attesa*.tsv`, `matrice_endpoint_attesa*.tsv`, `pagine_meta.tsv`, `ruoli.tsv`; V3 `menu.tsv`, `riepilogo-per-pagina.tsv`; V5 `conteggi-sys.tsv`, `concessioni-per-ruolo.tsv` | sono inventari e matrici attese, non rilievi: servono come ingresso delle voci P-3, P-7 e S-21. Le ho aperte per struttura e conteggio; le righe che diventano rilievi stanno già nelle tabelle dei rilievi |
| Rapporto in altri formati | V9 `TABELLE_INTERFACCE_20261031.xlsx` (23 fogli), `pagina_interfacce.html` | 19 fogli ripetono le tabelle sopra; ho letto per intero i quattro fogli propri (`Stato_al_3_11`, `Decisioni_per_Enzo`, `Prontezza_agenti_permessi`, `Qualita_accuratezza`); la pagina HTML è la resa navigabile delle stesse tabelle |
| Raccolta di mercato | V8 `raccolta/` (18 file, 1.705 righe) | letta per intero da un sottoagente con l'incarico di estrarre ogni capacità non presente in `matrice_funzioni.tsv`; le 24 capacità trovate sono nel conteggio di copertura e diventano le voci M-21..M-26 o si appoggiano a voci esistenti |
| Programmi dell'analisi | V1 `strumenti/*.py`, `esegui_tutto.sh`; V11 `verifica_orfani.py` | non riletti riga per riga: sono i programmi che hanno prodotto le tabelle, e le tabelle sono lette tutte. `verifica_orfani.py` è lo strumento della voce G-38 |

Riscontri sul codice di `main` al commit b635cd7 (2026-11-03), ognuno rimisurabile col comando a fianco.

| riscontro | esito | comando |
|---|---|---|
| Pagine dell'applicazione web | 131, di cui 18 di vetrina (`/showcase/*`), 3 dimostrative o di sviluppo (`/demo`, `/investors`, `/dev/agent`), 1 di solo rimando (`/app`) e 109 di prodotto | `find apps/web/src/app -name page.tsx \| wc -l` |
| Ultima migrazione | 000468 (463 file) | `ls db/migrations \| tail -1; ls db/migrations \| wc -l` |
| Elenco delle approvazioni | il contratto ferma `limit` a 200 e non ha né `offset` né cursore (`packages/shared/src/schemas/approvals.ts:144`); la pagina chiede 200 approvazioni e 200 utenti (`apps/web/src/app/(authenticated)/approvals/page.tsx:52` e `:64`) | `grep -n limit` sui due file |
| Logo | il logo sta in `DashboardHeader` del pacchetto `@heuresys/ui` (repository `ux-design-shared`) e punta a `/app`; `apps/web/src/app/app/page.tsx` rimanda a `/login` | lettura dei due file |
| Scheda persona | `apps/web/src/app/(authenticated)/users/[userId]/_components/roles-editor.tsx:71` chiede `/v1/users/:id/roles` a chiunque apra la scheda | lettura del file |
| Peso economico delle posizioni | `apps/api/src/modules/positions/repository.ts:65` restituisce `economicWeight` senza maschera | lettura del file |
| Cancellazione di una persona | `apps/api/src/modules/users/service.ts:103-108`: la cancellazione resta a `TENANT_ADMIN` e `PLATFORM_ADMIN`, mentre la regola di progetto dà a `HRMS_MANAGER` il potere di eliminare qualunque dato di business (`.claude/rules/regole-di-progetto.md`) | lettura del file |
| Maschera nelle valutazioni di carriera e successione | nessuna chiamata di maschera in `apps/api/src/modules/user-career-plans` e `apps/api/src/modules/succession-pools` | `grep -rln mask` sulle due cartelle |
| Liste di ruoli nel web | `apps/web/src/app/(authenticated)/layout.tsx:163` definisce `ADMIN_ROLES` con sette codici | lettura del file |
| Errori | il gestore degli errori risponde «Unexpected server error» senza identificativo (`apps/api/src/middleware/errorHandler.ts:129-131`); la guardia dei permessi risponde «Missing permission: …» in inglese (`apps/api/src/middleware/rbac.ts:110-111`) | lettura dei file |
| Ritenzione GDPR | `apps/api/src/modules/gdpr/service.ts:159` risponde `PLATFORM_ONLY` a chi non è `PLATFORM_ADMIN`, anche se il permesso è concesso ad altri ruoli | lettura del file |
| Schede di sezione | `MERGE_GROUPS` scritto nel codice (`apps/web/src/components/section-tabs.tsx:28`) | `grep -n MERGE_GROUPS` |
| Pannello dell'agente | solo in `approvals/[id]` e nella pagina di sviluppo `dev/agent` | `grep -rln AgentPanel apps/web/src` |
| OpenAPI | presente ma spenta da un interruttore (`apps/api/src/app.ts:239`) | lettura del file |
| Deleghe | la pagina `/me/delegations` esiste (PR #133, in produzione dal 1/11) | `find apps/web/src/app -path '*me/delegations*'` |
| ADR-0050 | accettato da Enzo il 2026-11-03 ed entrato su `main` con la PR #132 | `ls docs/architecture/adr/0050_*` su `main` aggiornato |
| Divisione per zero in `compensation-intelligence` | sembra già protetta: la colonna dell'ampiezza mostra «—» se il minimo è zero (`compensation-intelligence/page.tsx:435`) | lettura del file; la voce V-8 la chiude dopo il giro |

Numerazione dei difetti. Vale quella di V9 §(m) e V10 tema 18, aggiornata al 3/11: il giro del 2/11 aveva chiamato D-24, D-25 e D-26 tre difetti nuovi, ma quei numeri erano già usati. Qui D-27 sono le approvazioni troncate (il D-24 del file V12), D-23 è il logo che porta al login (il D-25 del file V12), D-28 è la scheda persona a metà (il D-26 del file V12). D-24 e D-25 restano quelli del 31/10: il layout che richiama le stesse letture 110 volte, e `/mfa-policy/` con la barra finale.

## 3. Fuori da questo ciclo, e che cosa non si chiude in questa sessione

Detto all'inizio, come chiede la regola: queste cose non si chiudono con questo piano.

- Tutta l'attuazione. Questo ciclo consegna il piano; ogni voce parte solo dopo il sì di Enzo, lotto per lotto, nell'ordine che fissa il coordinatore.
- Le pagine della Direttrice HR (`/org-director` e le sue tre sottopagine, `/consolidation`, `/tenant-blueprints` con le sue quattro pagine, `/recruiting` con le sue cinque): nessun giro le ha viste dal vivo, perché chi porta `HRMS_MANAGER`, `TENANT_ADMIN` o `ORG_DIRECTOR` ha il secondo fattore e il giro non lo può usare (V12, limiti). Restano fuori finché Enzo non le vede lui stesso (voce P-5). Dopo ADR-0050 D2 nessuna utenza di collaudo potrà più portare quei mandati, quindi questo limite è stabile e si risolve con il giro guidato di Enzo, non con un'utenza di prova.
- L'attuazione di ADR-0050 (D1-D7) segue i suoi passi (regole 2 e 3, poi 4, poi 5) nel thread che l'ha scritto. Questo piano prende solo le parti che si vedono nelle pagine (voce S-14) e le mette dopo quelle consegne.
- La documentazione dei ruoli (`PEOPLE_MANAGER`, `DPO`, `SECURITY_ADMIN` come funzionali; INC-07, INC-17) è in corso nel thread «Correggere i difetti delle pagine di advanced» (V10 tema 16).
- Il logo e gli altri componenti condivisi vivono nel repository `ux-design-shared` (`@heuresys/ui`), che questa sessione non raggiunge. Le voci che li toccano hanno un rimedio dentro advanced che non aspetta l'altro repository.
- I quattro ruoli senza titolare (`READ_ONLY`, `BLUEPRINT_MANAGER`, `RECRUITER`, `HIRING_MANAGER`) e il tenant di piattaforma: senza una persona vera non si possono dimostrare. Assegnarli è una scelta del tenant secondo il principio «il ruolo segue il lavoro» (voce P-6).
- Le voci di mercato che chiedono una spesa, un fornitore o una scelta commerciale (firma elettronica, connettori, benchmark, presenze, paghe, marketplace): si scrivono con costo e rischio, e decide Enzo.
- La produzione e la CI condivisa: in questo ciclo non si toccano. Le unioni su `main` sono bloccate dal coordinatore finché il rilascio 636a51fa non è DEPLOYATO.

## 4. L'ambiente di prova: una decisione di Enzo

Il «gemello» di cui si parlava è la copia ripristinabile di fase (ADR-0052): un tag git, un dump con conteggi, configurazione e impronte, sulla VM in `~/backup-hr/copie-fase/` e cifrata su Drive. Non è un ambiente che gira e non ci si lanciano prove: è il punto a cui tornare se un lotto rompe advanced. Il 2026-11-01 Enzo ha scartato il gemello vivo, e il database copia sul linux-pc è fuori perimetro dal 2026-10-25.

Per provare le interfacce senza timori servono tre cose che oggi non stanno insieme: un database con i dati veri di RTL, l'API e il web accesi su quel database, e le persone vere per il login. Le scelte possibili:

| opzione | che cosa è | costo | rischio |
|---|---|---|---|
| A, raccomandata | Banco di prova usa-e-getta per lotto sulla VM: `bash scripts/copia-prova.sh apri <lotto>` per il codice; un database `heuresys_prova_<lotto>` ricaricato dall'ultima copia di fase; API e web accesi su porte libere, raggiungibili solo da Tailscale; chiuso a fine lotto con `copia-prova.sh chiudi` e con il database spostato fra le cose da eliminare | uno script nuovo (`scripts/banco-prova.sh apri/stato/chiudi`, voce P-1), qualche GB di disco per la durata del lotto, circa 10 minuti per aprirlo | basso: niente scrive sulla produzione; il rischio è dimenticarlo acceso, e la ricetta del lotto non si chiude con il banco aperto |
| B | Solo la CI (`heuresys_ci`) e poi il giro sulla produzione dopo il rilascio | nessuno | alto per le interfacce: la CI non ha i dati di RTL, quindi i difetti di forma, di elenco troncato e di perimetro si vedono solo in produzione, davanti agli utenti |
| C | Riaccendere un gemello vivo permanente | una macchina o un cluster sempre acceso, da allineare | contraddice la scelta di Enzo del 2026-11-01 |

Raccomando A. La copia di fase che lo alimenta si fa solo quando tutti i thread attivi sono chiusi; finché non c'è, il banco si carica dall'ultima copia di fase già provata.

## 5. La ricetta di ogni lotto

Ogni lotto è una PR, poi la CI, poi un rilascio con copia e ritorno provato. Il coordinatore fissa l'ordine e la finestra della CI condivisa. La ricetta, simulata qui una volta per tutte, vale per ogni lotto della tabella del §7.

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

Chi: **C** = Claude, in un thread dedicato al lotto; **E** = Enzo; **C+E** = Claude prepara, Enzo decide o dimostra. Rischio: **B** basso, **M** medio, **A** alto, con la ragione. La colonna «agenti e API» dice che cosa cambia per un agente o per chi integra: un'interfaccia che serve solo alle persone non basta (regola di Enzo del 2026-10-31, piattaforma agentica). La colonna «fonte» rimanda al documento dell'analisi, in `/mnt/project-files/analisi-interfacce/`. Dove la simulazione è vuota vale la ricetta del §5 senza aggiunte.

### 6.0 Preparazione: gli strumenti che rendono misurabile la qualità (lotto L0)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| P-1 | Banco di prova usa-e-getta per lotto (opzione A del §4) | `scripts/banco-prova.sh` nuovo (apri, stato, chiudi), appoggiato a `scripts/copia-prova.sh` e all'ultima copia di fase; database `heuresys_prova_<lotto>` sul cluster della VM | C+E | aperto e chiuso una volta per prova, con conteggi uguali alla copia di fase e nessuna scrittura sul database di produzione | precondizione: sì di Enzo all'opzione A. Strumento: `pg_restore` dalla copia di fase in un database a nome nuovo. Chi lo porta altrove: nessuno, vive solo sulla VM. Guardia: lo script rifiuta un nome di database che non inizia con `heuresys_prova_` e rifiuta di partire se la porta è occupata | B: disco; mitigato dalla chiusura obbligatoria | gli strumenti MCP si provano sul banco, mai sulla produzione | messaggio del coordinatore del 2026-11-03; ADR-0052 |
| P-2 | Controllo statico della forma: vieta `toLocale*` senza lingua, date ISO a vista, UUID a vista, stringhe inglesi scritte nelle pagine, codici di stato grezzi, valute scritte nel codice | `docs/kb/tools/check_forma_ui.py` nuovo, chiamato dalla CI web | C | visto rosso sui casi noti (37 `toLocale` senza lingua; `time-off`, `me/time-off`, `recruiting/applications/[id]`, `generated-origins`, `provenance`, `system-health`) e verde a fine L6 | nasce in modalità «avviso» e diventa «rosso» a fine L6, così non blocca i lotti intermedi | B | le stesse regole valgono per i testi che l'API restituisce all'agente | V6 formattazione.tsv, V6 VIVO |
| P-3 | Giro delle interfacce come cancello ripetibile: confronto automatico con l'esito del 2026-11-02, tempo di ogni chiamata, conteggio delle chiamate 403 all'apertura, correzione dell'errore di misura sulle definizioni KPI globali | `scripts/analisi/giro-interfacce.ts` (PR #136); uscita in un file di esiti per lotto | C | il giro gira sul banco e in produzione con le 14 identità e produce l'elenco «migliorato, uguale, peggiorato» per pagina, con i tempi | il giro non scrive (le scritture restano bloccate dalla sua guardia, V12: zero) | B | il giro chiama anche gli endpoint usati dagli strumenti MCP | V12; V9 (j) 7; V7 debiti #211 |
| P-4 | Controllo di parità persona-agente: per ogni azione di pagina esiste l'endpoint, e lo strumento MCP equivalente chiede lo stesso permesso | `docs/kb/tools/check_parita_agente.py` nuovo; legge `apps/agent-gateway` e le rotte API | C | elenco delle azioni senza strumento e degli strumenti con permesso diverso, visto rosso e reso verde lotto dopo lotto | solo lettura del codice | B | è la misura della prontezza agentica | V4 prontezza_agenti.md; V6 prontezza_agenti.tsv |
| P-5 | Giro guidato di Enzo sulle pagine dei mandati | documento passo passo per `/org-director` e sottopagine (`advisor`, `health`, `vrio`), `/consolidation`, `/tenant-blueprints` e sottopagine, `/recruiting` e sottopagine, con le cinque eccezioni di ADR-0036 §5 da guardare (prova T-4) | C+E | Enzo ha aperto le pagine con la sua identità e annotato l'esito; le annotazioni diventano voci di questo piano | serve Enzo per il secondo fattore; circa 30 minuti | B | stesso giro con il pannello dell'agente aperto, dove c'è | V12 limiti; V4 LEGGIMI T-4, T-10; V10 tema 3 |
| P-6 | Titolari per i quattro ruoli senza persona e giro sul tenant di piattaforma | `READ_ONLY`, `BLUEPRINT_MANAGER`, `RECRUITER`, `HIRING_MANAGER`; tenant Heuresys System | E | ogni ruolo ha una persona vera con la posizione che lo giustifica, oppure Enzo decide che il ruolo si ritira; il tenant di piattaforma è stato visitato | decisione di prodotto; la concessione segue ADR-0050 D4 quando sarà attiva | M: un ruolo senza titolare è un profilo mai provato (242 concessioni non confrontabili in V4) | un agente non riceve ruoli propri (ADR-0050 D6) | V12 limiti; V4 concessioni_attese_vs_reali.tsv |
| P-7 | Controllo voce-pagina-permesso: la voce di menu chiede il permesso che serve alle chiamate necessarie della pagina, e le chiamate facoltative non partono senza il loro permesso | `docs/kb/tools/check_voce_permesso.py` nuovo, da `sys_ui_interfaces` e dalla mappa pagina-chiamate (V1 `pagina_endpoint.tsv` rigenerata) | C | rosso sui casi noti (`/admin/roles`, `/approvals` con `user:read`, `/skills` con `matching:read`, `/positions/[positionId]` per `PEOPLE_MANAGER`, `/users/[userId]` per il DPO con `timeline:read`), verde dopo S-19 e S-25 | solo lettura | B | stessa mappa per gli strumenti dell'agente | V2 INC-10, INC-11; V4 pagine_attese_vs_viste.tsv |
| P-8 | Controllo dei contratti: uno schema di risposta che dichiara non nullo un campo la cui colonna può essere nulla rompe l'intero elenco con un 500 | `docs/kb/tools/check_contratti_nullabili.py` nuovo, che confronta gli schemi Zod di `packages/shared` con le colonne dell'atlante | C | trova il caso già corretto di `skill-categories.familyId` (D-10) se lo si rimette, e i casi latenti di S-11 | il limite dichiarato dall'analisi (nomi diversi fra tabella e schema) si scrive nel controllo | B | un 500 di contratto ferma anche l'agente | V6 contratti.tsv; V9 (j) 4; V10 tema 11 |
| P-9 | Prove dal vivo che restano dalla lista T-1..T-13 | T-5 custode delle segnalazioni sulla console, T-10 `ORG_DIRECTOR` e `PROCESS_OWNER` sul perimetro della propria unità; le altre stanno in S-9, S-16, S-17, S-18, S-20, S-23, V-14, A-15 | C+E | esito scritto per ogni prova | il custode e l'`ORG_DIRECTOR` hanno il secondo fattore: si fanno con il giro guidato P-5 o con la persona stessa | B | | V4 LEGGIMI T-1..T-13 |

### 6.1 Sicurezza e permessi (lotti L1, L2, L3)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| S-1 | Guardia di pagina: oggi il proxy controlla solo che il cookie esista e solo `/system-health` ha un rimando per ruolo, quindi chi digita l'indirizzo di una pagina non sua la vede a metà. Ogni pagina autenticata chiede il permesso della sua voce di menu prima di disegnarsi | `apps/web/src/proxy.ts`; `apps/web/src/app/(authenticated)/layout.tsx`; componente nuovo `lib/page-guard` che legge `/v1/me/interfaces`; pagina «non hai accesso» con il motivo | C | giro con le 14 identità: per ogni pagina fuori menu, schermata «non hai accesso» e zero chiamate a valle | precondizione: la mappa pagina-permesso esiste in `sys_ui_interfaces` (V12: 579 voci coerenti). Caso limite: se `/v1/me/interfaces` non risponde, la pagina non si apre | M: una mappa sbagliata nasconde una pagina a chi ne ha diritto; il giro lo vede | nessun cambio: l'autorità resta l'API | V2 INC-05, INC-09; V4 D-15, D-16, D-17; V12 |
| S-2 | Le nove voci di menu disattivate hanno pagine raggiungibili digitando l'indirizzo | `/analytics/org-network`, `/analytics/overtime`, `/analytics/skills-by-category`, `/analytics/skills-group-share`, `/compensation-intelligence`, `/gaps`, `/insights/skill-gap`, `/insights/succession-readiness`, `/kpis` | C+E | per ognuna Enzo sceglie: si riattiva la voce, si sposta come scheda di un'altra pagina, o si ritira; poi le pagine non scelte rispondono «non disponibile» | dipende da S-1; la scelta è di prodotto | B | gli endpoint restano dietro i loro permessi | V4 D-18; V2 INC-21; V1 anomalie A380-A398; V9 (j) 12 |
| S-3 | La voce «Salute del sistema» compare a `TENANT_ADMIN`, che poi viene rimandato; `PLATFORM_OPERATOR` ha l'API ma non la pagina | `sys_ui_interfaces` (emendare la migrazione che crea la voce, ADR-0035); `system-health/page.tsx:32-37` | C | menu di `TENANT_ADMIN` senza la voce; `PLATFORM_ADMIN` e `PLATFORM_OPERATOR` la vedono e la usano; prova di integrazione su `/v1/me/interfaces` | `chi_sorveglia.py sys_ui_interfaces`; migrazione piccola e idempotente, provata sul banco | B | | V4 D-14; V2 INC-04 |
| S-4 | Pagine di vetrina, dimostrative e di sviluppo: `/dev/agent` e le 18 `/showcase/*` sono spente in produzione solo da variabili d'ambiente (D-26 non è un difetto oggi, ma nessun controllo lo garantisce domani); `/demo` e `/investors` sono pubbliche con immagini e numeri scritti | `apps/web/src/app/(authenticated)/dev/agent`, `apps/web/src/app/showcase/**`, `apps/web/src/app/demo`, `apps/web/src/app/investors`, `apps/web/src/proxy.ts` | C+E | un controllo del rilascio prova che in produzione `/dev/agent` e `/showcase` rispondono 404; Enzo decide se `/demo` e `/investors` restano (sono comunicazione, non prodotto) | il controllo si aggiunge a `scripts/verifica-deploy.sh` | B | il pannello di sviluppo non è la via degli agenti | V4 D-26; V2 INC-22; V1 anomalie A390-A426 |
| S-5 | Pulsanti di scrittura mostrati senza controllare il permesso: 12 pagine finiscono in 403 al clic | `approvals`, `approvals/[id]`, `content`, `dev/agent`, `leads`, `recruiting`, `recruiting/applications/[id]`, `recruiting/candidates`, `recruiting/postings`, `recruiting/requisitions`, `tenants/[tenantId]/enterprise-typing`, `whistleblowing-console`; aggancio comune `useCan(<permesso>)` | C | per ogni pagina, un'identità senza permesso non vede il pulsante e una con permesso lo usa con esito; zero 403 dopo un clic nel giro | il permesso di ogni azione si legge dalla stessa mappa di S-1; prova E2E per pagina con due identità | B | l'agente vede le azioni che può compiere dallo stesso elenco (Q8) | V1 anomalie A386-A429 |
| S-6 | Scheda persona a metà fuori dalla catena (D-28): `GET /v1/users/:id/roles` risponde 404 nove volte per sette persone, altre parti 403, e la scheda resta mezza vuota; D-13 (parola d'errore per `TENANT_ADMIN`) si guarda insieme | `apps/api/src/modules/users/routes.ts:133-147`; `users/[userId]/page.tsx`; `_components/roles-editor.tsx:71`; `_components/identity-editor.tsx`; `users/page.tsx` | C | fuori catena la scheda mostra le sezioni visibili e, al posto delle altre, «non visibile: fuori dalla tua catena organizzativa»; nessuna chiamata parte per sezioni non visibili; giro con capo, `PEOPLE_MANAGER` e `TEAM_MEMBER` senza 404 né 403 | dentro lo stesso tenant l'esistenza della persona è già nota dalla rubrica, quindi la risposta giusta è 403 con codice `OUT_OF_SCOPE`. Guardia: prova che fuori tenant resta 404 | M: endpoint usato da più pagine | lo strumento MCP della scheda restituisce la stessa risposta strutturata | V12 (D-26 del file); V9 (m) D-28 |
| S-7 | Il peso economico (`economicWeight`) e il titolare (`ownerUserId`) della posizione escono a chi non vede la classe `COMPENSATION`, mentre su un'altra rotta lo stesso dato è chiuso (D-03, decisione 5) | `apps/api/src/modules/positions/repository.ts:65`; `apps/api/src/lib/scope/mask.ts`; pagina `positions` | C+E | Enzo conferma la decisione 5 (raccomandata dall'analisi); prova di integrazione per i ruoli senza la classe: campi mascherati; il giro mostra il segno di maschera | `chi_sorveglia.py position_economic_weight`; prova vista rossa sul codice di oggi | M: è una retribuzione indiretta | lo strumento MCP delle posizioni maschera allo stesso modo | V4 D-03; V9 (b) decisione 5; V7 copertura riga 41 |
| S-8 | `PEOPLE_MANAGER` può scrivere su 13 risorse che non può leggere (persone, unità, competenze, ruoli, formazione e altre) | concessioni del ruolo (migrazioni dei permessi); controllo nuovo «chi scrive una classe la legge» | C | il controllo è rosso sui casi di oggi e verde dopo l'emendamento; giro con la persona `PEOPLE_MANAGER` | `PEOPLE_MANAGER` vede tutto il tenant per mandato (000432, D-01 ritirato): si allinea la lettura alla scrittura, non si restringe il mandato | M: tocca un mandato HR | stessa regola per l'agente | V4 D-08; V2 INC-03 |
| S-9 | La maschera del DPO campo per campo non è mai stata verificata; con essa la non-regressione della fuga del giugno (D-50) | prove di integrazione per ogni endpoint che restituisce `COMPENSATION`, `EVALUATION` o dati personali, con l'identità DPO | C | prova verde su ogni endpoint dell'elenco; giro con il DPO vero senza un valore in chiaro | l'elenco si ricava dalla classe dei campi nei contratti | M: un campo che sfugge è una fuga | il DPO agente ha la stessa maschera | V4 D-04; V4 LEGGIMI T-6; V7 debiti D-50 |
| S-10 | Endpoint senza guardia: per ognuno dei 19, e per le 12 rotte di catalogo senza `requirePermission`, pubblico per scelta o da proteggere | `/openapi.json`, `/healthz`, `/metrics`, `/readyz`, le rotte di accesso e di secondo fattore, `POST /v1/leads`, le tre di `whistleblowing` pubblico, `public/platform-stats`, `public/job-postings`; cataloghi di INC-18 | C | tabella dei 19 più i cataloghi con esito; `/metrics` e `/openapi.json` non esposti a Internet senza scelta scritta; limiti di frequenza sulle rotte pubbliche di scrittura | indagine prima, codice dopo | M: un endpoint pubblico è raggiungibile anche da agenti esterni | | V1 anomalie A002-A378; V2 INC-18 |
| S-11 | Contratti di risposta che dichiarano non nullo un campo che può essere nullo: diventano un 500 dell'intero elenco al primo dato | `SeedCandidateRecordSchema.tenantId`, `GdprRequestSchema.tenantId` in `packages/shared`; da verificare l'identificativo del partecipante in `apps/api/src/modules/me/routes.ts:825`, `surveys.totalInvitations` e i campi data | C | schemi resi nullabili dove la colonna lo è, con prova di contratto; P-8 verde | un commit tocca web e API insieme | B | il contratto è ciò che l'agente legge | V6 contratti.tsv righe 3, 4, 10, 11, 13 |
| S-12 | Errori leggibili e utili: oggi un 500 dice «Unexpected server error» e un 403 «Missing permission: …» in inglese, e il client stampa «Unable to reach the API», «Session expired», «HTTP 500» | `apps/api/src/middleware/errorHandler.ts:127-131` (codice `RESPONSE_CONTRACT_VIOLATION` quando la risposta non rispetta il contratto, sempre con `requestId`); `apps/api/src/middleware/rbac.ts:103-112`; client in `apps/web/src/lib/api`; mappa codice-messaggio italiano | C | ogni risposta d'errore ha codice, chiave del messaggio, `requestId`; la pagina mostra il messaggio italiano e l'identificativo da citare | prova di integrazione per 403, 422, 500 | B | condizione perché un agente capisca il fallimento e non riprovi a vuoto | V6 sintesi; V6 contratti riga 12; V6 prontezza righe 9-10; V6 formattazione righe 40-41 |
| S-13 | Il tetto dei 5.000 risultati risponde 500 | limitatore dei risultati dell'API; risposta 422 con codice e suggerimento di filtro o paginazione | C | prova: oltre il tetto risponde 422 con codice | si fa con A-10 | B | l'agente riceve un'istruzione invece di un errore | V6 sintesi; V6 prontezza riga 34 |
| S-14 | Parti visibili di ADR-0050: concessione di un mandato come atto (proposta, approvazione di un secondo titolare, effetto), esenzioni con scadenza e autore, nuova conferma del secondo fattore prima di aprire retribuzioni e valutazioni per mandato | `admin/roles/page.tsx`, `admin/mfa-policy/page.tsx`, `me/security/page.tsx`, dialogo comune di riconferma | C, dopo i passi di ADR-0050 | ogni passo dimostrato dal vivo con due titolari veri di mandato | dipende dalle consegne D3, D4, D5; qui non si duplica la logica | A: identificazione di chi vede tutto | l'agente non porta mandati (D6) e chiede la conferma alla persona | ADR-0050; V4 D-02; V10 temi 2 e 5; V5 sentinelle |
| S-15 | `/admin/mfa-policy` dà un esito parziale a tutti tranne `SECURITY_ADMIN`, pur essendo fuori dal loro menu | `admin/mfa-policy/page.tsx`; voce in `sys_ui_interfaces` | C | con S-1 la pagina dice «non hai accesso» a chi non ha il permesso | rientra in S-1 se la voce è giusta | B | | V12 osservazione |
| S-16 | Valutazioni di carriera e bacini di successione senza maschera: `PLATFORM_ADMIN` le legge in chiaro, mentre la matrice M1 maschera `EVALUATION` al mandato di piattaforma | `apps/api/src/modules/user-career-plans`, `apps/api/src/modules/succession-pools`; `apps/api/src/lib/scope/mask.ts` | C | prova di integrazione con `PLATFORM_ADMIN`: campi `EVALUATION` mascherati; giro (prova T-7) | prova vista rossa sul codice di oggi (nessuna chiamata di maschera nelle due cartelle) | A: dato di valutazione in chiaro a un mandato tecnico | stessa maschera per l'agente | V2 INC-14; V4 LEGGIMI T-7 |
| S-17 | `user:delete` è concesso a `HRMS_MANAGER` e `PEOPLE_MANAGER`, ma il servizio permette la cancellazione solo a `TENANT_ADMIN` e `PLATFORM_ADMIN`: gli altri ricevono 404 | `apps/api/src/modules/users/service.ts:103-108`; concessioni dei due ruoli | C+E | Enzo sceglie fra allineare il servizio alla regola di progetto (`HRMS_MANAGER` elimina qualunque dato di business) o togliere la concessione; poi prova e giro guidato | una cancellazione di persona è irreversibile: prova solo sul banco; si lega ad ADR-0050 D4 | A | un agente non cancella persone senza la conferma della persona | V2 INC-13; V4 LEGGIMI T-4; `.claude/rules/regole-di-progetto.md` |
| S-18 | `gdpr:retention` è concesso a `TENANT_ADMIN`, `HRMS_MANAGER`, DPO e `PLATFORM_ADMIN`, ma il servizio risponde `PLATFORM_ONLY` a chi non è `PLATFORM_ADMIN` | `apps/api/src/modules/gdpr/service.ts:159`; concessioni | C | concessione e servizio dicono la stessa cosa (decisione C di Enzo: il DPO fuori dal mandato GDPR di piattaforma); prova | migrazione piccola | B | | V2 INC-12; V7 debiti D-63 |
| S-19 | Voci di menu che chiedono un permesso diverso da quello che la pagina usa: `/admin/roles` chiede `role:read` ma chiama `role_matrix:read` (il CEO vede la voce e riceve 403, `SECURITY_ADMIN` il contrario); `/approvals` chiama anche `user:read`; `/skills` chiama `matching:read` | `sys_ui_interfaces`; `admin/roles/page.tsx`; `approvals/page.tsx`; `skills/page.tsx` | C | P-7 verde su questi casi; giro con CEO e `SECURITY_ADMIN` | | B | | V2 INC-10, INC-11 |
| S-20 | Il capo vede l'importo della retribuzione dei suoi o solo la fascia? La decisione di Enzo del 2026-08-04 dice `read`, la matrice M1 nel codice dice `mask` («fascia sì, importo esatto no») | `apps/api/src/lib/scope` (matrice M1); ADR-0036 | E, poi C | Enzo conferma una delle due; il codice e l'ADR dicono la stessa cosa; prova T-2 con un capo vero | decisione di prodotto | M | l'agente di un capo eredita la scelta | V2 INC-01; V4 LEGGIMI T-2 |
| S-21 | Permessi che nessuna rotta usa (34) e concessioni presenti in produzione che le migrazioni non spiegano (72) | catalogo dei permessi; `docs/kb/tools/check_permessi_inutili.py` nuovo | C | elenco con esito per ciascuno: usato dal menu o dai cruscotti, da ritirare, da spiegare con una migrazione | ritirare un permesso segue ADR-0035 (si emenda il file che lo crea) | M | meno permessi, meno superficie per l'agente | V2 INC-15; V4 concessioni_attese_vs_reali.tsv |
| S-22 | Liste di ruoli scritte nel codice, contro ADR-0036 §1 («nessuna lista di ruoli decide»): `ADMIN_ROLES` in `layout.tsx:163`, `role-precedence.ts`, commenti superati su `PLATFORM_ASSIGNED_MANDATE_ROLES` | `apps/web/src/app/(authenticated)/layout.tsx`; `apps/web/src/lib/role-precedence.ts`; `apps/api/src/lib/scope/resolver.ts` | C | nessuna decisione di interfaccia legata a una lista di ruoli; i commenti dicono il vero | | B | | V2 INC-08, INC-16; V7 debiti D-68 |
| S-23 | Scritture e letture da verificare sul perimetro: `MANAGER` scrive posizioni, unità, incarichi, valutazioni e persone (va provato che non lo fa sulla catena sorella); `USER` e `READ_ONLY` leggono persone, tenant e blueprint affidandosi al filtro dei servizi | prove di integrazione sui servizi coinvolti | C | prova T-3: PATCH su una posizione della catena sorella respinto; letture di `USER` limitate a sé | prove sul banco, mai in produzione | M | l'agente di un capo ha lo stesso confine | V2 INC-23, INC-24; V4 LEGGIMI T-3 |
| S-24 | Le valutazioni restituite a `MANAGER` e ai capi portano l'identificativo del valutatore e di chi ha deciso un'eccezione, che possono stare fuori dalla catena; verificato solo sul codice | `apps/api/src/modules/performance-reviews/repository.ts:12-20`; pagina `performance` | C | verificato riga per riga sul banco; se il nome del valutatore fuori catena non serve al capo, si mostra il ruolo e non la persona | lettura sul banco | B | | V12 punto 3 |
| S-25 | Chiamate negate all'apertura delle pagine: nel giro del 2/11 ogni persona ne riceve da 28 a 82 (per esempio DPO 82, `BRANCH_MANAGER` 79, `SECURITY_ADMIN` 78), su advisor, analytics, compensation, insights, talent-review e altri; ognuna è un riquadro vuoto o un errore nascosto | pagine che chiamano endpoint fuori dal permesso del ruolo; elenco per pagina e persona da `chiamate.tsv` del giro sulla VM | C | P-3 conta zero 403 all'apertura per ogni persona | prima la misura per pagina, poi una correzione per gruppo di pagine; si appoggia a P-7 | B | | V12 ESITI_GREZZI_PARTE2; V4 pagine_attese_vs_viste.tsv |

### 6.2 Difetti visibili (lotti L4, L5)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| V-1 | D-27: le approvazioni si fermano a 200 su 741, senza dirlo | `packages/shared/src/schemas/approvals.ts:141-145` (cursore, `sortBy`, totale); rotta delle approvazioni; `approvals/page.tsx:52`; `me/approvals/page.tsx` | C | la pagina mostra «741 approvazioni», si sfoglia fino all'ultima, si filtra per stato, processo e attività; il conteggio coincide con l'API nel giro | contratto, API e pagina in un solo commit; prova con più di 200 righe sul banco | M: pagina molto usata | stesso cursore per lo strumento MCP | V12 (D-24 del file); V9 (m) D-27 |
| V-2 | La scelta della persona nelle approvazioni carica 200 utenti e basta (oggi sono 167, il difetto non si vede ancora) | `approvals/page.tsx:64`; campo di ricerca con suggerimenti | C | si trova qualunque persona del perimetro digitando tre lettere | riusa M-1 se pronta, altrimenti un filtro `q` sulla lista utenti | B | lo strumento di ricerca dell'agente usa lo stesso filtro | V12 |
| V-3 | Una colonna «processo e attività» nelle approvazioni (ADR-0049) e il «per conto di» quando decide un delegato (ADR-0051) | `approvals/page.tsx`, `approvals/[id]/page.tsx`, contratto della lista | C | ogni approvazione dice processo, attività e, se c'è, il delegante | dati presenti dal 27/10 (ADR-0049) e dal 1/11 (000468) | B | l'agente filtra per processo | V7 lacune; V7 debiti ADR-0049; V10 tema 9 |
| V-4 | D-23: il logo porta al login (`/app` rimanda a `/login`, e il login non rimanda avanti chi è già entrato); il commento di `/app` promette un comportamento che la radice non ha | `apps/web/src/app/app/page.tsx`; `apps/web/src/app/login/page.tsx:100-212`; in `ux-design-shared`, proprietà `homeHref` di `DashboardHeader` | C | clic sul logo porta alla pagina iniziale del profilo per 14 persone su 14 | rimedio dentro advanced subito: `/app` calcola la pagina iniziale dalla sessione | B | | V4 D-23; V12 (D-25 del file); V2 INC-19; V1 A384, A385 |
| V-5 | D-11: `enterprise-typing` manda POST dove l'API accetta solo GET, PUT, DELETE: il salvataggio non può funzionare | `tenants/[tenantId]/enterprise-typing/page.tsx:64` | C | il salvataggio funziona dal vivo con la persona che ne ha il permesso | prova E2E del salvataggio | B | lo strumento MCP usa il verbo giusto | V4 D-11; V1 A001; V6 formattazione riga 47 |
| V-6 | D-13: parola d'errore su `/users/:id` per `TENANT_ADMIN` con chiamate in 200: un testo o una chiamata secondaria | `users/[userId]/page.tsx` e componenti | C | rimisurato; corretto o chiuso con la prova | si guarda con S-6 | B | | V4 D-13; V4 pagine_attese_vs_viste |
| V-7 | Importo di straordinario mancante mostrato come zero (`?? 0`) | `analytics/overtime/page.tsx` | C | dato assente mostrato come «non disponibile» | | B | l'API distingue `null` da 0 | V6 formattazione riga 21 |
| V-8 | Scarto percentuale in `compensation-intelligence` con minimo zero | `compensation-intelligence/page.tsx:435` | C | confermato dal giro che non succede più, oppure corretto | il codice di oggi sembra già protetto | B | | V6 formattazione riga 19 |
| V-9 | Testi inglesi in pagine italiane: paginazione di `/dashboard/tenant`, testi di `system-health` («req», «ms avg»), intestazioni GENERATED, CONFIRMED, SUPERSEDED di `generated-origins` e VALID di `provenance` | file citati; chiavi di traduzione | C | nessuna parola inglese nel giro su queste pagine | anticipata rispetto a L6 perché si vede | B | | V6 VIVO; V6 formattazione righe 24, 25, 27 |
| V-10 | Stati grezzi nelle pagine di `tenant-blueprints` | `tenant-blueprints/**` | C | etichette italiane per ogni stato | etichette dal dato, non scritte nella pagina | B | l'API restituisce codice ed etichetta | V6 formattazione riga 29 |
| V-11 | Grafici con assi senza nome né unità | `me/analytics`, `engagement`, `analytics/attendance`, `analytics/overtime`; componenti in `_charts-client.tsx` | C | ogni asse ha nome, unità e scala; ogni grafico ha una tabella equivalente | coordinare con `@heuresys/ui` se il componente sta lì | B | la tabella equivalente è leggibile anche dall'agente | V6 formattazione righe 35-37; V9 (j) 13 |
| V-12 | D-24: il layout richiama `/auth/me` e `/me/interfaces` 110 volte per persona e `/me/permissions` 17-19 volte | `apps/web/src/app/(authenticated)/layout.tsx`; cache delle letture di sessione | C | una lettura per sessione e una per cambio di permessi; il giro conta le chiamate | | B | meno carico anche per il gateway | V4 D-24; V9 (m) |
| V-13 | D-25: `/mfa-policy/` con la barra finale risponde vuoto | configurazione delle rotte (`trailingSlash`) o rimando | C | con e senza barra finale la pagina è la stessa | | B | | V4 D-25 |
| V-14 | Il CEO ha `dashboard_company:view` ma non `dashboard:view`, quindi dopo l'accesso arriva su `/me` e non sul cruscotto aziendale | `apps/web/src/lib/landing.ts` | C | prova T-1: il CEO vero arriva sul cruscotto aziendale | | B | | V2 INC-20; V4 LEGGIMI T-1 |
| V-15 | La pagina di costruzione dei blueprint chiama un POST (`build-plan`) come lettura all'apertura: non scrive più (D-22 corretto), ma per un agente un POST è una scrittura da approvare | `tenant-blueprints/[id]/versions/[n]/build/page.tsx`; rotta `build-plan` | C | la lettura diventa un GET; il POST resta solo per costruire | | B | l'agente non chiede approvazione per leggere | V4 D-22; V6 formattazione riga 46; V6 prontezza riga 25; V10 tema 13 |
| V-16 | Dati scritti nelle pagine al posto di dati vivi, o pulsanti senza azione | `/` (due pulsanti senza azione), `me/analytics` (4 indicatori), `me/approvals` (3 statistiche), `me/surveys` (un pulsante), `performance` (6 indicatori), `tenant-blueprints/[id]/versions/[n]/build` (9 righe) | C | per ognuno: se è un dato, viene da `/v1/*`; se è una configurazione di etichette, lo dice il codice; nessun pulsante senza azione | regola del progetto: nessun mock nel frontend | B | | V1 anomalie A379, A400-A403, A427 |

### 6.3 Forma: lingua, numeri, date, stati, accessibilità (lotti L6, L7)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| F-1 | Un solo modo di formattare: date, ore, numeri, valute (con la valuta del dato, non EUR scritto), percentuali, durate, nella lingua scelta nel portale | modulo nuovo in `apps/web/src/lib/format`; le 37 chiamate `toLocale*` senza lingua; `users/[userId]` e `roles-editor`, `performance`, `me/security`, `me/analytics`, `visualizations`, `time-off`, `me/time-off`, `recruiting/applications/[id]`, `compensation-intelligence`, `investors`, `generated-origins`, `talent-review`, `provenance`, `tenant-blueprints/.../build` | C | P-2 verde su tutto `apps/web`; giro: zero date grezze, zero decimali col punto, zero numeri senza separatore | tre PR per area (persone, organizzazione, analisi) | B | l'API resta in formato standard; la forma è compito della pagina | V6 formattazione righe 4-15, 18, 22-23, 26, 28; V6 VIVO |
| F-2 | Codici grezzi a vista (312 nel giro, fra cui il tipo di contratto nelle candidature) | dizionari di etichette dai cataloghi `sys.*` con traduzione | C | zero codici grezzi nel giro | | B | l'API restituisce codice ed etichetta | V6 VIVO; V6 formattazione riga 14 |
| F-3 | UUID a vista (80 nel giro; 26 punti nel codice ne mostrano la testa, 6 come unica informazione; il registro eventi di `system-health` li mostra interi) | `gaps`, `me/gaps`, `positions/[positionId]/learning`, `system-health` e gli altri punti di V6; area «dettagli tecnici» richiudibile | C | zero UUID nel testo normale | | B | l'agente continua a ricevere gli identificativi | V6 formattazione righe 30-31 |
| F-4 | Messaggi d'errore in inglese dalle eccezioni | tutte le pagine che stampano `e.message`; mappa di S-12 | C | nessun messaggio inglese nel giro con errori provocati sul banco | dipende da S-12 | B | | V6 formattazione righe 40-41 |
| F-5 | Stati uniformi: caricamento, vuoto con motivo, non autorizzato con motivo, errore con codice; indicatori visivi semplici dove servono | componente comune (in `@heuresys/ui` se esiste lì) | C | ogni pagina di prodotto usa lo stesso componente; giro con schermata per stato | | B | | V9; V8 raccolta (Zucchetti) |
| F-6 | Accessibilità WCAG 2.2 AA su tutte le pagine di prodotto, e una dichiarazione di accessibilità (nessun fornitore ne ha una) | `axe` nella suite E2E estesa alle 109 pagine di prodotto; navigazione da tastiera; contrasto | C | zero violazioni gravi o critiche; elenco delle minori con data; dichiarazione pubblicata | prima la misura, poi correzioni a gruppi | M: molte pagine | un'interfaccia accessibile si legge meglio anche da un agente che usa il browser | V8 matrice riga 43; V8 raccolta; V7 debiti D-27 |
| F-7 | Pagine personali (`/me`) usabili da telefono, con le regole di sicurezza di un'app (nessun dato personale salvato sul dispositivo) | `apps/web/src/app/(authenticated)/me/**`; prova E2E a schermo stretto | C | le pagine `/me` passano a 390 pixel senza scorrimento orizzontale; nessun dato personale nella cache del browser | | B | | V8 matrice riga 33; V8 raccolta (Workday, TeamSystem) |
| F-8 | Due convenzioni per le percentuali (0-100 e 0-1 per 100) | `okrs`, `goals`, `projects/[id]`, `me` e le pagine di ricerca semantica | C | una sola convenzione, scritta in F-1 | | B | l'API dichiara la scala nel contratto | V6 formattazione riga 34 |
| F-9 | Due vocabolari per i cruscotti: il menu usa codici italiani (`azienda`, `organizzazione`, `processi`), il catalogo API inglesi (`company`, `org`, `process`) | `dashboard/[famiglia]/page.tsx`; catalogo dei cruscotti | C | un solo codice per cruscotto, uguale nel menu, nell'API e nel giro | | B | l'agente chiama il cruscotto con lo stesso codice del menu | V4 D-19; V6 formattazione riga 39; V4 pagine_attese_vs_viste |

### 6.4 Prontezza agentica (lotti L8, L9, L10)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| A-1 | L'API distingue l'agente dalla persona: ogni chiamata dell'agente porta `actor_type=agent`, l'identità dell'agente e la persona per cui agisce; il registro di audit li conserva tutti e due (decisione 7 del rapporto, ora ADR-0050 D6 e ADR-0051 §6) | autenticazione dell'API, `apps/agent-gateway`, registro di audit | C | ogni scrittura di un agente si legge nel registro con agente e persona; prova di integrazione | dipende dai passi di ADR-0050 | A: identità | è il fondamento | V4 prontezza M-1; V6 prontezza righe 15, 30; V9 (b) 7 |
| A-2 | Restringere l'agente sotto la persona, per compito | gettoni dell'agente con perimetro e permessi ridotti | C | prova: un agente con compito «leggere le approvazioni» non scrive | | M | | V4 prontezza M-2 |
| A-3 | La sessione dell'agente non porta il rinnovo | gettone breve, senza rinnovo | C | prova: scaduto il gettone, si ripassa dalla persona | | M | | V4 prontezza M-6 |
| A-4 | Il pavimento dell'area personale imposto da una sentinella a ogni ruolo nuovo (corretto per `HIRING_MANAGER` e `RECRUITER`, D-06), e l'agente di una persona con solo `USER` raggiunge solo `/v1/me/*` | sentinella nuova sul pavimento; regola nel gateway | C | sentinella vista rossa su un ruolo nuovo senza pavimento; prova dell'agente | | M | | V4 prontezza M-5; V4 D-06, D-09; V2 INC-06; V9 (j) 3 |
| A-5 | Deleghe usabili dagli agenti con ambito e scadenza (ADR-0051), dopo l'identità di A-1 | tabella delle deleghe, gateway | C | prova con una delega vera fra due persone | dipende da A-1 e G-10 | M | | V4 prontezza M-4; V6 prontezza riga 16 |
| A-6 | Soglie 25 e 40 del freno sul volume tarate solo su RTL | parametri per tenant (`soglie-persone.ts`) | C | soglie lette dal tenant, con il valore di RTL come predefinito | | B | | V4 prontezza M-7 |
| A-7 | Un agente per profilo: catalogo di agenti per ruolo e compito (i fornitori ne hanno: analista dell'organigramma, assistente del responsabile) | documento di progetto, poi configurazione | C+E | Enzo approva il catalogo | progettazione | M | | V4 prontezza M-3; V8 raccolta (Oracle, ServiceNow) |
| A-8 | Pannello dell'agente sulle pagine adatte (oggi una; le adatte sono 83 su 115), con i cambi proposti dall'agente sempre sottoposti a revisione umana | componente comune guidato da `sys_ui_interfaces`; oggi solo `approvals/[id]/page.tsx` | C | pannello presente sulle 83 pagine; dimostrazione dal vivo su tre pagine di tre profili | il pannello mostra solo ciò che la persona vede (ADR-0040) | M | | V7 ultimi_sviluppi e debiti #159; V8 raccolta (Oracle) |
| A-9 | OpenAPI accesa come prodotto: versionata, con descrizioni e identificativi di operazione, dietro autenticazione, generata dai contratti Zod, con uno strumento di scoperta | `apps/api/src/app.ts:239` | C+E | la specifica si scarica, è completa, e P-4 la usa | accenderla in produzione è decisione di Enzo | M | il contratto per chi integra | V6 prontezza righe 2-6; V8 integrabilita §9.1; V8 matrice riga 38 |
| A-10 | Qualità dell'API per gli agenti: cursore e `sortBy` ovunque, filtri standard, chiave d'idempotenza sulle POST, `ETag` e `If-Match` sulle modifiche, azioni atomiche, limiti di frequenza dichiarati | moduli API, a famiglie | C | i criteri assenti o parziali di V6 diventano presenti, misurati con la stessa griglia | un lotto per famiglia di moduli | M | un agente che riprova non duplica e non sovrascrive | V6 prontezza righe 7, 8, 12, 14, 23, 34 |
| A-11 | Mettere in servizio il gateway degli agenti sulla VM, con il diario nel database, e un punto MCP con i permessi della persona | `apps/agent-gateway`, unità di servizio | E | dopo A-1, A-2, A-3: acceso e dimostrato con una persona vera | è un rilascio nuovo: decide Enzo | A | | V6 prontezza riga 28; V9 (j) 9; V8 integrabilita §9.8; V8 raccolta (ADP, Celonis) |
| A-12 | Il diario dell'agente nel database: `v_agente_persone_per_conversazione` resta vuota finché il gateway scrive su file | gateway (`FileAuditSink` come ripiego) | C | la vista si popola alla prima conversazione vera | con A-11 | B | | V5 sentinelle §4; V5 agentica |
| A-13 | Aprire all'agente i perimetri in coda (#254, #214), con la sentinella dei dati di persona sempre a zero | gateway, perimetri | C | ogni perimetro aperto ha una prova e la sentinella resta vuota | | M | | V7 debiti #254, #214; V6 prontezza righe 26-27 |
| A-14 | Origine del dato (nativo, importato, ibrido) e classe del dato visibili in ogni pagina e risposta, oggi solo nel database (12 tabelle hanno `origine_dato`) | contratti e pagine; sentinella `v_direzione_del_dato_violata` | C | ogni elenco mostra l'origine; la sentinella resta a un caso noto o scende | | M | l'agente sa da dove viene ciò che legge | V9 (j) 10; V5 agentica; V7 debiti C5/C6/C8; I23 |
| A-15 | Prova dell'agente contro la persona: lo stesso agente fa le richieste di un `HRMS_MANAGER`, di un `MANAGER` e di un `HIRING_MANAGER`, con confronto campo per campo | prova sul banco | C | i corpi coincidono campo per campo | dopo A-11 | B | | V4 LEGGIMI T-12 |
| A-16 | Strumenti MCP provati dal vivo per gli endpoint solo API di maggior valore: valutazioni, misure KPI, predizioni, processi del tenant | gateway | C | quattro strumenti dimostrati con persone vere | | M | | V9 (j) 9 |

### 6.5 Funzioni senza pagina (lotto L11 e seguenti, un lotto per riga o per coppia)

Le righe G-1..G-33 vengono una per una dalle 33 funzioni che V7 `copertura.tsv` dichiara «solo API», «solo dati» o «assente». Per ognuna la prima mossa è la stessa: Enzo dice se la funzione serve al lavoro di un profilo (il ruolo segue il lavoro); se sì, si costruisce la pagina con il suo strumento MCP; se no, si scrive perché resta senza pagina.

| id | funzione | stato in V7 | chi | nota |
|---|---|---|---|---|
| G-1 | Sedi | solo API (5 sedi in RTL) | C | scheda in `organization` |
| G-2 | Storia organizzativa delle unità | solo API (406 righe) | C | scheda nel dettaglio dell'unità |
| G-3 | Assegnazione persona-posizione: incarichi e trasferimenti | solo API | C | azione dalla posizione e dalla persona, con approvazione |
| G-4 | Avviso gerarchia-livelli con motivazione scritta (#265) | solo API | C | in `organization` e `positions` |
| G-5 | Livelli di ordinamento e struttura del tenant (#266, Direzioni di controllo, Divisione Risk & Compliance duplicata) | solo dati, `WAIT-INPUT` | E | aspetta la scelta di Enzo sulla struttura di RTL |
| G-6 | Percorsi di carriera della posizione e rilevanza per la successione | solo API | C | nel dettaglio della posizione |
| G-7 | Dati contrattuali del personale (livello, CCNL, tipo di contratto), importati per ADR-0045 | solo dati | C | in sola lettura nella scheda persona, con l'origine (A-14) |
| G-8 | Preferenze di notifica (#39), notifiche personalizzate | solo API | C | `/me` |
| G-9 | Owner di processo: chi partecipa e quali attività (ADR-0044, ADR-0049) | solo API (`me/routes.ts:450`, `:457`) | C | `process-owner` |
| G-10 | Deleghe ricevute e conferite | solo API il 31/10; dal 1/11 c'è `/me/delegations` | C | verificare che la pagina copra conferire, ricevere, revocare, scadenza; giro dal vivo |
| G-11 | Privacy personale: esportazione dei propri dati e consensi (677 consensi in RTL) | solo API | C | `/me` e `/privacy` |
| G-12 | Mentorship, pulse, predizioni personali (#126) | solo API | C | `/me` |
| G-13 | Rilevazione presenze: timbrature, turni, giustificativi | assente | E | funzione nuova di prodotto, chiede una scelta di perimetro |
| G-14 | Calendario delle assenze del team e sostituzioni | assente | C+E | estensione di `time-off` e `me/time-off` |
| G-15 | Calcolo del cedolino e cicli paga | assente | E | i cedolini sono importati; il calcolo è fuori dal perimetro salvo scelta di Enzo |
| G-16 | Passaggio dei dati variabili alla paga | solo API | C+E | pagina di controllo per l'HR |
| G-17 | Peso economico della posizione | solo dati | C | dopo S-7, visibile solo a chi vede `COMPENSATION` |
| G-18 | Valutazione a 360 gradi e feedback continuo | solo API | C | `performance` |
| G-19 | Valutazioni comportamentali: metodi, prove, risultati (1.560 risultati in RTL) | solo API | C | `performance` o pagina propria |
| G-20 | Rischio di uscita e predizioni | solo API (468 predizioni) | C | `insights`, con la maschera della classe |
| G-21 | Inserimento e uscita: piani, liste di controllo, revoca degli accessi | assente | E | funzione nuova; decisione 12 del rapporto |
| G-22 | Feedback continuo e riconoscimenti | solo API (400 righe) | C | `engagement` |
| G-23 | Attività dei processi (131 fasi in RTL) ed editor delle regole richiesta-processo | solo API | C | `processes`; editor raccomandato dal rapporto |
| G-24 | Esecuzione dei processi: istanze, compiti, scadenze, automazioni | assente | E | funzione nuova di prodotto (vedi M-17) |
| G-25 | Contenuto v0.3 del modello: strategie, capacità, decisioni, entità legali, agenti | solo dati | C | lettura nel dettaglio del blueprint |
| G-26 | Registro dei ricevimenti dei pacchetti del datastore (000460) | solo dati | C | pagina per la Direttrice HR (P-5) |
| G-27 | Importazioni del tenant | solo API | C | pagina con stato e giornale |
| G-28 | Obblighi di conformità, registro degli adempimenti | solo dati | C+E | |
| G-29 | Console del DPO: registro dei trattamenti, richieste di accesso e cancellazione, retention | solo API | C | dopo S-18 |
| G-30 | Classificazione dei dati | solo API | C | per il DPO e per `SECURITY_ADMIN` |
| G-31 | Sincronizzazione dei riferimenti esterni (ESCO, ATECO) | solo API | C | per `PLATFORM_ADMIN` |
| G-32 | Consolidamento del tenant: avanzamento per gruppo di dati, abbinamenti, registro delle decisioni | assente il 31/10; `/consolidation` esiste dal 2/11 | C | verificare la copertura nel giro P-5 |
| G-33 | Deleghe per gruppo di dati (ambito `CONSOLIDATION`) | solo API | C | dentro `/consolidation` |

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| G-34 | Recupero della parola d'ordine | pagine di accesso | C | dimostrato con una persona vera | passa dalla posta (#8 in `HOLD`): verificare il servizio di invio | M | | V7 debiti #8 |
| G-35 | Stato «ereditato, conservato, segnalato» delle voci del tenant e contratto del fascicolo (ADR-0047, ADR-0048) | pagine `organization`, `positions`, `processes` | C | lo stato si vede su ogni riga | | B | l'API lo restituisce già | V7 debiti ADR-0047/0048 |
| G-36 | Pagine HR in sola lettura che devono poter scrivere: obiettivi, OKR, valutazione, coinvolgimento, ferie e permessi, revisione dei talenti, retribuzione, progetti | `goals`, `okrs`, `performance`, `engagement`, `time-off`, `talent-review`, `compensation-intelligence`, `projects` | C | una riga di attuazione per pagina, con la persona che ne ha il lavoro | otto lotti; l'ordine lo propone il giro P-5 | M | ogni scrittura nasce anche come strumento MCP | V7 lacune; V7 debiti #29, #32, #33 |
| G-37 | Le 29 azioni API senza pagina (creare una persona o una posizione, eliminare persone, posizioni, unità, KPI, moduli, categorie, percorsi; creare obiettivi, OKR, cicli di valutazione, notifiche; pubblicare contenuti) | elenco in V1 anomalie A027-A361 | C | ogni azione ha una pagina o una ragione scritta | le cancellazioni seguono S-17 | M | | V1 anomalie |
| G-38 | Endpoint orfani: 329 è un tetto, non una misura | `verifica_orfani.py` (V11) | C | misura vera, poi classificazione: da usare, da ritirare, per soli agenti | | B | un endpoint senza pagina può servire agli agenti: si scrive | V1 anomalie; V11 orfani_v1.tsv |
| G-39 | Schede di sezione scritte nel codice | `apps/web/src/components/section-tabs.tsx:28` | C | le schede vengono dal dato | primo passo verso K-1 | B | | V7 debiti D-66 |
| G-40 | File morto `language-switcher.tsx` | `apps/web/src/components/language-switcher.tsx` | C | ritirato | | B | | V1 anomalie A430 |
| G-41 | Dati che nessuna pagina mostra: 48 tabelle solo API e 8 solo dati (fra cui requisiti di competenza per occupazione, misure dei KPI, nove riquadri, storia delle posizioni) | elenco nell'allegato di copertura | C | per ogni tabella: pagina che la mostra, oppure ragione scritta (cancello di esposizione #79) | | B | | V5 copertura_tabelle.tsv; V7 debiti #79, D-33 |
| G-42 | Aree vuote: selezione (5 pagine e 13 endpoint su una riga), origini generate, contenuti multimediali; 57 tabelle vuote | | E | decisione 6 del rapporto: popolare, dichiarare non attiva con spiegazione, o ritirare | | B | | V9 (b) 6; V5 copertura_tabelle.tsv; V7 debiti #54 |
| G-43 | Attivazione di un blueprint nato dal pacchetto v0.2 e costruzione tracciata (#264, #198) | `tenant-blueprints/**` | C+E | | `GATED`; si guarda nel giro P-5 | M | | V7 debiti #264, #198 |
| G-44 | Consultazione dei fascicoli ricevuti e dei contenuti del modello (000458) | `content/[id]` e pagina nuova | C | | | B | | V9 (j) 11 |
| G-45 | Creazione di cicli di valutazione e di sondaggi | `performance`, `engagement` | C | | | B | | V9 (j) 11 |

### 6.6 Interfacce composte dai dati (lotto L12, con un ADR)

| id | cosa | file e pagine | chi | fatta quando | simulazione | rischio | agenti e API | fonte |
|---|---|---|---|---|---|---|---|---|
| K-1 | ADR: modello dei dati della composizione (pagina, sezione, componente, campo, azione), legato alla classe del dato e ai due assi, con varianti per tenant e preferenze personali (colonne scelte, viste salvate, ruoli di lettura e di autore dei cruscotti) | `docs/architecture/adr/` nuovo; voce del backlog | C+E | Enzo accetta l'ADR (V10 tema 8 aspetta il suo sì per registrarlo) | cambiamento architetturale: decide Enzo | M | l'agente legge la stessa composizione: sa che cosa la persona vede e può fare | V9 (l); V10 tema 8; V8 raccolta (SAP, Zucchetti) |
| K-2 | Prima attuazione su una famiglia già fatta di dati (`/dashboard/[famiglia]`), insieme ai cruscotti di settore del modello che oggi non arrivano all'interfaccia | migrazione, motore di disegno | C | una famiglia disegnata dal modello, dimostrata dal vivo | dopo K-1 | M | | V9 (l) |
| K-3 | Estensione alle altre famiglie, a lotti | | C | | | M | | V9 (l) |

### 6.7 Confronto con il mercato (lotti dopo L12, ciascuno con una decisione di Enzo)

| id | cosa | chi | nota | fonte |
|---|---|---|---|---|
| M-1 | Ricerca globale di persone, posizioni, unità, processi e azioni, nel perimetro di chi cerca (ADR-0046), con profili da rubrica | C | strumento MCP di ricerca | V8 matrice riga 11; V8 raccolta (SAP, Workday, Oracle) |
| M-2 | Storia della posizione con modifiche passate e future (il modello è centrato sulla posizione, I1) | C | | V8 matrice riga 5 |
| M-3 | Organigrammi distinti di posizione e di successione, con colonne scelte | C | | V8 matrice riga 3 |
| M-4 | Gestione dei casi HR con base di conoscenza e riassunto dei casi | C+E | funzione di prodotto | V8 matrice riga 31 |
| M-5 | Firma elettronica dei documenti | E | fornitore e spesa | V8 matrice riga 32 |
| M-6 | Credenziali per applicazione, revocabili, con risorse scelte | C+E | | V8 integrabilita §9.2; V6 prontezza riga 22 |
| M-7 | Identificativi esterni e sistema d'origine sulle entità sincronizzabili | C | | V8 integrabilita §9.3 |
| M-8 | Importazione con prova a secco e giornale di annullamento, ed esportazione completa | C | | V8 integrabilita §9.4; V6 prontezza riga 24 |
| M-9 | Eventi e webhook in uscita, firmati, con registro di consegna | C | | V8 integrabilita §9.5; V6 prontezza riga 18 |
| M-10 | SCIM in ingresso e accesso unico OIDC o SAML (#52) | C+E | fornitore d'identità del cliente | V8 integrabilita §9.6; V6 prontezza righe 19-21, 33 |
| M-11 | Connettori: JetHR, poi SuccessFactors, Workday, Zucchetti e TeamSystem (decisione 8 del rapporto) | E | scelta commerciale | V8 integrabilita §9.7; V9 (b) 8 |
| M-12 | Assistente conversazionale nelle pagine (oltre al pannello A-8) | C+E | | V8 matrice riga 34 |
| M-13 | Mappa verso HR Open Standards | C | | V8 integrabilita §9.9 |
| M-14 | Registro delle integrazioni: chi ha letto o scritto che cosa, per tenant e applicazione | C | | V8 integrabilita §9.10 |
| M-15 | Benchmark esterni nell'analisi | E | fonte di dati | V8 matrice riga 24 |
| M-16 | Pianificazione e simulazione dell'organico e del costo del personale | C+E | | V8 matrice righe 6, 25; V8 raccolta (JetHR) |
| M-17 | Modellazione e simulazione dei processi, conformità e process mining | E | | V8 matrice righe 27, 29 |
| M-18 | Marketplace di applicazioni | E | | V8 matrice riga 39 |
| M-19 | Pagina iniziale per ruolo con compiti e azioni rapide, da verificare per ogni profilo | C | | V8 matrice riga 8 |
| M-20 | Tenere il vantaggio della posizione come entità primaria e accompagnare le dimostrazioni con una guida d'adozione | C+E | | V9 (j) 16 |
| M-21 | Spiegazione della busta paga con avviso di possibile errore | C+E | | V8 raccolta (JetHR) |
| M-22 | Report standard e personalizzabili | C | | V8 raccolta (ADP, Personio) |
| M-23 | Percorsi guidati per gli eventi di lavoro (assunzione, trasferimento, cambio di posizione) | C | | V8 raccolta (Workday, SAP) |
| M-24 | Azioni di massa con anteprima | C | segue le regole delle scritture di massa | V8 raccolta (UKG, ServiceNow) |
| M-25 | Avvisi, circolari e presa visione delle policy | C | | V8 raccolta (ADP, Zucchetti, TeamSystem) |
| M-26 | Campi personalizzati del tenant | C+E | si lega ad ADR-0048 | V8 raccolta (ADP, JetHR) |

## 7. I lotti e l'ordine proposto

L'ordine segue la richiesta: prima sicurezza e permessi, poi i difetti visibili, poi la prontezza agentica, poi le lacune rispetto al mercato. Il coordinatore lo può cambiare.

| lotto | voci | rilascio | dipende da |
|---|---|---|---|
| L0 | P-1, P-2, P-3, P-4, P-7, P-8 (P-5, P-6, P-9 vanno a Enzo) | no: sono strumenti | sì di Enzo all'opzione A |
| L1 | S-1, S-3, S-4, S-5, S-15, S-19, S-22 | sì | L0 |
| L2 | S-6, S-7, S-9, S-11, S-16, S-24 | sì | L1; decisione 5 per S-7 |
| L3 | S-8, S-10, S-12, S-13, S-18, S-21, S-23, S-25, F-4 | sì | L1 |
| L4 | V-1, V-2, V-3, V-12 | sì | L3 |
| L5 | V-4, V-5, V-6, V-7, V-8, V-9, V-10, V-11, V-13, V-14, V-15, V-16 | sì | L1 |
| L6 | F-1, F-2, F-3, F-8, F-9 (tre PR per area) | uno alla fine | L5 |
| L7 | F-5, F-6, F-7 | sì | L6 |
| L8 | S-14, S-17, S-20, S-2 | sì | passi di ADR-0050; decisioni di Enzo su S-17, S-20, S-2 |
| L9 | A-1, A-2, A-3, A-4, A-5, A-6 | sì | ADR-0050 D6 |
| L10 | A-8, A-9, A-10, A-12, A-13, A-14, A-15, A-16 (A-7 e A-11 vanno a Enzo) | per famiglia | L9 |
| L11 | G-1 ... G-45, una PR per riga o per coppia | una per riga | L1; giro P-5 |
| L12 | K-1, K-2, K-3 | sì | ADR accettato |
| L13 | M-1 ... M-26 | per voce | decisione di Enzo per voce |

## 8. Decisioni che il piano chiede a Enzo

Raccolte in un posto solo, per non spargerle. Ognuna ha la raccomandazione.

| n | decisione | raccomandazione | voce |
|---|---|---|---|
| 1 | Ambiente di prova | opzione A, banco usa-e-getta per lotto | P-1 |
| 2 | Giro guidato sulle pagine dei mandati | 30 minuti con la sua identità | P-5 |
| 3 | Titolari dei quattro ruoli vuoti | assegnarli dove il lavoro lo chiede, ritirare gli altri | P-6 |
| 4 | Peso economico delle posizioni (decisione 5 del rapporto) | mascherare | S-7 |
| 5 | Nove pagine con voce disattivata | decidere pagina per pagina | S-2 |
| 6 | Cancellazione delle persone per `HRMS_MANAGER` | allineare il servizio alla regola di progetto, con l'atto di ADR-0050 D4 | S-17 |
| 7 | Il capo vede importo o fascia | confermare la decisione del 2026-08-04 (importo) o la matrice (fascia) | S-20 |
| 8 | `/demo` e `/investors` | tenerle fuori dal prodotto, su un sito di comunicazione | S-4 |
| 9 | Selezione, origini generate, contenuti multimediali (decisione 6 del rapporto) | dichiarare non attive finché un cliente non le usa | G-42 |
| 10 | Modello dati della composizione | registrarlo nel backlog e scrivere l'ADR | K-1 |
| 11 | Gateway in servizio e OpenAPI accesa | dopo A-1, A-2, A-3 | A-9, A-11 |
| 12 | Funzioni nuove di prodotto (presenze, paghe, inserimento, esecuzione dei processi) e scelte commerciali (connettori, firma, benchmark) | una alla volta, con costo e rischio scritti prima | G-13, G-15, G-21, G-24, M-5, M-11, M-15 |

### 8.1 Esiti delle decisioni

Enzo risponde una decisione alla volta, nel thread «Decidere S-17, S-20, S-2, P-5, P-6 e privacy@». Ogni esito si attua nel lotto della sua voce.

| voce | data e ora (Roma) | scelta di Enzo | che cosa si attua |
|---|---|---|---|
| S-17 | 2026-11-05 16:27 | la Direttrice HR (`HRMS_MANAGER`) disattiva una persona, il People Manager no | `canActOnTarget` ammette `delete` anche per `HRMS_MANAGER` del proprio tenant; una migrazione toglie `user:delete` a `PEOPLE_MANAGER`; prova sul banco. La cancellazione fisica resta limitata a chi non ha storia (ADR-0037). Manca ancora una via di riattivazione: oggi tornare indietro richiede un intervento tecnico. |
| S-20 | 2026-11-05 16:28 | il capo vede fascia e importo esatto della retribuzione delle sole persone della propria catena: conferma la decisione del 2026-08-04 (ADR-0036 §4 punto 1) | la matrice M1 (`apps/api/src/lib/scope/matrix.ts`, `line_management.COMPENSATION`) passa da `mask` a `read`; restano le eccezioni di ADR-0036 §5 (retribuzione dei vertici); prova T-2 con un capo vero; l'agente del capo eredita la stessa cella. |
| S-2 | 2026-11-05 16:29 | nessuna delle nove pagine si ritira; si riordinano | voci di menu proprie per `/compensation-intelligence`, `/insights/skill-gap`, `/insights/succession-readiness`, `/kpis`; `/gaps` diventa una scheda di `/insights/skill-gap`; `/analytics/org-network`, `/analytics/overtime`, `/analytics/skills-by-category`, `/analytics/skills-group-share` diventano le quattro schede di una pagina «Analisi delle persone»; gli indirizzi vecchi rimandano alla nuova sede; ogni pagina ha il suo strumento di lettura per l'agente; i permessi restano quelli degli endpoint. |
| P-5 | 2026-11-05 16:32 | il giro non lo fa Enzo: lo fa Claude con un'utenza di prova temporanea che porta il mandato, poi eliminata (proposta di Enzo) | l'utenza nasce solo su un banco usa-e-getta (copia della produzione, opzione A), mai in produzione, perché ADR-0050 D2 vieta mandati alle utenze di collaudo in produzione; ha un secondo fattore vero (TOTP) e nessuna esenzione; il giro copre `/org-director` e sottopagine, `/consolidation`, `/tenant-blueprints`, `/recruiting` senza premere azioni che scrivono; a fine giro il banco si chiude e l'utenza sparisce con lui; gli esiti diventano voci del piano. |
| P-6 | 2026-11-05 16:34 | `RECRUITER`, `HIRING_MANAGER` e `BLUEPRINT_MANAGER` vanno a persone vere di RTL il cui posto ne giustifica il lavoro; `READ_ONLY` si ritira | Claude propone a Enzo i nomi, con la posizione che li giustifica, prima di ogni concessione; le concessioni seguono ADR-0050 D4; il ritiro di `READ_ONLY` segue ADR-0035 (si emenda la migrazione che lo crea, poi si toglie l'esemplare); la visita al tenant di piattaforma entra nel giro di P-5. |
| P-6, nomi | 2026-11-05 17:21 | `BLUEPRINT_MANAGER` a Paolo Barbieri (Ufficio Sviluppo, Formazione e Organizzazione); `RECRUITER` a Beatrice Russo (stesso ufficio, Divisione Risorse Umane e Organizzazione); `HIRING_MANAGER` resta senza titolare: aprire una posizione e scegliere il candidato è responsabilità della Divisione HR, che con i mandati della direttrice lo copre già | nomi letti dalla copia del 3/11 (nome, posto, unità; autorizzazione scritta di Enzo delle 16:47), da ricontrollare in produzione prima della concessione; concessione secondo ADR-0050 D4. Il ruolo `HIRING_MANAGER` oggi non apre posizioni né fa offerte: se un giorno servisse, va ridisegnato. |
| privacy@ | 2026-11-05 16:37 | due indirizzi distinti, `privacy@heuresys.com` per i diritti GDPR e `accessibilita@heuresys.com` per le barriere d'uso; per sviluppo e verifica sono inoltri del dominio verso la casella Google Workspace personale di Enzo (la stessa degli inoltri `info@` e `marketing@`), le caselle vere verranno dopo | il dominio usa già l'inoltro di Porkbun (record MX `fwd1.porkbun.com`, `fwd2.porkbun.com`, letti il 2026-11-05 con `curl -s "https://dns.google/resolve?name=heuresys.com&type=MX"`): Enzo crea i due inoltri sul pannello di Porkbun; la dichiarazione di accessibilità indica `accessibilita@`; l'informativa privacy resta su `privacy@`. In seguito un agente legge le due caselle, prepara le bozze e tiene la scadenza dei 30 giorni; la risposta la manda una persona. Per distinguere le due provenienze in Gmail due filtri di Gmail mettono l'etichetta (`to:privacy@heuresys.com`, `to:accessibilita@heuresys.com`, con `deliveredto:` sull'indirizzo con il «+» se l'inoltro lo usa). Inoltri creati da Enzo su Porkbun il 2026-11-05 alle 16:47. |

## 9. Registro delle scoperte fuori ciclo

Ciò che emerge strada facendo va qui e si propone una volta sola a Enzo come «fuori da questo ciclo: lo vuoi nel prossimo?».

- Il CLAUDE.md di advanced indica ancora il linux-pc come gemello per le prove (tabella «Dove si esegue il lavoro sul database»); il coordinatore dice che quel database è fuori perimetro dal 2026-10-25 e che il gemello vivo è stato scartato il 2026-11-01. Il CLAUDE.md va riallineato.
- Due sentinelle di dati hanno righe note: `v_direzione_del_dato_violata` (1, una tabella «nativa» con 20 righe da seed storico) e `v_registro_provenienza_orfano` (11 tabelle). Non sono interfaccia; la prima entra in A-14, la seconda resta informativa.

## 10. Copertura: ogni pagina, ogni difetto, ogni rilievo ha una voce o un motivo

La copertura si misura con un comando, che legge le tabelle dell'analisi riga per riga e le pagine di `main`, e scrive `docs/piani/copertura_interfacce/copertura.tsv` (una riga per rilievo: fonte, riferimento, oggetto, esito, voci del piano, motivo dell'esclusione):

    python3 docs/piani/copertura_interfacce/costruisci_copertura.py /mnt/project-files/analisi-interfacce/

Il comando esce con 1 se resta anche una sola riga «DA-CLASSIFICARE». Esito del 2026-11-03, sul ramo di questo piano:

| fonte | righe | con voce | escluse con motivo | da classificare |
|---|---|---|---|---|
| pagine di `main` | 131 | 131 | 0 | 0 |
| difetti D-01..D-28 | 28 | 22 | 6 | 0 |
| V2 incoerenze | 24 | 21 | 3 | 0 |
| V1 anomalie | 430 | 430 | 0 | 0 |
| V4 pagine attese contro viste | 1.755 | 55 | 1.700 | 0 |
| V4 concessioni attese contro reali | 1.213 | 314 | 899 | 0 |
| V6 formattazione | 46 | 34 | 12 | 0 |
| V6 contratti | 13 | 8 | 5 | 0 |
| V6 prontezza per gli agenti | 34 | 26 | 8 | 0 |
| V7 copertura funzionale | 91 | 33 | 58 | 0 |
| V7 debiti | 56 | 30 | 26 | 0 |
| V8 matrice delle funzioni | 42 | 23 | 19 | 0 |
| V8 integrabilità §9 | 10 | 10 | 0 | 0 |
| V8 raccolta (capacità non in matrice) | 24 | 23 | 1 | 0 |
| V5 copertura delle tabelle | 373 | 113 | 260 | 0 |
| V5 sentinelle | 5 | 3 | 2 | 0 |
| V6 misure dal vivo | 7 | 6 | 1 | 0 |
| V9 decisioni (b), raccomandazioni (j), sezione (l) | 25 | 23 | 2 | 0 |
| V10 registro dei temi | 19 | 15 | 4 | 0 |
| V4 mancanze per gli agenti M-1..M-7 | 7 | 7 | 0 | 0 |
| V4 prove dal vivo T-1..T-13 | 13 | 9 | 4 | 0 |
| V12 rilievi del giro con persone vere | 8 | 7 | 1 | 0 |
| totale | 4.354 | 1.343 | 3.011 | 0 |

Come leggere le esclusioni. Le più numerose non sono rilievi lasciati cadere ma righe che l'analisi stessa dà per buone: le righe «coerente» delle pagine attese, le concessioni «uguali», le tabelle già in interfaccia o tecniche, le funzioni già coperte, gli esiti «ok» di formattazione, contratti e prontezza. Le altre esclusioni hanno ciascuna il suo motivo scritto nel file: corrette in produzione (per esempio D-06, D-07, D-09, D-10, D-15, D-16, D-17, D-22 con i rilasci 103a6bcf e 215b6687), non difetti per decisione o per errore del giro (D-05, D-12, D-19, D-20, D-21, D-26 come difetto di oggi), oppure lavoro che appartiene a un altro thread o al datastore. Il conteggio per motivo si rifà con `cut -f6 docs/piani/copertura_interfacce/copertura.tsv | sort | uniq -c | sort -rn`.

Le pagine. Tutte le 131 pagine hanno almeno una voce. Le 109 di prodotto portano le voci trasversali (S-1 guardia, S-25 chiamate negate, F-1 forma, F-4 messaggi, F-5 stati, F-6 accessibilità, P-3 giro) e molte hanno anche voci specifiche; le 18 di vetrina, `/demo`, `/investors`, `/dev/agent` e `/app` stanno in S-4 e V-4. L'elenco pagina per pagina con le sue voci è nel file di copertura, righe con fonte «pagine di main».

## 11. Chiusura

Il 2026-11-03 alle 03:06 ora di Roma Enzo ha risposto «sì» nel thread del piano. Lo leggo come approvazione del piano con le raccomandazioni del §8 dove non serve altro: l'ambiente di prova è l'opzione A (decisione 1). Le decisioni 2-12 toccano scelte di prodotto, spese o cancellazioni, e si chiedono a Enzo una alla volta quando arriva il loro lotto.

Ordine del coordinatore: le unioni su `main` restano ferme finché il rilascio 636a51fa non è DEPLOYATO; poi si uniscono #152 e #153, si fa la copia di fase, e solo dopo parte il primo lotto. Intanto il lotto si prepara su un ramo, senza toccare la produzione né `heuresys_ci`.

CICLO DEL PIANO CHIUSO: il piano è approvato. L'attuazione è un ciclo nuovo, lotto per lotto.
