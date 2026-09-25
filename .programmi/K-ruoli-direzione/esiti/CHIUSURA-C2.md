# CHIUSURA-C2 — la chiusura completa della serata

Mandato Cowork, voce di governo fuori dal ciclo 2. Sessione **S1110**, non presidiata, 2026-09-25.
Autorizzazione al rilascio: Enzo a Cowork, 2026-09-25 ore 03:10 (citata nel mandato).

## Piano (R24 §1 — una riga per deliverable)

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| C2-1 | bloccanti: #28 SIGPIPE + ogni altra APERTA bloccante | CLI | fix con prova; non-bloccanti elencate in C2-6 | IN CORSO |
| C2-2 | GitHub pulito: workflow + allarmi di sicurezza | CLI | tabella con ogni workflow e ogni allarme + comando | DA FARE |
| C2-3 | rilascio: close-propagate → CI verde → verifica-deploy | CLI | VERDETTO = DEPLOYATO incollato | DA FARE |
| C2-4 | prova sul vivo in produzione (DPO dossier masked + ruolo #30) | CLI | output allegato dei due login | DA FARE |
| C2-5 | linux-pc: clone-vm-db.sh + verifica lunga lì | CLI | esito incollato | DA FARE |
| C2-6 | punto di ripresa: handoff + «Si riprende da qui» | CLI | STATE.md/SOT_STATE.md riscritti + sezione qui | DA FARE |
| C2-7 | uscita pulita + riga @COWORK FATTO | CLI | albero pulito, pari con origin, cancello+CI verdi | DA FARE |

## Simulazione (R24 §3) — le cinque domande, per le voci che mutano qualcosa

**C2-1** · precondizioni: repo pulito (verificato al boot, `working tree clean`) · meccanismo: `|| true`
sulla pipeline sotto `pipefail`, letto nel codice reale alla riga 601 · propagazione: il file è tracciato,
va nel commit e quindi sulle macchine col rilascio · chi: io · guardia: non distruttiva, `bash -n` +
`run-shell-tests.sh`.

**C2-3** · precondizioni: C2-1 e C2-2 verdi, push autorizzato da Enzo · meccanismo:
`close-propagate.sh` arma `refs/heads/prod`, il timer `deploy-watch` deploya a CI verde ·
propagazione: è essa stessa la propagazione · chi: io · guardia: fail-loud su host raggiungibile;
se fallisce a metà **non si improvvisa un ripristino** (vincolo 2 del mandato).

**C2-5** · precondizioni: linux-pc raggiungibile, propagazione già fatta · meccanismo:
`clone-vm-db.sh` droppa e ricrea il clone **in place** — se la CLI chiude nella finestra sbagliata
il gemello resta rotto (memoria `remote_jobs_die_with_the_cli_session`) · chi: io · guardia: si
esegue **dopo** il rilascio, mai in parallelo.

## Confine di sessione (R24 §4)

Contesto misurato all'avvio: **8,6%** (85.860 token su 1.000.000) — `guardiano.py`, verdetto
testuale: `✓ si continua — contesto: mancano 664,140 token · 5h: non misurata (⚠ un ramo su due
e' cieco)`. La finestra 5h è **NON MISURATA** (dato stantio di 8301 minuti: la riga di stato non
gira in sessione headless). Il ramo cieco è dichiarato, non ignorato.

---

## C2-1 — i bloccanti

### #28 · close-propagate SIGPIPE in modalità `--delta` — **CORRETTO**

**Causa radice, riprodotta e non supposta.** `scripts/align-claude-ecosystem.sh` gira sotto
`set -euo pipefail` (riga 33). Alla riga 601 c'era una pipeline `find … | head -1` dentro una
sostituzione di comando assegnata a variabile: `head` esce dopo la prima riga, `find` continua a
scrivere, riempie il buffer della pipe e prende **SIGPIPE** → la pipeline esce **141** → `pipefail`
lo propaga → l'assegnamento fallisce → `set -e` uccide lo script. Non accade sempre: solo quando
l'output supera il buffer, cioè quando molti file sono più recenti del marcatore. È esattamente il
profilo intermittente descritto nel registro.

Riproduzione (prima del fix):

```
$ bash -c 'set -euo pipefail; changed="$(find /c/Users/enzospenuso/.claude -type f 2>/dev/null | head -1)"; echo "OK: $changed"'; echo "exit=$?"
exit=141
```

La riga `OK:` non viene mai stampata: lo script è già morto.

**Secondo difetto della stessa famiglia, trovato dal censimento e corretto insieme** (riga 554):
`rline="$(rssh … | grep "^MEMCOUNT=" | tail -1)"`. Se `grep` non trova nulla esce 1, `pipefail` lo
propaga e lo script muore — mentre le tre righe immediatamente sotto (`if [ -z "$rline" ]` →
`SKIP (host non risponde al check — non un DRIFT)`) dimostrano che l'autore voleva proprio che il
vuoto fosse gestito. Il ramo SKIP era irraggiungibile.

**Correzione**: `|| true` in coda a entrambe le pipeline (righe 601 e 554).

Prova dopo il fix:

```
$ bash -c 'set -euo pipefail; changed="$(find /c/Users/enzospenuso/.claude -type f 2>/dev/null | head -1 || true)"; echo "OK: ${changed:0:50}"'; echo "exit=$?"
OK: /c/Users/enzospenuso/.claude/.context-window.json.
exit=0
```

`bash -n scripts/align-claude-ecosystem.sh` → **SINTASSI OK**.

**Censimento C1 prima di toccare** (`python docs/kb/tools/chi_sorveglia.py align-claude-ecosystem.sh`):
sentinelle nessuna · cancelli `scripts/test/run-shell-tests.sh` (4 riscontri) e
`atlas-sweep-templates/fragments_s1016/ops.yaml` (2) · test nessuno · scrittori nessuno · migrazioni
nessuna · CI nessuno · codice nessuno.

**Altre pipeline a rischio censite e NON toccate, con la ragione**: riga 552 (`find | head` dentro la
stringa `rssh`) gira sulla shell **remota**, che non ha `pipefail` → non è un difetto;
`align-clones.sh:78` è dentro `[ -n "$(…)" ] && …`, dove `set -e` non scatta sulla sostituzione di
comando né sui membri non finali di una lista `&&` → non è un difetto;
`verifica-deploy.sh:74` gira dentro `ssh` sulla shell remota → non è un difetto.

### Batteria a valle del censimento

`bash scripts/test/run-shell-tests.sh` → **257 ok, 1 failed**. L'unico rosso è
`stop gate drift`: confronta due invocazioni consecutive dello stesso cancello (wrapper hook vs
chiamata diretta) e pretende che dicano la stessa cosa. Hanno detto `shell-tests` la prima e
`programmi, shell-tests` la seconda — perché **fra le due ho creato questo file**, che sta in
`.programmi/`. È un falso rosso prodotto da me: l'albero è cambiato durante la corsa. Ri-eseguita ad
albero fermo (esito in C2-7).

---

## C2-2 — GitHub pulito

### Workflow (`gh run list --limit 30`, HEAD `8d97ac8f`)

| workflow | ultimo esito | nota |
|---|---|---|
| State lint (handoff/SoT coherence) | **success** (36081208075, su `8d97ac8f`) | — |
| Lint (all workspaces) | **success** (36080490284) | — |
| Typecheck (all workspaces) | **success** (36080490499) | — |
| Test (api integration) | **in_progress** al momento della misura (36080490312) | ri-letto in C2-7 |
| Playwright smoke (web E2E) | **success** (36069133478) | non gira sui commit di soli documenti |
| CodeQL (security scanning) | **success** (36069133594) | — |
| **Atlas freshness** | **failure** (36070085031) — e non solo: `gh run list --workflow=atlas-freshness.yml --limit 6` mostra **sei fallimenti consecutivi**, dal 2026-09-19 al 2026-09-24 | vedi sotto |

**Atlas freshness — misurato, non dedotto.** Il log del job
(`gh api repos/{owner}/{repo}/actions/jobs/107868744886/logs --allow-escape-sequences`) dice
esattamente: `atlante: vecchio` e poi `Process completed with exit code 1`. Cioè il rosso era
**vero**, non un difetto del workflow. Sull'HEAD di oggi la stessa misura, eseguita qui,
`python docs/kb/tools/atlante_fresco.py` → **`fresco`, exit 0**: l'atlante è stato rigenerato dai
commit `cfcf568f` e `89d9089e`, dopo l'ultima corsa rossa. Il workflow non è ripartito da solo
perché il suo filtro `paths` non comprende i commit di soli documenti. **Non lo si dichiara verde
per deduzione**: lo si fa girare con `workflow_dispatch` sull'HEAD rilasciato, ed è in C2-7.

### Allarmi di sicurezza

| canale | comando | aperti |
|---|---|---|
| Dependabot | `gh api "repos/{owner}/{repo}/dependabot/alerts?state=open&per_page=100"` | **0** (risposta vuota, endpoint abilitato: un canale spento risponderebbe 403) |
| Secret scanning | `gh api "repos/{owner}/{repo}/secret-scanning/alerts?state=open&per_page=100"` | **0** (idem) |
| Code scanning (CodeQL) | `gh api "repos/{owner}/{repo}/code-scanning/alerts?state=open&per_page=100&page=N"` | **161** — 1 critical, 16 high, 24 medium, 54 warning, 66 note |

#### Corretti in questa sessione — 10 allarmi `medium`, zero impatto sul prodotto

`actions/missing-workflow-permissions`: dieci workflow giravano col token di corsa a permessi
impliciti. Aggiunto `permissions: contents: read` in testa a ciascuno — `lint`, `build-web`,
`i18n-parity`, `playwright-smoke`, `shell-tests`, `state-lint`, `test-integration`, `typecheck`,
`playwright-integrale`, `atlas-freshness` (allarmi 1, 2, 3, 4, 5, 7, 8, 58, 166, 168).
`codeql.yml` aveva già i permessi a livello di job; `showcase.yml` ha `contents: write` perché
pubblica su GitHub Pages, e resta com'è. Nessuno dei dieci usa il token del workflow per scrivere:
`actions/upload-artifact` usa il token di runtime, che è un'altra cosa.
Prova: i dodici file si rileggono tutti come YAML valido e dichiarano i permessi attesi.

#### NON corretti — gravità, perché, e cosa servirebbe

| n. | grav. | regola | dove | perché non l'ho corretto | cosa servirebbe |
|---|---|---|---|---|---|
| 72 | critical | `py/command-line-injection` | `scripts/zp_panel.py:102` | **falso positivo misurato**: `comando()` chiama `subprocess.run(args, ...)` con una **lista** e senza `shell=True` — non c'è nessuna riga di comando da iniettare. Ed è una webapp di servizio locale, non prodotto | una chiusura motivata dell'allarme su GitHub (atto sul repository, non sul codice): è di Enzo |
| 197 | high | `js/user-controlled-bypass` | `apps/api/src/modules/auth/service.ts:357` | è la **neutralizzazione dichiarata** `MFA_ENFORCEMENT_ENABLED` (S989), commentata nel codice proprio sopra la riga; in produzione l'MFA è acceso dal 2026-09-09. Toglierla cambierebbe il comportamento del prodotto | una decisione su come separare collaudo e produzione senza un interruttore d'ambiente: è progetto, non rifinitura |
| 196 | high | `js/unvalidated-dynamic-method-call` | `apps/api/src/modules/dashboard/service.ts:235` | indicizza `FORNITORI` con un `code` che viene dal **database** (piattaforma, non utente), con guardia `if (!fornitore)` subito sotto | irrigidimento reale e piccolo (mappa a prototipo nullo, o `Object.hasOwn`), ma tocca codice di prodotto e pretende la batteria API: non a ridosso di un rilascio |
| 195 | high | `js/polynomial-redos` | `apps/api/src/modules/content/repository.ts:81` | `slugify` con due sostituzioni globali in catena; l'ingresso è già vincolato dallo schema Zod a monte | riscrivere `slugify` in un passaggio solo e provarlo sui casi limite |
| 157 | high | `js/double-escaping` | `apps/api/src/modules/research/web-reader.ts:152` | il testo prodotto serve a **leggere**, non a essere ri-renderizzato: non è un confine di sicurezza, e il commento sopra la funzione lo dichiara | un parser HTML vero al posto delle espressioni regolari |
| 22 | high | `js/remote-property-injection` | `apps/agent-gateway/src/server.ts:84` | un cookie chiamato `__proto__` inquinerebbe l'oggetto: **è reale**, ma la correzione (`Object.create(null)`) cambia il prototipo dell'oggetto e chi lo legge a valle va riverificato | una riga, più la riverifica dei lettori di `parseCookies` |
| 62 | high | `js/insufficient-password-hash` | `apps/api/scripts/derive-access.mjs:107` | non è l'hash di una password memorizzata: è la **derivazione** HMAC-SHA256 di una password di collaudo da una chiave madre, con ~100 bit di entropia dichiarati | niente sul piano della sicurezza; semmai una chiusura motivata dell'allarme |
| 10, 11 | high | `js/clear-text-logging` | `db/scripts/seed-r1b-personas.ts:157`, `seed-r2-personas.ts:165` | **falso positivo leggibile a occhio**: la riga stampa `password.length` e il testo «value never logged» — il valore non esce mai | staccare la lunghezza in una variabile prima del log, se si vuole zittire l'analizzatore |
| 9, 13, 18, 19, 20, 129, 130, 131 | high/medium | varie | `docs/archive/**` | codice **archiviato e ritirato**, che nessuno esegue | escludere `docs/archive/` dalla configurazione CodeQL |
| 21, 93, 94, 95, 128, 134, 149, 151, 152, 153, 155, 156 | high/medium | varie | test, script di prova, strumenti | non sono superficie di prodotto: girano in CI o a mano, su ingressi che scriviamo noi | escludere i percorsi di test dalla configurazione CodeQL, oppure correggerli uno per uno |
| 12, 154 | medium | `js/stack-trace-exposure` | `apps/agent-gateway/src/server.ts:163,232` | il gateway agente non è esposto a Internet | filtrare lo stack dalle risposte d'errore |
| 120 voci | warning/note | `py/file-not-closed`, `py/empty-except`, `py/unused-import`, ... | strumenti Python di `docs/kb/tools/`, `scripts/`, `.programmi/` | **igiene, non sicurezza**: nessuna sta sul percorso di esecuzione del prodotto. Le riporto **raggruppate per regola** invece che una per una, e lo dichiaro invece di farlo di nascosto | una passata di pulizia dedicata (`with open(...)`, `except` con log) — è un ciclo suo, non un passo di chiusura |

**Un segreto esposto**: nessuno. Il canale secret-scanning risponde vuoto, quindi non c'è niente da
segnalare a Enzo su questo fronte, e non ho toccato nessuna rotazione (non è mia).

---

## C2-4 — la prova sul vivo: **la misura PRIMA del rilascio**

Lo strumento è `apps/api/scripts/prova-live-chiusura-c2.mjs`, scritto per questa voce e lasciato nel
repository: sola lettura, nessuna rotta di scrittura, e il soggetto si **deriva dai dati vivi** con
la stessa query del test di D11 invece di essere scelto per nome. Prima il quadro di partenza, così
il confronto dopo il rilascio è un fatto e non un'impressione.

```
$ cd apps/api && node --dns-result-order=ipv4first scripts/prova-live-chiusura-c2.mjs
CHIUSURA-C2 — prova live su https://www.heuresys.com/api   (2026-09-25T01:45:57.208Z)

(a) D11 — il DPO apre il dossier, con gli importi trattenuti e dichiarati
  ROSSO  login dpo@collaudo.invalid → 500
  ok    un soggetto con buste e valutazioni, fuori dalla catena del DPO: luca.conti@rtl-bank.org (buste 37, valutazioni 4, livello 4)
  ROSSO  GET /v1/users/01da8b8e-f5cf-4258-8a84-a3e4d16331c5/dossier → 403
  ROSSO  le buste arrivano come RIGHE: 0
  ROSSO  la busta dichiara cosa e' stato trattenuto: masked=[]
  ok    ogni campo dichiarato in masked e' davvero ASSENTE dalla riga
  ok    la valutazione dichiara cosa e' stato trattenuto: masked=[]

(b) registro #30 — PLATFORM_OPERATOR e SALES, permessi effettivi e perimetro
  ROSSO  login platform-operator@collaudo.invalid → 500
  ROSSO  PLATFORM_OPERATOR GET /v1/observability/system-health → 403 (atteso 200)
  ok    PLATFORM_OPERATOR GET /v1/leads → 403 (atteso 403 — la controprova)
  ROSSO  login sales@collaudo.invalid → 500
  ROSSO  SALES GET /v1/leads → 403 (atteso 200)
  ok    SALES GET /v1/observability/system-health → 403 (atteso 403 — la controprova)

VERDETTO: ROSSO — 8 asserzioni fallite
```

**Il 500 non è un guasto della produzione, ed è la conferma diretta di #30.** La stessa rotta con
una password sbagliata risponde correttamente:

```
$ curl -4 -s -X POST https://www.heuresys.com/api/v1/auth/login -H 'content-type: application/json' -d '{"email":"dpo@collaudo.invalid","password":"x"}'
{"error":{"code":"LOGIN_INVALID","message":"Invalid email or password"}}   HTTP 401
```

e la produzione è viva (`/api/readyz` → 200 in 0,55 s, `/login` → 200 in 0,81 s). Cioè: la
credenziale **giusta** viene riconosciuta, e il servizio cade **subito dopo**, quando deve montare
un'identità il cui ruolo il bundle del 14 settembre non conosce. È l'effetto che il registro
descriveva come «ruoli senza permessi effettivi in produzione», visto dal lato dell'utente.

Il quadro dopo il rilascio è più avanti, nella stessa forma.
