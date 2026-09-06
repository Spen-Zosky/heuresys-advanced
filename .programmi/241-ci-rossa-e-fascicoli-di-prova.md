# 241 — La CI rossa che teneva la produzione indietro, e i due fascicoli di prova

> **item**: #241 · **priorità**: P1 · **stima**: ~1 sessione
> **stato**: CHIUSO
> **chiusa**: S1086 (2026-09-03) su V1·V3·V4; V2 dipendeva dal verde di CI dopo il push, e il
> verde c'è — `Test (api integration)` è `success` su main negli ultimi tre giri consecutivi
> (misurato 2026-09-06, S1090). `status: DONE` nel register.
> ⚠ La riga di stato diceva `IN CORSO (S1086)`: la parentesi la mette **fuori dal vocabolario**
> che il parser accetta (`^> **stato**: [A-Z ]+$`), quindi il piano risultava aperto e compariva
> a ogni avvio fra i programmi orfani. La cronaca della chiusura va in una riga sua, non in questa
> **nasce-da**: due mandati diretti di Enzo (2026-09-03) — «PROVA-F7-ALFA in produzione: si
> rimuove» e «le PR di Dependabot su fastify 5.12.1 sono rosse: vanno risolte, decidi tu» — più
> il rosso ereditato da S1085, che `verifica-deploy.sh` dichiarava `CI-ROSSA` sul commit armato.

## Il confine di sessione, dichiarato adesso

La **finestra 5h era al 75%** all'avvio (soglia 80%, misurata dal guardiano). V1·V2·V3 stanno
dentro. **V4 può non starci**: se la finestra morde, V4 si ferma con lo stato scritto qui e non
si dichiara chiusa.

## Le voci

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **V1** | Rimuovere `PROVA-F7-ALFA` e `PROVA-F7-CONSULENZA` dalla produzione | io | i fascicoli in produzione passano da 3 a 1; `RTL-BANK-CONFIG` intatto; giornale di rollback popolato | ✅ **FATTO** |
| **V2** | Il test che pretende `surveys` neutro contraddice `#235` | io | `Test (api integration)` verde in CI sul commit nuovo | ✅ **FATTO** — verde in CI, misurato 2026-09-06 (S1090): `success` sugli ultimi tre giri di main |
| **V3** | La porta 3001 occupata sul runner tiene rossa la `Playwright smoke` | io + conferma di Enzo per il kill | `ss -ltnp` sul runner non mostra nulla su :3001, e la smoke rilanciata è verde | ✅ **FATTO** — porta libera, servizi veri intatti |
| **V4** | Le PR Dependabot su fastify 5.12.1 (e la terza, `qs`) | io | le PR fastify risolte con la ragione misurata, e il lavoro che ne consegue registrato | ✅ **FATTO** — `#76` e `#75` chiuse, migrazione registrata come `#242` |

---

## V1 — I due fascicoli di prova

### La misura, presa adesso (2026-09-03)

```
code                | ver | vstatus | tenant | decisioni | istantanee
PROVA-F7-ALFA       |  1  | DRAFT   | NULL   |     0     |     0
PROVA-F7-CONSULENZA |  1  | DRAFT   | NULL   |     0     |     0
RTL-BANK-CONFIG     |  1  | APPROVED| 86ba…  |     7     |     1
```

**Sono inerti**: `DRAFT`, mai approvati (`approved_at` vuoto), mai applicati (`applied_at`
vuoto), senza tenant. Non hanno costruito nessuna riga business — la rimozione non lascia orfani.
Da non confondere con T9b di `#198`, che il 19 agosto costruì 184 righe: quello era un altro
fascicolo, e fu rimosso allora.

### La simulazione a cinque domande

- **Precondizioni** — le tre righe della misura qui sopra. Se una delle due prove risultasse
  `APPLIED` o con un tenant, il piano cambia: andrebbe disfatta l'applicazione, non cancellato
  il fascicolo.
- **Meccanismo** — `DELETE FROM sys.sys_tenant_blueprints WHERE tenant_blueprint_code IN
  ('PROVA-F7-ALFA','PROVA-F7-CONSULENZA')`, **elenco esplicito, nessun jolly**. La versione cade
  da sé: `sys_tenant_blueprint_versions_…_blu_fkey` è `ON DELETE CASCADE`. Letto il file che
  crea l'oggetto: i due fascicoli nascono da `apps/api/scripts/prova-132-f7-due-prove-di-merito.mts`,
  uno script one-off — **non dalla catena delle migrazioni**. Quindi ADR-0035 non morde: nessun
  deploy li rimette.
- **Propagazione** — la produzione è la VM, unico posto col database vero. Il gemello si rinfresca
  clonando la produzione; la CI usa `heuresys_ci`, che non li ha. Nessun artefatto da portare
  altrove.
