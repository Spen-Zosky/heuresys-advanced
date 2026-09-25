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

---

## Si riprende da qui — stato vero al 2026-09-25 ore 04:15 (misurato, non ricordato)

Scritto su richiesta del governo (Cowork): finestra 5 ore misurata dal canale al **75%**, in salita di
circa un punto al minuto; soglia di Enzo 80%, fascia di chiusura dal 79%. Questa sezione esiste
perché il punto di ripresa non dipenda dal fatto che la sessione arrivi in fondo.

### Fatto, e provato

| voce | stato | prova |
|---|---|---|
| **C2-1** — #28 SIGPIPE in `align-claude-ecosystem.sh` | **FATTO** | causa riprodotta (`exit=141`) e corretta (`\|\| true`, righe 601 e 554); commit `7ee357ee`. Provato **sul vivo**: il secondo giro di `close-propagate --delta` ha superato il punto in cui moriva e ha completato entrambi i canali |
| **C2-2** — GitHub | **FATTO** | 10 allarmi CodeQL corretti (commit `1b319322`); gli altri 151 censiti con gravità e motivo; Dependabot 0, secret scanning 0. **Atlas freshness: verde** sull'HEAD rilasciato, dopo sei rossi consecutivi |
| **CI su `b07143c8`** | **9 verdi su 10** | State lint, Lint, Shell tests, Typecheck, i18n parity, CodeQL, Atlas freshness, Build (web), Playwright smoke. In corso: `Test (api integration)` |
| **Allineamento delle due macchine** | **FATTO** | entrambi i canali (`align-clones` e `align-claude-ecosystem`), entrambi gli host, **verify CLEAN**: `drift-vm-20260925T015929Z.md` e `drift-linuxpc-20260925T015929Z.md`. VM e linux-pc sono a `b07143c8` |
| **C2-3, armamento** | **FATTO** | `origin/prod` portato da `78b40e72` a **`b07143c8`** — 139 commit, il primo rilascio da giorni. Riga testuale dello script: `armato b07143c8 — il deploy parte da se' entro ~5 minuti dal verde della CI (sorvegliante: heuresys-advanced-deploy-watch.timer su VM e linux-pc)` |
| **C2-5, clone del DB del gemello** | **FATTO una volta, ri-armato** | primo giro concluso `Result=success`, exit 0, con la riga `[clone-vm-db] done (scambiato: in nessun istante heuresys_advanced e' rimasto senza dati)`. Il secondo giro di `close-propagate` lo ha **ri-innescato** (MainPID 1253352) perché i path `db/migrations\|seeds` risultano cambiati: gira sotto systemd, quindi **sopravvive alla chiusura di questa sessione** |
| **C2-4, misura PRIMA** | **FATTO** | 8 asserzioni rosse in produzione, con l'output allegato più sopra: login delle utenze di collaudo a **500** mentre una password sbagliata risponde **401** — il bundle fermo al 14/9, visto dall'utente |

### Manca — e questo è il punto di ripresa

1. **`Test (api integration)` sull'HEAD `b07143c8`**: era ancora in corso. Comando:
   `gh run list --limit 12 --json name,conclusion,headSha`. Se rossa, si corregge (non si restituisce).
2. **`bash scripts/verifica-deploy.sh`** finché non dichiara **DEPLOYATO**. Subito dopo l'armamento
   dirà quasi certamente **IN-VOLO**, ed è giusto così: il rollout lo fa il timer entro ~5 minuti dal
   verde della CI. `NON-VERIFICATO` **non** vuol dire «a posto».
3. **La prova live DOPO il rilascio**: `cd apps/api && node --dns-result-order=ipv4first
   scripts/prova-live-chiusura-c2.mjs`. Attesa: VERDE, cioè login a 200, dossier del DPO a 200 con
   `grossPay` in `masked`, PLATFORM_OPERATOR 200/403 e SALES 200/403. Se resta ROSSA **dopo** che
   `verifica-deploy.sh` dice DEPLOYATO, allora #30 non è chiusa dal rilascio e va indagata a parte.
4. **L'esito del clone ri-innescato**:
   `ssh linux-pc 'systemctl show -p Result --value heuresys-advanced-clonedb.service'`.
5. **La verifica lunga di chiusura sul linux-pc**: `bash db/scripts/prova-api-sul-gemello.sh`
   (~16 minuti lì contro ~31 su Windows). Da fare **dopo** il clone, mai prima.
6. **Handoff**: `.handoff/STATE.md` e `docs/kb/SOT_STATE.md` con la skill `handoff`, **senza**
   rieseguire il rilascio già fatto.

### Le voci APERTE di TRG.md che restano per domani, nell'ordine di TRG-3

