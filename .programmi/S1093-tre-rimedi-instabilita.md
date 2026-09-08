# S1093 — i tre rimedi all'instabilità, come regole che non dipendono dal ricordarsene

*Enzo, 2026-09-08, punto critico: «i risultati del tuo lavoro sono sempre aleatori e raramente
hanno lo stesso esito quando ripetuti. Non c'è stabilità delle correzioni, non c'è stabilità dei
seed, Playwright fallisce ripetutamente, le durate cambiano anche del 1000%. Evidentemente quando
lavori non verifichi tutta l'intera catena delle azioni e degli oggetti che tocchi.»*
*E poi: «rendili istruzioni che ogni tua sessione rilegge e rispetta — non è un suggerimento: è
una regola definitiva.»*

**La contestazione è fondata, e la prova è di stamattina**: ho scritto i segreti TOTP in chiaro
senza prima chiedermi *chi sorveglia quella colonna*. La sentinella `v_mfa_secrets_in_cleartext`
esisteva dal 2026-08-08. Non l'ho cercata: ho guardato il pezzo, non la catena.

**Il criterio di chiusura di ognuno dei tre**: la regola è scritta **e** qualcosa si rifiuta di
passare se non l'ho seguita. Le prime tre volte che ho scritto una regola in un file l'ho poi
violata io stesso avendola davanti — è successo oggi con la prova generale, che era già scritta
nel `CLAUDE.md` e che ho applicato a metà del suo perimetro.

---

## Fasi

> **stato**: IN CORSO
> **item**: `#C1C2C3`

- [x] **F1 La prova generale copre TUTTO `db/`** — `verify_gate.py` instrada `migrate-idempotent` anche su `db/scripts/` e `db/seeds/`, e un selftest impedisce la regressione. **fatto =** selftest verde su casi positivi E negativi, provato a fallire in entrambi i versi — FATTO 2026-09-08 · 9 casi + controprova; sabotaggio A (tolgo la rotta) → ROSSO, sabotaggio B (instrado tutto) → ROSSO
- [x] **F2 Lo strumento «chi sorveglia questo oggetto»** — `chi_sorveglia.py <nome>`: sentinelle dal database vivo, cancelli, test, scrittori, migrazioni, CI, codice; `--no-ignore` per non essere cieco sui file ignorati. **fatto =** interrogato sul caso reale, mette in prima riga la sentinella che non avevo cercato — FATTO 2026-09-08 · `v_mfa_secrets_in_cleartext` in testa, marcata BLOCCANTE, più altri 5 scrittori sconosciuti; selftest 6 casi verde
- [x] **F3 La regola nei file che ogni sessione rilegge** — `CLAUDE.md` di progetto (sezione «LA CATENA, NON IL PEZZO», C1/C2/C3), `~/.claude/CLAUDE.md` globale (C1, che non è specifica del progetto), `.claude/rules/db-migrations.md` (si autocarica in `db/**`). **fatto =** scritte E agganciate a un cancello che le pretende — FATTO 2026-09-08 · `chi-sorveglia` e `router-selftest` sono suite instradate, il router instrada sé stesso
- [ ] **F4 Il seed porta a uno stato dichiarato** — togliere l'aleatorietà dal progetto dello strumento: non «inserisci se manca» ma «porta a questo stato». **fatto =** stesso comando, stesso esito su stati di partenza diversi, dimostrato su due stati costruiti apposta; guardia a due condizioni provata a esiti opposti
- [ ] **F5 Perché il verde di oggi è verde** — la CI è tornata verde cifrando il segreto, ma il meccanismo non è spiegato. **fatto =** o la spiegazione misurata, o la dichiarazione esplicita di NON SPIEGATO in ogni posto dove ho scritto che è verde

---

## R2 — il buco misurato, e la riga esatta

**Fatti, misurati adesso e non dedotti:**

- `verify_gate.py:127` — `("db/migrations/", ["migrate-idempotent", "db-health", "no-contamination", "handoff-lint"])`
- `verify_gate.py:128` — `("db/", ["typecheck", "db-health", "no-contamination"])`
- il router usa **il primo prefisso che vince** (dichiarato a riga 272: *«primo prefisso che vince»*)
- `prova-idempotenza.sh:105` → `exec ssh … "cd $REPO && bash db/scripts/ci-rehearsal.sh"`

