# Modo `bootstrap` — prima invocazione sul progetto

Serve una volta per progetto, e di nuovo solo se il piano risulta assente o incoerente. Il resto
delle iterazioni entra da `resume`. Se `bootstrap` viene invocato quando il piano e' sano, non
rifare il censimento: verifica, riporta, e passa a `resume`.

## 1. Apri la sessione come la aprirebbe Enzo

```bash
python docs/kb/tools/session_start.py --no-net
```

Un solo processo: menu register-driven + dashboard di salute in modalita' offline-fast. Se il
tunnel e' giu' aggiungi `--no-db` e annota che i numeri DB non sono ri-derivati. Non leggere
`SOT_BACKLOG.md` / `SOT_STATE.md` / `DEBT_REGISTER.md` in forma grezza qui: sono ~450KB in gran
parte storici, e lo script li distilla gia'. Si aprono in drill-down, sul singolo item.

Se il tunnel :5433 non risponde, rialzalo prima di proseguire:

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
```

## 2. Verifica l'integrita' del piano — non rifarlo

Il censimento esiste gia': `docs/superpowers/specs/2026-07-25-zero-pending-plan.md`, costruito da
dieci finder indipendenti su fonti disgiunte, consolidato e verificato da tre verificatori
adversarial (497 voci grezze → 248 cluster, 0 perse, 0 inventate). Rifarlo da zero butterebbe la
cosa piu' costosa che il progetto possiede. Quindi si **verifica**:

- il conteggio dei cluster corrisponde a quello dichiarato nell'intestazione del piano;
- ogni riferimento `dependsOn` risolve a un cluster esistente;
- le caselle spuntate hanno una nota di chiusura con evidenza, non solo la spunta;
- ogni cluster ha un `done when` che e' un comando, non una frase;
- ogni cluster ha una classe di raggio d'impatto in `zp.config.yaml` (se manca, il cluster non e'
  eleggibile per nessuna corsia — segnalalo, non indovinare la classe).

Un'incoerenza qui non e' un dettaglio: il loop seleziona i cluster **da questo file**, e un
`dependsOn` rotto significa lavoro eseguito nell'ordine sbagliato senza che nessuno lo noti.

## 3. Aggiorna solo le fonti stale

Il censimento invecchia per fonte, non in blocco. Misura la staleness e ri-censisci **solo** cio'
che si e' mosso: `git log --since` per path-glob sulle aree di codice, `gh run list` per la CI,
`psql` per i gap runtime, `gh api` per gli alert di dipendenze. Le fonti immobili non si toccano.

Un censimento completo da zero si fa solo su richiesta esplicita, e prima si dichiara il costo
nella forma prevista da R20 — «~N agenti, ~X token, procedo?» — perche' e' l'operazione piu' cara
dell'intero impianto.

## 4. Ricostruisci la todo tracciabile

La todo non e' un elenco nuovo: e' la vista sui cluster eleggibili nella corsia corrente,
ordinata come in `selection.md`. Scrivila in `.zp/todo.json` (macchina) e riflettila in
`.zp/PROGRESS.md` (umana). Se una lista di lavoro esiste solo in conversazione, la prossima
iterazione — che nasce smemorata — non la trovera'.

## 5. Dichiara le regole con cui opererai

Prima di toccare il primo cluster, scrivi in chiaro: corsia attiva e quali classi include, tetti
di iterazioni e budget, perimetro del push autorizzato, condizione di uscita, e cosa farai quando
un cluster richiede Enzo. Serve a Enzo, che legge da remoto e deve poter verificare in dieci
secondi che stai operando dentro il perimetro che ha autorizzato — e serve a te, perche' una
regola dichiarata all'inizio della sessione resta nel contesto per tutta la sessione.

Poi scrivi `.zp/last-outcome.json` e passa a `resume`.