- **Chi** — io.
- **Guardia** — la `DELETE` gira **dentro** una transazione che prima ri-verifica, al momento
  dell'esecuzione, che entrambe le righe siano ancora `DRAFT` · `tenant IS NULL` ·
  `approved_at IS NULL` · `applied_at IS NULL`. Se la conta delle righe che soddisfano tutto non
  è esattamente 2, la transazione si ferma con un errore. La precondizione **non si eredita**
  dalla misura di dieci minuti prima.
- **Post-condizione che protegge ciò che NON doveva cambiare** — dopo la `DELETE`:
  `RTL-BANK-CONFIG` esiste ancora, con 1 versione, 7 decisioni e 1 istantanea; il totale dei
  fascicoli è 1; nessuna riga di `sys_tenant_blueprint_process_decisions` o `_snapshots` è
  sparita (erano 7 e 1, restano 7 e 1).
- **Rollback dichiarato** — giornale `staging.blueprint_prova_undo`: le righe cancellate salvate
  come JSONB **prima** della `DELETE`, con la funzione `staging.blueprint_prova_undo_apply()`
  che le rimette.

### ⚠ Il reperto che ha smentito la mia misura — e che la prova generale ha pagato

**«Non hanno costruito nulla» era falso**, e l'ho scritto sopra in buona fede dopo aver misurato
**due figli su tre**. Lo script è morto a metà sul gemello con:

```
ERRORE: DELETE su "sys_tenant_blueprint_versions" viola la chiave esterna
        "sys_seed_acquisition_runs_seed_acquisition_run_blueprint_v_fkey"
```

Sette FK puntano ai fascicoli, e **tre sono `RESTRICT`**: le corse di ricerca
(`sys_seed_acquisition_runs`), le istantanee, e il registro delle origini
(`sys_generated_record_origins`). Avevo guardato solo decisioni e istantanee. La catena vera:

| livello | ALFA | CONSULENZA | come cade |
|---|---|---|---|
| fascicolo | 1 | 1 | — |
| versione | 1 | 1 | `CASCADE` dal fascicolo |
| corse di ricerca | **2** | 0 | `RESTRICT` → **cancellazione esplicita** |
| candidati | **15** | 0 | `CASCADE` dalle corse |
| istantanee · decisioni · registro origini | 0 | 0 | niente costruito: la guardia lo pretende |

Le 2 corse sono le prove di merito di `#132` F7. La loro sostanza — la query respinta con
`422 RESEARCH_QUERY_LEAKS_CLIENT` — è già scritta in `.programmi/239-*.md`: l'evidenza resta,
sparisce solo la riga.

**Due lezioni, entrambe già scritte nelle regole e violate comunque**: una FK `RESTRICT` va
enumerata da `pg_constraint`, non ricordata; e il `EXIT=0` che ho letto accanto a quell'errore
era la **pipe verso `tail`** che maschera l'exit code — non l'ho preso per buono.

### L'esito, misurato

Prova generale sul gemello in **cinque atti**, tutti exit 0: esecuzione (`3/3/18/40/7/1` →
`1/1/16/25/7/1`) · **rollback vero** che rimette esattamente `3/3/18/40/7/1` · seconda
esecuzione · terza a vuoto che non fa nulla e non esplode.

**Sabotaggio dichiarato** — le guardie si sono viste ROSSE, che è l'unico modo di sapere che
esistono: una versione dichiarata `APPLIED` → `exit 3`, zero righe toccate; una riga finta nel
registro delle origini → `exit 3`, zero righe toccate; togliendo il sabotaggio → verde.

**Produzione** (sulla VM, `exit=0`): `3/3/18/40/7/1/0` → `1/1/16/25/7/1/0`, resta il solo
`RTL-BANK-CONFIG`, giornale con 21 righe (2 fascicoli · 2 versioni · 2 corse · 15 candidati).

⚠ **Nota operativa, costata nove minuti**: sulla VM l'utente `ubuntu` **non ha un `.pgpass`**, e
un `psql` lanciato da lì si appende muto a un prompt di password. Le credenziali si prendono dal
`.env` del repo con l'idioma di `db/scripts/migrate.sh` (`set -a; . .env; set +a` +
`PGPASSWORD`). Sul gemello non accade: l'utente `enzo` ce l'ha.

---

## V2 — Il test residuo su `surveys`

### Il fatto, misurato

`Test (api integration)` su `d4df1841`: **1 fallito su 1809** (258 file verdi su 259). Il test è
`test/scope-data-classes.integration.test.ts:55`:

```
AssertionError: surveys must stay normal per Enzo: expected true to be false
```

