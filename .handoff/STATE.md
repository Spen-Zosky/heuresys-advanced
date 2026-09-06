# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1090 (2026-09-06). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief — l'ultima sessione, in breve

Sessione breve, nata da una domanda: *«cosa significa 8 programmi aperti senza corsia?»*. La
misura ha risposto che erano **otto falsi allarmi** — cinque voci chiuse da giorni con il
file-piano rimasto indietro, e tre quaderni di sessione contati come programmi. Curati tutti e
otto, e curata la causa: il quaderno di sessione non è più censito come programma.

Il filo: **un allarme che si accende sempre è un allarme che si impara a non guardare**. E il
cancello che lo diceva — `programmi.py --verifica`, exit 1 — funziona da sempre e **non lo
interroga nessuno**: né il boot, né la chiusura, né la CI. È diventata `#249`.

⚠ Ri-osservato sul vivo: `| tail` **maschera l'exit code**. Un cancello rosso letto attraverso
una pipe sembra verde.

## Top priorities — le priorità

> ⭐ **Mandato di Enzo per la sessione successiva (S1090)**: *processare **tutte** le voci P1, P2 e
> P3 in sequenza automatica, decisa da me e dichiarata all'inizio, senza presentare il menu e
> senza aspettare una scelta.* Il guardiano governa il taglio, non la volontà: alle soglie si
> interrompe comunque. Il mandato si esaurisce con quella sessione.

1. **`#249` F3 — il presidio** (~1 sessione). F1 e F2 sono state **eseguite in questa chiusura**:
   il cancello di fine turno ha rifiutato la chiusura su un `programmi` rosso, e la regola del
   progetto non ammette il «pre-esistente». `programmi.py --verifica` è passato da **29 difetti a
   0** — «50 programma/i, nessun difetto». Resta il bersaglio vero: **nessuno interroga quel
   cancello** (non il boot, non la chiusura, non la CI). Oggi ha fermato la chiusura *per caso*,
   perché i file instradati erano cambiati.
2. **`#219` — il primo giro verde del workflow integrale** (~1 sessione). Il quinto giro ha
   **eseguito la suite** e ne è uscito rosso per una causa d'ambiente, ora corretta; il
   **sesto** (`34050172629`) è in corso. Dettaglio nella sezione dedicata più sotto.
3. **`#169` F3a** (~1-2 sessioni). ⚠ **Serve una decisione tua**: le utenze di collaudo coprono
   `PLATFORM_ADMIN`, `TENANT_ADMIN` e `USER`; restano scoperti *manager*, *outsider* e
   **custodian**. Per la custodia whistleblowing (isolamento assoluto, ADR-0036 §5) va deciso se
   un'utenza di servizio possa portarne il mandato. È sicurezza, non tecnica.

## Open questions — le domande aperte

- ⭐ **Da quali fonti la piattaforma accetta di imparare com'è fatta un'azienda?** — il registro
  ne porta **una sola**. Tre voci ferme qui (`#198`, `#205`, il ponte di `#132`).
- **La ricerca semantica sul gemello è accesa** e ogni corsa integrale costa **due chiamate a
  pagamento** al fornitore di embedding. Va bene, o la si rispegne lì?
- ⚠ **Una chiave API è transitata nell'output di un comando** in S1088 (mai scritta in un file).
  Quella del fornitore di embedding è da ruotare, per prudenza.
- **Chi ha pushato il 26 agosto alle 18:47?** Invariata da S1082.

## ⚠ Questa chiusura NON ha propagato né deployato

Richiesta esplicita di Enzo: commit e push, **senza** allineamento dei cloni e **senza** armare il
deploy. Il profilo diceva `arma: esegui` — saltato **per decisione**, non perché non servisse.

Conseguenza da non fraintendere: **VM e linux-pc restano indietro** e nessun `refs/heads/prod` è
stato armato. `origin/main` invece è avanzato — anche per il push della sessione parallela di
`#219` (fino a `4e9d6d34`): il codice è pubblicato, **non** propagato. Chi riprende propaga prima
di misurare le macchine, e `verifica-deploy.sh` dirà `DISALLINEATO` fino ad allora — è l'atteso,
non un guasto.

## Dove riprendere ESATTAMENTE — `#219` in CI

*Scritto dalla sessione che ha lavorato `#219` in parallelo alla chiusura S1090. Sei giri, e
ogni rosso ha nominato una causa d'ambiente diversa — il valore del workflow è tutto qui.*

- il workflow è `.github/workflows/playwright-integrale.yml`, **`workflow_dispatch` soltanto**:
  non gira su push, quindi non può rompere nulla mentre è in prova;
- **giro 1** (`34038765559`): mancavano i passi preparatori (`tsx: not found`). Corretto
  riusando la sequenza dello smoke;
- **giro 2** (`34039328831`): preflight rosso in due secondi — «porta dell'API NON MISURABILE».
  In locale si deriva dal `.env`; **in CI quel file non esiste**. Dichiarate `PORT` e
  `NEXT_PUBLIC_API_PROXY_BASE_URL` a livello di job (la seconda serve **prima del build**:
  Next compila i rewrites lì dentro);
