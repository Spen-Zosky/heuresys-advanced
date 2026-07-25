# Modo `bootstrap` — prima invocazione sul progetto

Serve una volta per progetto, e di nuovo solo se il piano risulta assente o incoerente. Il resto delle iterazioni entra da `resume`. Se `bootstrap` viene invocato quando il piano e' sano, non rifare il censimento: verifica, riporta, e passa a `resume`.

## 1. Apri la sessione come la aprirebbe Enzo

```bash
python docs/kb/tools/session_start.py --no-net
```

Un solo processo: menu register-driven + dashboard di salute in modalita' offline-fast. Se il tunnel e' giu' aggiungi `--no-db` e annota che i numeri DB non sono ri-derivati. Non leggere `SOT_BACKLOG.md` / `SOT_STATE.md` / `DEBT_REGISTER.md` in forma grezza qui: sono ~450KB in gran parte storici, e lo script li distilla gia'. Si aprono in drill-down, sul singolo item.

Se il tunnel :5433 non risponde, rialzalo prima di proseguire:

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
```

## 2. Verifica l'integrita' del piano — non rifarlo

Il censimento esiste gia': `docs/superpowers/specs/2026-07-25-zero-pending-plan.md`, costruito da dieci finder indipendenti su fonti disgiunte, consolidato e verificato da tre verificatori adversarial (497 voci grezze → 248 cluster, 0 perse, 0 inventate). Rifarlo da zero butterebbe la cosa piu' costosa che il progetto possiede. Quindi si **verifica**:

- il conteggio dei cluster corrisponde a quello dichiarato nell'intestazione del piano;
- ogni riferimento `dependsOn` risolve a un cluster esistente;
- le caselle spuntate hanno una nota di chiusura con evidenza, non solo la spunta;
- ogni cluster ha un `done when` che e' un comando, non una frase;
- ogni cluster ha una classe di raggio d'impatto in `zp.config.yaml` (se manca, il cluster non e'
  eleggibile per nessuna corsia — segnalalo, non indovinare la classe).

Un'incoerenza qui non e' un dettaglio: il loop seleziona i cluster **da questo file**, e un `dependsOn` rotto significa lavoro eseguito nell'ordine sbagliato senza che nessuno lo noti.

## 3. Aggiorna solo le fonti stale

Il censimento invecchia per fonte, non in blocco. Misura la staleness e ri-censisci **solo** cio' che si e' mosso: `git log --since` per path-glob sulle aree di codice, `gh run list` per la CI, `psql` per i gap runtime, `gh api` per gli alert di dipendenze. Le fonti immobili non si toccano.

Un censimento completo da zero si fa solo su richiesta esplicita, e prima si dichiara il costo nella forma prevista da R20 — «~N agenti, ~X token, procedo?» — perche' e' l'operazione piu' cara dell'intero impianto.

## 4. Ricostruisci la todo tracciabile

La todo non e' un elenco nuovo: e' la vista sui cluster eleggibili nella corsia corrente, ordinata come in `selection.md`. Scrivila in `.zp/todo.json` (macchina) e riflettila in `.zp/PROGRESS.md` (umana). Se una lista di lavoro esiste solo in conversazione, la prossima iterazione — che nasce smemorata — non la trovera'.

## 5. Dichiara le regole con cui opererai

Prima di toccare il primo cluster, scrivi in chiaro: corsia attiva e quali classi include, tetti di iterazioni e budget, perimetro del push autorizzato, condizione di uscita, e cosa farai quando un cluster richiede Enzo. Serve a Enzo, che legge da remoto e deve poter verificare in dieci secondi che stai operando dentro il perimetro che ha autorizzato — e serve a te, perche' una regola dichiarata all'inizio della sessione resta nel contesto per tutta la sessione.

Poi scrivi `.zp/last-outcome.json` e passa a `resume`.

---

# Modo `censimento` — ripartire da capo su un progetto che nel frattempo e' cresciuto

Il piano zero-pendenze e' una fotografia datata. Dopo settimane o mesi di sviluppo fatto da Enzo fuori dal loop, quella fotografia non descrive piu' il progetto: le pendenze chiuse non ci sono piu', ma soprattutto ne sono nate di nuove che nessun refresh incrementale conosce. A quel punto non si aggiorna il piano vecchio — se ne costruisce uno nuovo.

**Parte solo su richiesta esplicita** (`zp censimento ok`). Mai in automatico, mai dal turno di notte, mai come conseguenza di un `bootstrap` che trova il piano stale: e' l'operazione piu' cara dell'impianto e la decisione di pagarla e' di Enzo.

## Cosa fare

**1. Censimento su DUE assi. Nessuno dei due basta da solo.**

L'asse che il censimento del 2026-07-25 ha percorso e' quello delle **fonti**: dove le pendenze sono gia' scritte. E' necessario e non e' sufficiente, perche' trova solo cio' che qualcuno ha gia' annotato. Il secondo asse e' quello delle **superfici**: dove le pendenze possono nascondersi anche se nessuno le ha mai scritte. E' li' che vivono l'endpoint senza test, la rotta web senza API dietro, la tabella senza modulo, la variabile d'ambiente usata e non dichiarata.

Vale la doctrina di `~/.claude/CLAUDE.md` §«Metodo sistematico per review/audit»: enumerare tutti i file in scope, grep sistematici per ogni anti-pattern sull'**intero** codebase, contare le occorrenze esatte, verifica incrociata, query DB multiple per categoria di rischio. **Mai privilegiare la comprensione architetturale rispetto alla scansione sistematica. Ogni stack — backend, frontend, DB, infra — ha pari dignita'.** E mai campionare: `head -150` su un file da analizzare e' vietato (R2).

### Asse A — fonti dichiarate (un ricognitore ciascuna, letta per intero)

Action register · `DEBT_REGISTER` · `SOT_STATE` · linee di prodotto e programma 100X · mandati documentali · TODO/FIXME/HACK nel codice sorgente · CI, PR aperte e alert dipendenze.

### Asse B — superfici reali (un ricognitore ciascuna, verifica live)

| Superficie | Cosa cerca | Prova richiesta |
|---|---|---|
| **Configurazione e ambiente** | variabili usate nel codice ma fuori da `EnvSchema` · `.env.example` divergente dai tre blocchi runtime · `engines`/`.nvmrc`/`packageManager` incoerenti · flag `tsconfig`/eslint disattivati senza motivo · segreti referenziati e non documentati | grep + confronto, con conteggio |
| **Backend per modulo** | per ognuno dei moduli sotto `apps/api/src/modules`: schema Zod, repository, service, routes, registrazione allo step 13 di `app.ts`, test d'integrazione. Ogni casella vuota e' una pendenza | matrice modulo x 7 passi, completa |
| **Backend anti-pattern** | route senza `requirePermission` · POST/PATCH/DELETE senza `verifyCsrf` · errori non tipizzati dalle classi in `src/errors` · SQL interpolato invece di `$1,$2` · query senza filtro tenant · operazioni multi-statement senza `withTransaction` | grep sull'intero `apps/api`, occorrenze contate |
| **Contratti condivisi** | schema esportato senza subpath export in `package.json` e viceversa · tipi divergenti fra `@heuresys/shared` e l'uso reale in api/web | confronto export vs import |
| **Frontend** | pagina senza endpoint dietro · `initialData`/`placeholderData` hardcoded (vietato dalla dottrina live-data) · primitive UI reimplementate invece di `@heuresys/ui` · chiavi i18n presenti in una lingua e non nell'altra · pagine senza spec Playwright · stati vuoto/errore non gestiti | inventario rotte web + grep |
| **DBMS** | tabelle `sys.*` senza modulo API · FK mancanti · indici assenti su colonne effettivamente filtrate · migrazioni non idempotenti · drift fra migrazioni in repo e schema live · viste e materialized view stale · tabelle vuote per famiglia | query su `information_schema` + `pg_indexes`, confronto con `ls db/migrations` |
| **Endpoint e wiring (la riconciliazione)** | inventario **live** degli endpoint registrati, confrontato con quattro liste: test d'integrazione esistenti · schema in `shared` · permessi in `sys_auth_role_permissions` · consumo effettivo dal frontend. Ogni disallineamento nelle due direzioni e' un cluster | cinque liste affiancate, differenze enumerate |
| **RBAC e autorizzazione** | permesso definito e mai usato da nessuna route · route che chiede un permesso inesistente · dati sensibili raggiungibili per via funzionale invece che organizzativa (`I18`) · ruoli senza mapping | query DB + grep, incrociati |
| **Sicurezza** | segreti nella history di git · alert dipendenze aperti · helmet/cors/rate-limit/redaction dei log effettivamente attivi · rotazione chiavi JWT · TOTP | `gh api` + grep + verifica a runtime |
| **Test e CI** | moduli senza test · test skippati o `.only` · workflow rossi o instabili · gate mancanti per area | conteggio per area, non stima |
| **Infrastruttura e PROD** | systemd in `failed` · backup e **restore verificato** · retention · spazio disco · alerting · drift fra VM e linux-pc · deploy script disallineati | SSH su entrambi gli host, output allegato |
| **Documentazione e SoT** | drift fra `SOT_STATE` e realta' ri-derivata · decisioni prese senza ADR · `INDEX_PATHS` stale | rigenerazione e diff |

### Il check di copertura (fail-loud)

Un ricognitore che non trova niente e un ricognitore che non ha girato producono lo stesso silenzio. Per distinguerli, **ogni superficie deve restituire o dei rilievi o un'attestazione esplicita**: comando eseguito, numero di elementi esaminati, e la frase «nessun rilievo su N elementi». Una superficie che restituisce il vuoto senza attestazione e' un **errore bloccante**, con retry mirato su quella sola superficie. Un censimento «fresco ma bucato» e' peggio di un censimento assente, perche' produce uno zero in cui si crede.

**2. Consolidamento e verifica adversarial.** Un agente con visione globale riduce le voci grezze a cluster canonici; poi **tre verificatori su lenti distinte** — perdita di informazione, merge indebiti, realismo delle stime. Il consolidamento e' accettato solo con copertura verificata: ogni id in ingresso mappato, zero persi, zero inventati, ogni `dependsOn` che risolve.

**3. Riporta avanti le decisioni gia' prese.** E' il passo che si dimentica, ed e' quello che fa la differenza fra un censimento utile e uno che fa perdere tempo. Dal piano precedente e dal register, trasferisci nel piano nuovo tutto cio' che ha uno stato **terminale o deliberato**:

- cluster `DONE`/`FATTO` → non devono ricomparire come pendenze;
- cluster `WON'T-DO` → con la motivazione originale, altrimenti un ricognitore li ritrova e li
  ripropone come se fossero nuovi;