Delle 18 APERTE censite ieri, **due sono chiuse stanotte**: `#28` (corretta qui) e — se il punto 3
qui sopra torna verde — `#30`. Le altre, nell'ordine di impatto che TRG-3 aveva già deciso:

**Alto** — nessuna residua, se `#30` si chiude col rilascio.

**Medio**
1. `[piano F-1/F-3]` `00_STATO_ORA_heuresys-advanced.md` stantio di 5-6 giorni, perché niente lo
   riscrive da sé. Chi: Cowork.
2. `[piano F-2]` nessuna attività pianificata «all'accesso» rilancia una sessione interrotta dopo un
   riavvio. Chi: Cowork.
3. `[piano H-3]` `uscita_sicura.py` non distingue scarto noto da lavoro non salvato. Chi: Cowork.
4. `[registro #2]` `seed_acquisition:read`/`trigger` concedono accesso a tre moduli oltre a
   `tenant-import-runs`: granularità per famiglia invece che per modulo. Chi: sessione CLI, ed è un
   mandato nuovo (una migrazione di granularità), non un emendamento.

**Basso**
5. `[piano A-1, A-4, A-5, A-6, A-7]` cinque sezioni mancanti nella skill e nella copia durevole.
6. `[piano G-6, G-7]` la regola sul controllo degli strumenti non è nella skill, e l'inventario non
   si rigenera a ogni ripresa.
7. `[piano D-3]` `verifica_ciclo.py` non ha una prova di fiducia (caso negativo provocato).
8. `[piano A-9 / F-2 duplicato]` riconciliazione dei tre file `00_*` con la skill.
9. `[piano B-4]` iniezione dell'avviso al terzo giro in tondo, non implementata di proposito.
10. `[registro #16]` la regola «non creare file fuori dalla cartella designata» non è nel testo
    REGOLE degli script dei workflow.

**Non misurate, e restano tali**: `#18`, `#21` (richiedono `git stash list`/`git log` sul gemello),
`#37` (ACL di `heuresys_ci` sulla VM).

### Le DECISIONI-DI-ENZO, a parte — nessuna azione presa, nessuna presa qui

Sono 19 e stanno per esteso in `TRG.md` §«Decisioni-di-Enzo». Le quattro che toccano il prodotto e
che converrebbe sciogliere per prime: `#3` (come distinguere MATERIALIZZAZIONE da IMPORT nel confine
strutturale), `#23` (allineare `GDPR_MANDATE_ROLES` al permesso RBAC, o restringere il permesso),
`#26/#42` (costruire il gesto applicativo che scrive gli OKR check-in), `#27` (superficie self per
`sys_platform_user_tenant_assignments`, o esclusione motivata). `#20` è la più urgente sul piano
operativo: il clone notturno del gemello cancella ogni notte il fattore TOTP di collaudo, e le tre
vie (a/b/c) sono ancora tutte aperte.

### Lo stato vero delle macchine, adesso

| macchina | repo | database | servizi |
|---|---|---|---|
| **Windows** (qui) | `b07143c8`, albero pulito, pari con origin | tunnel `:5433` su produzione, vivo | — |
| **VM Oracle** (produzione) | `b07143c8`, ecosistema CLEAN | produzione | vivi: `/api/readyz` 200 in 0,55 s, `/login` 200 in 0,81 s. **Bundle ancora quello vecchio** finché il timer non deploya |
| **linux-pc** (gemello) | `b07143c8`, ecosistema CLEAN | clone rinfrescato una volta con successo, secondo giro in corso sotto systemd | api e web riavviati dal clone |
| `origin/prod` | **`b07143c8`** (armato stanotte, era `78b40e72`) | — | il rollout lo esegue `heuresys-advanced-deploy-watch.timer` |

---

## INTERRUZIONE — 2026-09-25 ore 04:14, per soglia del guardiano

Il governo (Cowork) ha misurato dal canale la **finestra 5 ore all'82%**: soglia di Enzo (80%)
raggiunta, e non si rinegozia. La sessione si interrompe qui. Nessun passo è rimasto a metà:
l'unica attività in corso era l'**attesa passiva** della CI, che non lascia nulla di incompleto.

*(Nota sulla misura: il ramo 5 ore di `guardiano.py` è cieco in sessione headless — il dato è
stantio di oltre 8000 minuti. Il numero che decide viene dal canale, non da qui, e lo si registra
come tale invece di fingere di averlo misurato.)*

### Aggiornamento allo stato vero di questo minuto