Il codice dice `surveys: "PERSONAL"` (`apps/api/src/lib/scope/data-classes.ts:295`). Ce l'ha
messo `#235` col commit `5b25e360`, che è **antenato di `d4df1841`**, e la ragione è scritta
accanto e **misurata**: 862 risposte su 862 portano `response_subject_user_id`, 6 sondaggi su 6
dichiarano `survey_is_anonymous = false`, e `survey_audience_ids` è vuoto su tutte e 6.

**Quindi il residuo è il test, non il codice**: fissava la frase di Enzo del 2026-07-01 («feedback
& surveys normal»), che per la parte `surveys` è stata superata da una misura. `engagement_feedback`
resta neutro a ragione — è anonimo per costruzione, `sys_engagement_feedback` non ha alcuna
colonna che identifichi l'autore.

### La simulazione

- **Precondizioni** — il codice e il commit `5b25e360` come sopra. Verificate.
- **Meccanismo** — emendare le due righe del test, spostando `surveys` fra i sensibili e citando
  la decisione che lo ha spostato con la sua data. Poi
  `cd apps/api && pnpm exec vitest run test/scope-data-classes.integration.test.ts`.
- **Propagazione** — commit + push; la CI ricorre.
- **Chi** — io.
- **Guardia** — non distruttivo.

---

## V3 — La porta 3001 sul runner

### Il fatto, misurato

La `Playwright smoke` **non** muore su `install-deps` (quello step ha già il fallback a warning e
prosegue). Muore sulla **guardia della porta**, che è progettata per fallire forte invece di
interrogare l'applicazione sbagliata (lezione S984), e ha stampato l'intruso:

```
port 3001 already in use by a foreign process:
LISTEN 0 511 0.0.0.0:3001 users:(("node",pid=89772,fd=32))
```

Misurato **adesso** su linux-pc: `pid=89772` è **ancora in ascolto**. La spiegazione di S1085 era
giusta; il rerun è ripartito mentre il processo era ancora vivo, quindi ha ritrovato lo stesso
muro. Finché quel processo vive, ogni corsa della smoke è rossa — e con essa il deploy resta
armato e mai eseguito.

### La simulazione

- **Precondizioni** — il processo esiste. Da stabilire **cosa** è: un dev server orfano o un
  servizio presidiato.
- **Meccanismo** — `ps -p 89772 -o pid,ppid,lstart,etime,cmd` e `systemctl status` per escludere
  che sia sotto un'unità. Solo dopo, la terminazione.
- **Propagazione** — nessun artefatto; è stato di runtime della macchina.
- **Chi** — l'identificazione io; **la terminazione previa conferma di Enzo**: è un processo su
  una macchina remota, e chiudere porte o processi senza conferma è vietato.
- **Guardia** — non si tocca se il PID appartiene a un'unità systemd o al runner stesso. Il
  bersaglio è un `pnpm dev` orfano, e va riconosciuto come tale prima.

### L'esito

Enzo ha autorizzato la terminazione dell'intera sessione abbandonata (2026-09-03). **Prima di
eseguire ho guardato il bersaglio, e la mia stessa descrizione era da correggere**: il «Tasks: 35»
di `systemctl` sono **thread**, non processi. I processi erano **quattro**, tutti lo stesso albero:

```
45476  pnpm dev
45504    sh -c tsx watch --conditions heuresys-source src/server.ts
45505      tsx cli.mjs watch
89772        node --require tsx/preflight … src/server.ts     ← quello in ascolto sulla 3001
```

`loginctl terminate-session 61` **non ha avuto effetto** (porta ancora occupata dopo 4 secondi):
la terminazione è avvenuta sull'albero dei PID. Esito misurato: **porta 3001 libera**, e i due
servizi veri — API `:8013` e web `:3013` — **ancora in ascolto**.

⭐ Il fatto strutturale, che vale oltre l'incidente e che S1085 aveva già nominato: **il runner
della CI e il campo di prova sono la stessa macchina**. Un `pnpm dev` lasciato acceso lì non è un
residuo innocuo, è una CI rossa — e in questo caso lo è stata per tre giorni, tenendo la
produzione ferma su `bd944a4e`.

---

## V4 — Le PR Dependabot

### Il fatto, misurato

Tre rami Dependabot aperti, non due:

| ramo | rossi | causa |
|---|---|---|
| `dependabot/npm_and_yarn/fastify-5.12.1` | Typecheck · Test(api) · smoke | tipi rotti in `app.ts` + i due rossi condivisi con `main` |
| `dependabot/npm_and_yarn/apps/api/fastify-5.12.1` | Lint · Typecheck · Test(api) · smoke | **lo stesso bump**, duplicato perché la dipendenza compare in due manifest |
| `dependabot/npm_and_yarn/qs-6.16.0` | solo smoke | **nessun difetto proprio**: Typecheck, Lint e Build sono verdi. È bloccato dalla porta 3001 di V3 |

Il difetto vero di fastify 5.12.1, cinque errori in `apps/api/src/app.ts`:

```
src/app.ts(206,5):  TS2769 No overload matches this call.        ← `trustProxy: env.TRUST_PROXY`
src/app.ts(218,28): TS2345 FastifyInstance<Http2SecureServer,…> non assegnabile a
                           FastifyInstance<RawServerDefault,…>
src/app.ts(267,17): TS2345 (stessa firma)
src/app.ts(336,23): TS2345 (l'error handler, stessa firma)
src/app.ts(513,3):  TS2322 (il return di buildApp, stessa firma)
```

**Sono un errore solo, che si propaga.** `env.TRUST_PROXY` è `boolean | number | string`
(`apps/api/src/config/trust-proxy.ts`): con 5.12.1 quel tipo unione non risolve più l'overload di
`Fastify()`, TypeScript ripiega sull'ultimo overload — quello HTTP/2 sicuro — e da lì ogni uso
dell'istanza diventa incompatibile. Fastify è pinnato **esatto** a `5.10.0` in
`apps/api/package.json`.

### La decisione (è mia, Enzo ha detto «decidi tu»)

**Il bump lo facciamo noi in un commit unico, e le due PR fastify si chiudono come superate.**
Perché: sono lo stesso aggiornamento spezzato in due manifest, e nessuna delle due può diventare
verde da sola — la prima non tocca `apps/api/package.json`, la seconda non tocca il lockfile di
radice. Farle verdi separatamente significa correggere due volte lo stesso errore di tipo in due
rami che poi litigano sul lockfile. La terza PR (`qs`) **non si tocca**: è sana e si sblocca da
sé quando V3 libera la porta.

### La simulazione

- **Precondizioni** — riprodurre il typecheck rosso in locale con 5.12.1 installato. **Finché
  non è riprodotto, la correzione non si scrive**: i cinque errori vengono dal log della CI, non
  da una prova mia.
- **Meccanismo** — da decomporre dopo la riproduzione: è essa stessa un'**indagine**, ed è la
  prima cosa che V4 consegna. L'ipotesi da verificare è che basti dichiarare il tipo del
  parametro `trustProxy` invece di passargli l'unione nuda.
- **Propagazione** — commit sul lockfile di radice **e** su `apps/api/package.json`, poi push;
  chiusura delle due PR con la ragione scritta nel commento.
- **Chi** — io.
- **Guardia** — non distruttivo sul codice; la chiusura di una PR è reversibile (si riapre).

### L'esito — e la decisione è cambiata, perché la riproduzione ha detto altro

La riproduzione in locale (`5.12.1` installato, `pnpm typecheck`) ha dato **5 errori, identici a
quelli della CI**. Ma la causa non era quella che avevo ipotizzato — «basta dichiarare il tipo del
parametro». **fastify 5.12.1 ha rimosso di proposito il supporto alla forma numerica di
`trustProxy`**, che è quella che la produzione usa:

```js
// node_modules/fastify/lib/request.js — 5.12.1
if (typeof tp === 'number') {
  // Hop-count-only trust cannot validate the immediate peer. Fail closed…
  return function () { return false }
}
```

Non si fida più di nulla. Con `TRUST_PROXY=1` in produzione (D-28), prendere il bump avrebbe fatto
diventare `req.ip` l'indirizzo del proxy, e il **rate limiting per IP sarebbe finito in un secchio
solo per tutte le richieste** — senza errore, senza log, senza test rosso.

**Quindi il bump non si prende**, e zittire il typecheck con un cast sarebbe stato il modo di
rendere verde il rosso lasciando intatto il difetto. Le due PR (`#76` e `#75` — lo stesso bump
spezzato in due manifest, e nessuna delle due poteva diventare verde da sola) sono state chiuse
con la ragione misurata scritta nel commento. L'albero è tornato a `5.10.0`, verificato:
`require('fastify/package.json').version → 5.10.0`.

Il lavoro che ne consegue — migrare `trustProxy` dalla forma a conteggio di salti a quella per
indirizzo — è registrato come **`#242`**, con la sua decomposizione in
`.programmi/242-fastify-trustproxy-per-indirizzo.md`. `5.12.1` è l'ultima pubblicata: non è
un'attesa che si risolve da sé.

La terza PR (`qs 6.16.0`, `#77`) **non è stata toccata**: non ha difetti propri — Typecheck, Lint
e Build erano già verdi — ed era rossa solo per la porta 3001 di V3, che ora è libera.

---

## Fuori da questo ciclo (registro separato, presentato una volta sola)

- I due RED del cruscotto di avvio: **derivati superati** (`build_derivati.py`) e **peso dello
  stato** al 39% contro la soglia del 25% (`compatta_register.py --esegui`). Non sono nei mandati
  di Enzo.
- La domanda aperta ereditata **«chi ha pushato il 26 agosto alle 18:47?»**, invariata da S1082.