⚠ **Una mia affermazione da correggere prima di costruirci sopra**: avevo concluso che «la prova
generale non è in nessun cancello», perché `grep ci-rehearsal verify_gate.py` dava un solo
riscontro **dentro un commento**. Falso: la suite `migrate-idempotent` **è** la prova generale, per
il tramite del wrapper. Il difetto non è che manchi — è che sia instradata **solo sulle
migrazioni**.

**Conseguenza esatta**: toccando `db/scripts/seed-test-admin.ts` il cancello chiede `typecheck`,
`db-health` e `no-contamination`, ma **non** la prova generale. Ed è per questo che stamattina il
segreto in chiaro è emerso solo quando ho toccato *anche* la migrazione — un'ora dopo, e per caso.

⚠ **E `db-health` non l'avrebbe preso comunque**: interroga la **produzione** via tunnel, dove non
avevo scritto nulla in chiaro. Ciò che ha visto il difetto è la copia usa-e-getta di `heuresys_ci`
dentro `ci-rehearsal.sh`. Due controlli che sembrano coprire la stessa cosa e guardano due
database diversi.

### Simulazione a 5 domande (R24 §3)

- **Precondizioni**: il gemello risponde (la suite esce ROSSA e non ripiega in locale se non
  risponde — verificato nel commento a `verify_gate.py:180-182` e nel corpo di
  `prova-idempotenza.sh`).
- **Meccanismo**: la tabella `ROUTES` è una lista di coppie `(prefisso, [suite])` con primo-vince.
  Aggiungere `migrate-idempotent` alla riga `("db/", …)` la fa scattare per tutto ciò che sta in
  `db/` e non è una migrazione. **Letta la configurazione reale, non supposta.**
- **Propagazione**: nessun artefatto nuovo. Cambia solo cosa il cancello pretende.
- **Chi**: claude.
- **Guardia**: il rischio non è la sicurezza, è il **costo** — un cancello che costa troppo si
  finisce per aggirare, e il file stesso lo dice a riga 176. Misurato: `ci-rehearsal.sh` gira in
  **14-18 s** (le due corse di stamattina). Accettabile.

---

## R1 — «chi sorveglia questo oggetto»

Lo strumento deve rispondere, dato il nome di una tabella / colonna / file / script:
① quali **sentinelle** (viste `sys.v_*`) lo interrogano · ② quali **cancelli** lo nominano ·
③ quali **test** lo nominano · ④ quali **script** lo scrivono · ⑤ quali **migrazioni** lo creano.

⚠ **Una trappola già registrata che qui morderebbe**: ripgrep salta i file gitignored, e il tool
`Grep` lo eredita. Uno strumento che cerca «chi tocca questo oggetto» e non guarda i file ignorati
nasce **cieco proprio dove il difetto si nasconde**. Va usato `--no-ignore`.

**Deve poter fallire**: interrogato su un oggetto notoriamente sorvegliato deve elencarne i
guardiani; interrogato su un nome inventato deve dire *niente*, non *tutto*.

---

## R3 — il seed deve portare a uno stato dichiarato

**Il difetto, nelle parole di Enzo**: *«è scritto con logiche del tipo "inserisci solo se non c'è
già": con lo stesso comando, se la riga c'è si comporta in un modo, se non c'è in un altro.
L'instabilità è dentro lo strumento, progettata lì dentro, non nell'esecuzione.»*

Misurato in `seed-test-admin.ts`: `INSERT … WHERE NOT EXISTS`, e da stamattina un ramo `UPDATE`
che scatta **solo** in ambiente di collaudo. Tre comportamenti diversi per lo stesso comando, a
seconda dello stato di partenza — su un database che è una copia della produzione, e quindi parte
da uno stato diverso ogni volta.

⚠ **Il delicato**: un seed che *impone* uno stato, puntato per errore alla produzione, fa danni
veri. Vale la doppia guardia già costruita e provata oggi a esiti opposti.