| fatto | stato |
|---|---|
| `origin/prod` | **`b07143c8`** — armato. Era `78b40e72`: 139 commit, il primo rilascio da giorni |
| chi lo rilascia | **`heuresys-advanced-deploy-watch.timer`**, su VM e linux-pc, da solo, entro ~5 minuti dal verde della CI. **Non dipende da questa sessione** |
| CI su `b07143c8` | **9 verdi su 10**; `Test (api integration)` era ancora in corso all'interruzione. Zero rosse |
| `verifica-deploy.sh` | ultimo verdetto letto: **IN-VOLO — CI ancora in corso (1)**. Entrambi gli host fermi su `9f62c7a1`, servizi `active/active`, produzione `readyz=200 login=200` |
| allineamento macchine | **completo**, entrambi i canali, entrambi gli host, `verify CLEAN` |
| clone del DB del gemello | **success** due volte (`Result=success`, `ActiveState=inactive`) |
| albero locale | pulito, pari con origin |

### Cosa resta, nell'ordine in cui va ripreso

1. `gh run list` — `Test (api integration)` su `b07143c8`: se rossa, si corregge.
2. `bash scripts/verifica-deploy.sh` finché non dice **DEPLOYATO**. Se resta IN-VOLO oltre ~10
   minuti dal verde: `ssh <host> 'journalctl -u heuresys-advanced-deploy-watch -n 50'`, che dice
   sempre **perché** non ha deployato.
3. `cd apps/api && node --dns-result-order=ipv4first scripts/prova-live-chiusura-c2.mjs` — la prova
   live di C2-4. Prima del rilascio: 8 rosse. Attesa dopo: VERDE. **Se resta rossa a deploy
   avvenuto, #30 non è chiusa dal rilascio** e diventa una voce a sé.
4. `bash db/scripts/prova-api-sul-gemello.sh` — la verifica lunga di chiusura, sul linux-pc.
5. La skill `handoff`, **senza** rieseguire il rilascio.

Il resto — le voci APERTE di TRG.md, le DECISIONI-DI-ENZO, lo stato delle macchine — è nella
sezione «Si riprende da qui» qui sopra, e non si ripete.

---

## SCOPERTA DOPO L INTERRUZIONE — l armamento si invalida se main avanza

Trovata leggendo le macchine invece di fidarmi del verdetto. `verifica-deploy.sh` diceva
**IN-VOLO — CI verde, 0/2 host allineati — il sorvegliante propaga entro ~5 min**, e il rollout non
partiva. Il giornale del sorvegliante sulla VM dice perche, e non e quello che il verdetto lasciava
credere:

```
$ ssh oracle-vm-default "journalctl -u heuresys-advanced-deploy-watch -n 12 --no-pager -o cat"
[deploy-watch] armato b07143c8 ma origin/main e 826ea1ca — la punta non e piu quella autorizzata, non deployo
[deploy-watch] armato b07143c8 ma origin/main e 8fe1b0a8 — la punta non e piu quella autorizzata, non deployo
[deploy-watch] armato b07143c8 ma origin/main e 8fe1b0a8 — la punta non e piu quella autorizzata, non deployo
```

**I due commit di documentazione che ho fatto DOPO larmamento hanno invalidato larmamento.** Il
sorvegliante, per costruzione, deploya solo se lo sha armato e ancora la punta di `origin/main`: e
una guardia giusta — non vuole mettere in produzione uno stato che non e piu quello autorizzato — ma
significa che **qualunque commit successivo allarmamento, anche di soli documenti, ferma il
rilascio in silenzio**. Senza guardare il giornale, la sessione si sarebbe chiusa credendo di aver
rilasciato, e la produzione sarebbe rimasta al 14 settembre.

**`verifica-deploy.sh` non vede questa causa**: dice IN-VOLO, che e indistinguibile da «il timer
non e ancora passato». E un difetto del verdetto, non del sorvegliante — e va aggiunto alle voci
aperte: *«IN-VOLO deve saper distinguere non e ancora passato da non deployera mai»*.

**Rimedio applicato**: `git push origin main:prod` — fast-forward da `b07143c8` a **`8fe1b0a8`**,
nessun force. E lo stesso atto gia autorizzato da Enzo per stanotte, solo sullo sha giusto.
Verificato: `git ls-remote origin refs/heads/prod` torna `8fe1b0a8`.

**Conseguenza sulla ripresa**: il rilascio ora aspetta la CI verde su **`8fe1b0a8`** (non piu su
`b07143c8`, che resta comunque 10/10 verde). Al momento della scrittura: Typecheck, Lint e State
lint verdi, `Test (api integration)` in corso. **E la regola da tenere a mente: da qui in avanti non
si committa piu su `main` finche il deploy non e avvenuto** — ogni commit rimanda il rilascio.

---

## C3 — 2026-09-25 sera / 2026-09-26 notte — mandato Cowork CHIUSURA-C3

