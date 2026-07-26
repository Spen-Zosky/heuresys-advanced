# LEARNINGS — cio' che la prossima iterazione non deve ri-scoprire

Due sezioni con criteri diversi. Qui sopra va cio' che **cambia il comportamento** di chi legge; i numeri per iterazione vanno in `.zp/runs.ndjson`, non qui.

## Lezioni

*(vuoto — si popola con l'uso)*

## Gotcha noti al bootstrap — pre-caricati, non ri-diagnosticare

Questi sono già stati pagati in sessioni precedenti. Se ne incontri uno, applica il rimedio e vai avanti: indagare di nuovo costa un'ora e non produce informazione nuova.

**Playwright crasha all'import su Node ≥23** (D-36). Su Windows con Node 24, Playwright 1.61 muore prima di eseguire. Rimedio: `pnpm test:e2e:prod:node22`. Passthrough su Node ≤22, quindi CI e VM non sono toccate.

**`test:e2e` non e' per la suite intera** (D-24). La configurazione dev serve all'iterazione su una singola spec: le sessioni di auth vivono 15 minuti. Per la suite completa esiste solo `test:e2e:prod`.

**Vitest: una transazione per file, rollbackata alla fine** (D-52). `now()` e' congelato per file, e le fixture create in `beforeAll` vengono annullate con il resto. Se un test non vede dati appena inseriti, quasi sempre e' questo. Via di fuga: `TEST_TX_ISOLATION=0`.

**SSH non interattivo verso VM e Mac da Git Bash** (verificato S962). Serve `MSYS_NO_PATHCONV=1` davanti a `ssh`, altrimenti MSYS converte i path POSIX dentro la stringa remota (`/usr/local/bin` diventa `C:Gitusrlocalbin`) e il comando remoto fallisce con `command not found`. E `node`/`pnpm` arrivano da nvm, non da Homebrew: nel comando remoto serve `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`.

**Mai incanalare `close-propagate.sh` in `tail`/`head`/`grep`** (pagato S1032). Con `bash scripts/close-propagate.sh ... | tail -12` l'exit code che leggi e' quello di `tail`, quindi **sempre 0**: lo script puo' terminare con `[FATAL] channel(s) failed on a reachable host` e il task viene riportato come riuscito. In quella sessione linux-pc e' rimasto un commit indietro e la chiusura e' stata dichiarata pulita per un minuto. Peggio: il log utile viene scartato, quindi la diagnosi e' persa e resta solo «ha fallito». Rimedio: redirigere su file (`> "$LOG" 2>&1`), leggere `$?` subito dopo, e solo poi filtrare il file. Vale per qualunque script chiacchierone di cui ti serve l'esito — e' la stessa classe del bug `PIPESTATUS` di `clone-vm-db.sh` (S1030).

**`close-propagate.sh` NON vuole `MSYS_NO_PATHCONV=1` davanti** (fix S1000). Lo gestisce per singola chiamata ssh; un export globale rompe lo staging dei path locali di `align-claude-ecosystem`.

**PowerShell: `$ErrorActionPreference = "Stop"` e gli eseguibili chiacchieroni.** Qualunque riga su stderr di `pg_dump`, `git`, `ssh` diventa un errore terminante anche se e' informativa e l'exit code sarebbe 0. Nei blocchi che li invocano usa `Continue` e controlla `$LASTEXITCODE`, non `try/catch`. Costo storico: `pg_dump` fallito due volte nella stessa sessione.

**PowerShell: comandi inline con virgolette annidate profonde si rompono in silenzio.** Il processo termina in meno di due secondi senza eseguire nulla e senza errore. Scrivi uno `.ps1` ed eseguilo con `-File`.

**Rate limit sul login: 10 tentativi in 5 minuti.** Le suite E2E che rifanno il login per ogni spec lo colpiscono. Riusa la sessione dove possibile.

**Il tunnel :5433 cade dopo un logout Windows.** Non e' un guasto: rialzalo e vai avanti.

**`bash` nel PATH di Windows non e' Git Bash** (verificato 2026-07-25). Risolve a `C:\Users\enzospenuso\AppData\Local\Microsoft\WindowsApps\bash.exe`, lo stub WSL, che risponde «sottosistema Windows per Linux non ha distribuzioni installate». Un `bash scripts/qualcosa.sh` lanciato da PowerShell **non fallisce con un errore chiaro**: fallisce con quello. Usa sempre il path assoluto `C:\Git\bin\bash.exe` (Git Bash 5.3.15, cygwin). Sta in `zp.config.yaml` §runtime.

**Su Windows `subprocess(shell=True)` e' `cmd.exe`, non una shell POSIX** (verificato 2026-07-25, tre criteri rotti in un colpo). `cmd.exe` non conosce `VAR=valore comando` e non tratta gli apici singoli come delimitatori: `MSYS_NO_PATHCONV=1 ssh host 'systemctl ...'` e `gh api ... --jq '...'` non partono proprio, e l'errore che stampano parla d'altro. Rimedio: instradare i comandi attraverso Git Bash — `subprocess.run([bash, '-lc', cmd])` — leggendo il path da `zp.config.yaml` §runtime. Vale per qualunque tool Python di questo repo che invochi comandi scritti in sintassi POSIX.

**Un alert di sicurezza non chiudibile non e' una pendenza aperta**, se il rischio e' accettato per iscritto. La condizione di fine chiedeva «zero alert aperti»: con D-75 (brace-expansion, non applicabile) sarebbe stata irraggiungibile per sempre. La domanda giusta e': *ogni alert aperto compare nel DEBT_REGISTER?* Regola generale: una condizione di uscita che ignora le decisioni gia' prese non converge mai.

**La CI di Dependabot non e' la CI del progetto.** I run sui branch `dependabot/*` includono i security-update che non si possono applicare e restano rossi per sempre. Nel giudizio «CI verde» va contato solo cio' che gira su `main` con evento `push`, `schedule` o `workflow_dispatch`.

**Mai passare un path assoluto MSYS a Python** (verificato 2026-07-25, costo: una diagnosi sbagliata). In Git Bash `$PWD` e' `/d/heuresys-advanced`, e Python su Windows non sa aprire quel formato: fallisce con `FileNotFoundError`. Il driver leggeva cosi' la config, falliva in silenzio, e interpretava «non riesco a leggere» come «cluster non classificati» — fail-safe, ma per la ragione sbagliata e quindi indiagnosticabile. Rimedio: non si passano path a Python. Si usa `zp_state.py config <chiave>`, che il path se lo calcola da `__file__`, e per i file di runtime si usano path relativi (il driver e' gia' dentro `$REPO`).

**Mai fare sostituzioni cieche di caratteri su un sorgente** (verificato 2026-07-25). Normalizzare gli apostrofi curvi in `zp_gate.py` ha trasformato `l'integrazione` dentro una stringa a apici singoli in un terminatore di stringa: `SyntaxError` immediato. Se serve normalizzare, si fa a mano sui punti interessati, oppure si compila subito dopo (`python -m py_compile`) per accorgersene nello stesso minuto.

**`Set-Content -Encoding UTF8` su PowerShell 5.1 scrive il BOM.** Su un file YAML o su un config letto da Python il BOM diventa un carattere invisibile in testa che rompe il parsing. Per riscrivere un file preservando l'encoding: `[System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding($false)))`.

**`--max-turns` non esiste su claude CLI** (verificato 2026-07-25 su 2.1.220, `claude --help`). L'unico tetto quantitativo per invocazione e' `--max-budget-usd`. Il limite ai turni si ottiene dalla clausola `or stop after N turns` dentro `/goal`. Se qualcuno lo reintroduce nel driver come flag, il comando fallisce all'avvio.

## Formato del run-record

Un oggetto per riga in `.zp/runs.ndjson`. Serve a rendere misurabile l'andamento del loop e a capire, a posteriori, quali gate hanno davvero trovato qualcosa.

```json
{"iter": 1, "modo": "resume", "cluster": "Z-042", "classe": "B",
 "gate": ["typecheck", "lint", "vitest", "psql"], "prove": ["integration", "psql-live"],
 "agenti": 3, "rilievi_confermati": 1, "token": 184000, "durata_s": 1420,
 "esito": "cluster-closed", "push_sha": "a1b2c3d", "gotcha": null}
```

Cosa farne al giro successivo: se un gate non ha mai trovato niente in venti iterazioni, e' un candidato a essere spostato piu' in basso nell'ordine (non a essere rimosso). Se un tipo di cluster produce sistematicamente rilievi confermati, il modello per quella famiglia va promosso. Ogni adattamento va scritto in `adaptive:` in `zp.config.yaml`, con il perche', e deve essere annullabile azzerando quella sezione.

I prompt e i template non si toccano da soli. Cambiano per mano di Enzo o su proposta esplicita: un impianto che riscrive le proprie istruzioni mentre gira non e' piu' verificabile, e la sua storia non e' piu' ricostruibile.
