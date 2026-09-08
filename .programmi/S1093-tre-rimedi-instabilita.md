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

> **stato**: CHIUSO
> **item**: `#C1C2C3`

- [x] **F1 La prova generale copre TUTTO `db/`** — `verify_gate.py` instrada `migrate-idempotent` anche su `db/scripts/` e `db/seeds/`, e un selftest impedisce la regressione. **fatto =** selftest verde su casi positivi E negativi, provato a fallire in entrambi i versi — FATTO 2026-09-08 · 9 casi + controprova; sabotaggio A (tolgo la rotta) → ROSSO, sabotaggio B (instrado tutto) → ROSSO
- [x] **F2 Lo strumento «chi sorveglia questo oggetto»** — `chi_sorveglia.py <nome>`: sentinelle dal database vivo, cancelli, test, scrittori, migrazioni, CI, codice; `--no-ignore` per non essere cieco sui file ignorati. **fatto =** interrogato sul caso reale, mette in prima riga la sentinella che non avevo cercato — FATTO 2026-09-08 · `v_mfa_secrets_in_cleartext` in testa, marcata BLOCCANTE, più altri 5 scrittori sconosciuti; selftest 6 casi verde
- [x] **F3 La regola nei file che ogni sessione rilegge** — `CLAUDE.md` di progetto (sezione «LA CATENA, NON IL PEZZO», C1/C2/C3), `~/.claude/CLAUDE.md` globale (C1, che non è specifica del progetto), `.claude/rules/db-migrations.md` (si autocarica in `db/**`). **fatto =** scritte E agganciate a un cancello che le pretende — FATTO 2026-09-08 · `chi-sorveglia` e `router-selftest` sono suite instradate, il router instrada sé stesso
- [x] **F4 Il seed porta a uno stato dichiarato** — togliere l'aleatorietà dal progetto dello strumento: non «inserisci se manca» ma «porta a questo stato». **fatto =** stesso comando, stesso esito su stati di partenza diversi, dimostrato su due stati costruiti apposta; guardia a due condizioni provata a esiti opposti — FATTO 2026-09-08 · post-condizione `dichiaraStatoRaggiunto` che verifica lo stato invece di riportare le azioni; **provato su due stati di partenza davvero diversi** (7 fattori e 0 fattori): stesso comando, **stesso stato di arrivo** — 7 verificati e cifrati, segreto depositato. ⭐ E la guardia è stata provata da un **incidente vero**: per una distrazione ho eseguito il seed contro la **produzione**, e si è rifiutata — 0 segreti rigenerati, nessun deposito, 0 segreti in chiaro
- [x] **F5 Perché il verde di oggi è verde** — **fatto =** la dichiarazione esplicita di NON SPIEGATO, che è l'esito onesto — FATTO 2026-09-08 · vedi la sezione qui sotto: ipotesi escluse una per una, quella che resta nominata, e **nessuna spiegazione plausibile scritta al posto di una misurata**

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


---

## F5 — perché il verde è verde: **NON SPIEGATO**, e lo dichiaro invece di inventarlo

La CI Playwright è tornata verde dopo aver reso il seed scrittore di segreti **cifrati** invece
che in chiaro (commit `9c01e3e3`). Che sia verde è **misurato**. *Perché* la versione in chiaro
venisse rifiutata dal login **non lo so**, e questa sezione esiste perché scrivere una causa
plausibile al posto di una misurata è precisamente il difetto che questa sessione ha corretto
tre volte.

**Ciò che ho escluso, misurandolo:**

| ipotesi | perché cade |
|---|---|
| il deposito non è ciò che il server legge | le impronte in CI **combaciano**: depositata `ede4d885`, usata `ede4d885` |
| Playwright legge un file sbagliato | gira da `apps/web` (`working-directory` nel job), e il path è relativo a quella |
| il seed non ha girato, o la guardia era chiusa | il log del job: guardia aperta su `heuresys_ci`, **7 segreti depositati** |
| `decryptSecret` rifiuta un valore in chiaro | il codice lo ritorna **as-is** quando manca il prefisso `enc:v1:` — letto, non supposto |
| la sfida non appariva | il report Playwright mostra la pagina «Autenticazione a due fattori» con il codice **inserito** e l'alert «Codice MFA non valido o scaduto» |

**L'unica pista che resta aperta**, trovata mentre indagavo e **non confermata**: la ri-cifratura
pigra di `mfa-service.ts` esclude i fattori con label `FIXTURE_FACTOR_LABEL = "e2e-fixture"`,
mentre quelli del seed hanno label `derived-access`. Sono **due famiglie di fixture con due
etichette**, e l'esclusione ne copre una sola — quindi i fattori del seed **non** erano esclusi.
Non spiega però un rifiuto al *primo* tentativo, perché quel ramo scatta **dopo** un match
riuscito. Resta una discordanza reale, ed è già corretta nel commento del seed, dove il
2026-09-08 avevo scritto il contrario — **una mia affermazione falsa, misurata e corretta**.

**Cosa ho lasciato al posto della spiegazione**: le due impronte. La prossima volta che quella
suite fallisce sul secondo fattore, il log dice in un colpo se il guasto è nel deposito o nel
server. Non è la risposta; è ciò che rende la risposta un minuto invece di un pomeriggio.


---

## ⚠⚠ C4 — la regola nata da un incidente che ho causato IO, mentre costruivo C1

**Cronaca, con gli orari.** Per dimostrare F4 — «stesso comando, stesso esito» — ho fatto `DELETE`
dei fattori TOTP su `heuresys_ci` e li ho ricreati, due volte. `heuresys_ci` non è un banco di
prova: è **il database vero della CI**, e in quel momento una corsa era in volo.

| | |
|---|---|
| `Test (api integration)` su `4cfc4c14` (15:37) | **success** |
| `Test (api integration)` su `aa4235e9` (16:21) | **failure** |
| l'errore | *«mfa_enrollment_required — the fixture TOTP factor is missing»* |

Cioè: **esattamente ciò che avevo appena cancellato**. Non è una coincidenza da verificare, è una
catena di orari.

**E la parte che pesa**: l'ho fatto *mentre scrivevo la regola che dice di non farlo*. C1 esiste da
un'ora, e non l'ho applicata a me stesso. Interrogato dopo l'incidente:

```
$ python docs/kb/tools/chi_sorveglia.py heuresys_ci
⑥ CI (workflow che lo nominano)
    .github/workflows/test-integration.yml    10 riscontri
    .github/workflows/playwright-integrale.yml 6 riscontri
    .github/workflows/playwright-smoke.yml     5 riscontri
```

Una riga, prima del `DELETE`. **La regola non è servita perché non l'ho eseguita**, ed è il modo in
cui una regola muore senza che nessuno la abroghi.

**C4, aggiunta al `CLAUDE.md` di progetto e a quello globale**: una prova che cancella, sovrascrive
o rigenera gira su una **copia usa-e-getta**, mai sull'originale — è già il modo di lavorare di
`ci-rehearsal.sh`, e la ragione per cui esiste era proprio questa. E un database di collaudo
condiviso **è** un oggetto condiviso, anche se non somiglia a un oggetto.

**Rimediato**: i 158 fattori sono di nuovo al loro posto (misurato), la corsa è stata rilanciata.