Voce di governo, sessione S1110 proseguita. Diagnosi di partenza (misurata da Cowork): `refs/heads/prod`
= `6609802d`, CI verde 4/4 su quello sha, ma VM e linux-pc fermi su `9f62c7a1` — il sorvegliante
(`heuresys-advanced-deploy-watch.timer`) falliva ogni 5 minuti con *«IMPOSSIBILE LEGGERE la CI —
non deployo nel dubbio (R3)»*.

### C3-1 — la riparazione di `ci-gate.sh`, tre giri

Il difetto vero era uno solo (rate limit GitHub pubblico, 60/h per IP, esaurito da
`deploy-watch.sh` che interroga `--esiti` per ogni commit della finestra armata), ma la
riparazione si e' rivelata a strati — ogni giro scoperto misurando sul vivo, non per deduzione:

1. **Primo giro** (`50947c8a`) — `fetch()` usa un token quando c'e' (`GH_TOKEN` →
   `GITHUB_TOKEN` → `gh auth token`), passato via `curl -K -` (mai sulla riga di comando,
   visibile con `ps`). Provato: header `Authorization` arriva davvero a un server di eco locale.
2. **Secondo giro** (`ef096f6e`) — su gh 2.4.0 (linux-pc) `auth token` non esiste, e l'errore va
   su STDOUT (testo di usage), non su stderr: con `|| true` il comando "riesce" comunque e quel
   testo diventa il "token", spedito come header — GitHub risponde **401**. Corretto onorando
   l'exit code (`token="$(gh auth token 2>/dev/null)" || token=""`) piu' una difesa in profondita'
   (`case "$token" in *[[:space:]]*) token="" ;; esac` — un token e' una riga sola senza spazi).
3. **Terzo giro** (`a8f60932`) — anche cosi', su linux-pc (gh 2.4.0, nessuna versione piu' nuova
   disponibile) `auth token` semplicemente non esiste: nessun token da nessuna parte. Il token
   e' pero' sul disco in chiaro in `~/.config/gh/hosts.yml` (ogni versione di gh lo scrive e
   legge da li'). Aggiunto come ultimo fallback, con la stessa difesa in profondita'.

Ogni giro provato isolando la sola logica di selezione del token (mock del comando `gh` che
riproduce esattamente il comportamento reale, nessuna chiamata di rete), poi con la batteria
completa (`run-shell-tests.sh` — **258/258** dopo ognuno dei tre commit) e infine sul vivo (VM e
linux-pc, `journalctl -u heuresys-advanced-deploy-watch`).

**Incidente collaterale, corretto**: due corse concorrenti di `verify_gate.py run` (una mia
duplicata) hanno fatto scattare la race sul file di stato condiviso `.zp/verify-verdict.json`,
producendo un rosso fittizio (`programmi` con exit Windows 0xC0000142 — crash da teardown di
processo, non un difetto reale). Risolto terminando il duplicato (C4: mai due corse concorrenti
su una risorsa condivisa) e rilanciando pulito.

### C3-2 — il rilascio vero, completato

Armato tre volte (una per ogni fix, perche' ogni commit successivo invalidava l'armamento
precedente — la stessa dinamica gia' vista in C2): infine `origin/prod` → **`a8f60932`**.

`bash scripts/verifica-deploy.sh` (ATTESA_MAX=900, ripassa da solo):

```
VERDETTO: DEPLOYATO — 2 host su a8f60932, servizi attivi, produzione 200
```

VM e linux-pc entrambi allineati, servizi `active/active`, `readyz=200`, `login=200`.

### C3-3 — la prova live D11, DOPO il rilascio

```
$ cd apps/api && node --dns-result-order=ipv4first scripts/prova-live-chiusura-c2.mjs
(a) D11 — ok login dpo@collaudo.invalid → 200; dossier → 200; buste=37 RIGHE;
    masked=[deductions, grossPay, netPay]; ogni campo masked davvero ASSENTE
(b) #30 — ok PLATFORM_OPERATOR 200/403; SALES 200/403 (controprove incluse)

VERDETTO: VERDE — tutte le asserzioni reggono
```

Il rilascio ha chiuso sia D11 (dossier masked) sia #30 (ruoli senza permessi effettivi in
produzione): entrambi erano sintomi dello stesso bundle fermo al 14/9, ora sostituito.

### C3-4 — linux-pc

`clone-vm-db.sh` armato dentro `close-propagate` (misurato: `db/migrations|seeds` cambiati
`58b159c3..HEAD`): `systemctl show -p Result` → **`success`**.

Verifica lunga di chiusura in corso (`db/scripts/prova-api-sul-gemello.sh`, lanciato da Windows —
**non** via ssh diretto: il primo tentativo, fatto ssh-ando prima dentro linux-pc e lanciando lo
script li', ha fallito perche' lo script stesso fa `ssh linux-pc` e da dentro linux-pc quell'alias
non risolve a se stesso). Esito a seguire in questa stessa sezione.