- **giro 3** (`34040733480`): preflight rosso sull'origine. ⚠⚠ **Il drop-in systemd sul runner
  non vinceva, e `systemctl` non poteva dirlo**:

  ```
  systemctl show -p Environment  → ADMIN_ORIGIN=http://localhost:3187   (quello che credevo)
  strings /proc/<MainPID>/environ → ADMIN_ORIGIN=http://localhost:3000   (quello che c'era)
  ```

  Fra i quattro drop-in, `override.conf` ordina **dopo** e porta
  `EnvironmentFile=/etc/heuresys-runner.env`: systemd applica `Environment=` ed
  `EnvironmentFile=` nell'ordine in cui compaiono e **l'ultimo vince**. `systemctl show`
  **non mostra il contenuto degli EnvironmentFile**, quindi confermava una cosa falsa. Cura:
  `ADMIN_ORIGIN` dichiarata nell'`env:` del job — versionata, visibile nel log, **niente
  `sudo`**. Il drop-in resta sul runner ed è inerte;
- **giro 4** (`34042451236`): preflight verde, **0 casi eseguiti sui 447** — «Could not find a
  production build in the `.next` directory». La config integrale avvia il web con
  `next start`, che pretende un build; in locale lo script di comodo li tiene insieme
  (`"test:e2e:prod": "next build && node scripts/e2e-blocchi.mjs"`) e il workflow chiamava
  **solo la seconda metà**. Aggiunto il build **dopo** il preflight. ⚠⚠ E su quella corsa il
  **triage aveva dichiarato «VERDE»**: quattro referti letti, zero casi dentro. Corretto —
  «referto letto» e «test eseguito» ora si contano separati, e l'esito è **NON MISURABILE**;
- **giro 5** (`34043971361`): la suite ha girato davvero. 17 passati · 4 falliti · **423 non
  eseguiti**, e i quattro falliti erano lo stesso caso in tutte le fasi:
  `auth.setup.ts › authenticate as custodian`, timeout su `waitForURL("**/me")`.
  **La causa l'ha scritta la pagina** nello scatto del fallimento: «Troppi tentativi.»
  `AUTH_LOGIN_RATELIMIT_MAX` non era dichiarata — valeva il default di produzione (**10**) — e
  cadeva sempre il **sesto** personaggio perché è l'ultimo della fila; aprendo un blocco
  `serial` si è portato dietro **350 «non eseguiti»**, che non è «passati».
  ⚠ Due ipotesi più comode misurate e **smentite** prima: in `heuresys_ci` il custodian è
  **identico** a quello di produzione (stesso stato, stessa identità, stessi 4 ruoli) e ha
  **gli stessi 62 permessi**, nessuno `dashboard:*`;
- corretto in `4e9d6d34`: la variabile nel workflow — **l'unica** che `playwright-smoke.yml`
  dichiarava e l'integrale no, trovata confrontando i due blocchi `env:` uno contro l'altro,
  non a memoria — più un **quinto controllo nel preflight**, che interroga l'API viva leggendo
  `x-ratelimit-limit` e si ferma se il tetto è sotto 40. Provato nei tre rami: silenzioso a
  200, rosso sotto soglia, **NON MISURABILE** se l'header manca;
- **giro 6** (`34050172629`): **364 passati · 5 falliti · 78 non eseguiti**, e dei 78 ben 76
  sono esclusioni **dichiarate** (censimenti a comando, casi senza dati su questo tenant,
  `#8` in attesa di credenziale). La suite è quindi sostanzialmente in piedi in CI: restano
  **cinque** casi, in tre famiglie, tutte misurate e tutte d'ambiente — nessuna del prodotto:
  1. **passkey/WebAuthn (2)** — `WEBAUTHN_ORIGINS` vale `http://localhost:3000` per default e
     in CI il web nasce sulla **3187**: la registrazione rispondeva **400**. Stessa specie di
     `ADMIN_ORIGIN`, un elenco chiuso mai aggiornato per la porta della CI. Dichiarata nel job;
  2. **ricerca semantica (2)** — `MATCHING_FREETEXT_ENABLED` è spenta per default, e **ogni
     ricerca è una chiamata a pagamento**. Accenderla in CI è una **decisione di costo, non
     tecnica** (→ domande aperte). Finché è spenta i due casi si dichiarano **non eseguiti**
     con la ragione scritta, invece di fallire come se il prodotto fosse rotto: la condizione
     è una variabile dichiarata (`E2E_RICERCA_SEMANTICA=0`) e **non una sonda**, perché
     interrogare l'API costerebbe una chiamata in più proprio dove il flag è acceso;
  3. **fascicolo di RTL (1)** — `RTL-BANK-CONFIG` misurato: **1** in produzione, **0** in
     `heuresys_ci`. Lo crea uno **script** (`db/scripts/ricostruisci-fascicolo-rtl.ts`), non
     una migrazione, e la catena applicata al clone non lo porta con sé — la trappola già
     registrata. Aggiunto come passo preparatorio: è idempotente e si verifica da sé;
- **giro 7**: lanciato dopo quelle tre correzioni.
  `gh run list --workflow=playwright-integrale.yml --limit 3`; se rosso,
  `gh run view <id> --log-failed`.

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py        # menu + salute, un solo giro
python docs/kb/tools/programmi.py --verifica # SENZA pipe: la pipe maschera l'exit code
python docs/kb/tools/handoff_lint.py         # coerenza dello stato, bloccante
bash scripts/verifica-deploy.sh              # atteso DISALLINEATO: S1090 non ha propagato
bash scripts/posso-uscire.sh                 # ⚠ l'ssh e' contato per MACCHINA, non per sessione
gh run list --workflow=playwright-integrale.yml --limit 3
ssh linux-pc 'cat /proc/loadavg'             # prima di ogni corsa E2E: sotto 2
```