- debiti con **rischio accettato** (es. D-75) → restano accettati, non tornano aperti;
- item in `HOLD` con `reactivation-trigger` → si porta avanti il trigger, e si valuta se e' scattato;
- item `WAIT-INPUT` ancora pendenti su Enzo → restano nel vassoio, con la stessa richiesta.

Senza questo passo Enzo si ritrova a ri-decidere cose che aveva gia' deciso mesi prima, e la fiducia nel piano nuovo scende a zero al primo item che riconosce.

**4. Classifica per raggio d'impatto.** Ogni cluster nuovo prende una classe secondo il criterio meccanico in `blast-radius.md` §«Come si classifica un cluster», partendo dai path che dichiara di toccare. Nel dubbio fra due classi si prende la piu' alta. I cluster ambigui non si indovinano: si elencano a Enzo in coda al lavoro, e restano non eleggibili finche' non hanno una classe.

**5. Scrivi il piano nuovo, non sovrascrivere il vecchio.** Nome datato, stessa convenzione: `docs/superpowers/specs/<YYYY-MM-DD>-zero-pending-plan.md`. Il piano precedente resta dov'e' come storia — e' la traccia di cosa era aperto allora e cosa e' stato deciso. Aggiorna il puntatore `meta.plan` in `zp.config.yaml`, azzera `clusters:` e riempilo con la classificazione nuova, rimetti `clusters_classified: true` con data e SHA.

**6. Riparti.** Scrivi `.zp/last-outcome.json` con `{"outcome":"nothing-to-do","next":"stop"}`: il censimento non esegue cluster. Da li' Enzo guarda con `zp prova` e riparte con `zp avvia`.

## Quando NON serve un censimento nuovo

Se il loop e' stato fermo pochi giorni e nessuno ha lavorato al progetto nel frattempo, basta il `bootstrap` normale: verifica l'integrita' e aggiorna le sole fonti stale. Il censimento completo serve quando **il progetto e' andato avanti senza il loop** — nuovo codice, nuove milestone, nuovi debiti — non quando e' semplicemente passato del tempo.
