---
name: zero-pending-loop
description: >-
  Esegue UNA iterazione del loop autonomo non presidiato che porta heuresys-advanced verso
  zero pendenze: seleziona il prossimo cluster dal piano zero-pendenze, lo implementa, lo
  verifica con due prove su livelli diversi, lo sottopone a tre revisori adversarial, corregge
  i rilievi confermati, committa con evidenza live — poi decide se continuare o chiudere la
  sessione perche' il driver esterno ne apra una nuova con contesto pulito.
  USA QUESTA SKILL quando Enzo dice: "zero pendenze", "azzera le pendenze", "lavora in
  autonomia", "vai in autopilota", "prossimo cluster", "prossima ondata", "riprendi il
  piano", "zero-pending", "chiudi i debiti aperti", "continua da solo", "vai avanti senza
  di me"; oppure quando cita `docs/superpowers/specs/2026-07-25-zero-pending-plan.md`,
  `.zp/PROGRESS.md`, `zp.config.yaml` o `scripts/zero-pending-driver.sh`. Attivala anche
  quando l'invocazione arriva da `claude -p "/zero-pending-loop <modo>"` (e' il driver che
  chiama), e anche se Enzo chiede di procedere da solo su questo progetto senza nominare
  il piano.
  NON usare per: chiusura sessione chiesta a se' stante (-> `handoff`) · aggiornare la
  conoscenza o l'atlas (-> `project-atlas`) · audit forense e QA E2E (-> `full-forensic-audit`,
  `web-qa-audit`, `forensic-100x-kickoff`) · due diligence investor (->
  `saas-investor-due-diligence`) · topologia o BFS del grafo (-> `graphify`) · grafo
  Ruoli-Dashboard-Pagine (-> `consolida-pagina`) · delega multi-fase via
  `cowork_code_exchange` (-> `ralph-build-loop`, congelato su questo progetto).
---

# zero-pending-loop

## Cosa possiede questa skill, e cosa no

Possiede **il ciclo**: quale cluster si affronta adesso, con quali prove si chiude, quando si smette. Non possiede **nessuno stato**. Lo stato ufficiale del progetto resta dove sta oggi — `docs/kb/SOT_BACKLOG.md`, `SOT_STATE.md`, `DEBT_REGISTER.md`, di cui `handoff` e' l'unico writer. Questa skill legge da tutti, spunta le caselle del piano zero-pendenze, committa il lavoro, e per lo stato ufficiale passa da `handoff`.

Il motivo per cui il confine e' disegnato cosi': se domani la skill viene rimossa, il progetto resta identico e nessun file diventa illeggibile. Un ciclo che si appropria dello stato crea una seconda verita', e in un repo con due writer sullo stesso file la prima divergenza costa una sessione intera di indagine.

**Il loop non vive qui.** Vive in `scripts/zero-pending-driver.sh`, fuori dalla sessione, perche' il contesto di una sessione non puo' azzerarsi da dentro (`/clear` non e' invocabile da una skill, non esiste un hook su contesto esaurito). Ogni invocazione del driver nasce con contesto vergine: **quella e' la ripartenza**. La conseguenza pratica governa tutto il resto — vedi `references/selection.md`: cio' che serve per riprendere va scritto su file, mai tenuto a mente.

## Pre-condizione: non lavorare senza i gate

Prima di qualsiasi cosa, verifica che esistano `docs/kb/tools/zp_zero_check.py` e `docs/kb/tools/zp_gate.py`. Se manca uno dei due, **fermati e dillo**: senza i controlli meccanici questa skill non ha le garanzie che la rendono sicura in non presidiato, e girare comunque significherebbe fare lavoro autonomo su produzione con la rete di sicurezza staccata. Lo stesso vale per `references/zp.config.yaml`: se i cluster non sono classificati per raggio d'impatto, nessuna corsia e' autorizzata.

**E poi il freno, che oggi e' inserito.** Leggi `meta.autorizzato_non_presidiato` (`python docs/kb/tools/zp_state.py config meta.autorizzato_non_presidiato`). Se e' `false`, **non eseguire nessun cluster**: scrivi `.zp/last-outcome.json` con `{"outcome": "blocked", "reason": "freno inserito: meta.autorizzato_non_presidiato=false", "next": "stop"}` e fermati, dicendo perche'. Il driver ha lo stesso controllo (exit 3), ma il driver non e' l'unica via d'ingresso: senza questa verifica una invocazione a mano scavalcherebbe il freno, e la frase «l'impianto non parte» sarebbe falsa. Togliere il freno e' una decisione di Enzo, mai una deduzione tua: se e' lui a chiederti esplicitamente di procedere in questa sessione, allora la corsa e' **presidiata** — dillo, e trattala come tale.

## I cinque modi

L'argomento dell'invocazione seleziona il modo. Senza argomento, il modo e' `resume`.

| Modo | Quando arriva | Cosa fa | Dettaglio |
|---|---|---|---|
| `bootstrap` | prima invocazione sul progetto, o piano assente/incoerente | apre la sessione, verifica l'integrita' del piano, aggiorna le sole fonti stale, ricostruisce la todo tracciabile, dichiara le regole con cui operera' | `references/bootstrap.md` |
| `resume` | ogni iterazione del driver | seleziona un cluster, lo porta a termine col protocollo, aggiorna piano e register, decide se continuare o chiudere | `references/selection.md` + `references/protocol.md` |
| `close` | cluster dell'iterazione chiuso, kill switch, fine ondata, nessun cluster eleggibile | chiude la sessione per intero: gate, commit, push, propagazione, handoff; poi segnala al driver di ripartire | `references/close.md` |
| `censimento` | solo su richiesta esplicita di Enzo (`zp censimento ok`) — mai automatico, mai dal turno di notte | rilegge da capo tutte le fonti di pendenze, scrive un **piano nuovo datato**, lo classifica per raggio d'impatto, e **riporta avanti le decisioni terminali** del piano precedente | `references/bootstrap.md` §Censimento nuovo |
| `recover` | il driver ha rilevato una sessione morta senza chiusura (lock orfano + cursore aperto + nessun outcome) | ricostruisce da `.zp/cursor.json` e dal working tree: committa il parziale se i gate sono verdi, altrimenti stash + `INTERRUPTED` con `resume-from`; poi passa la mano a `resume` | `references/driver.md` §Fermata brutale |
| `report` | su richiesta di Enzo, anche a loop fermo | stato leggibile senza toccare niente: ondata, cluster chiusi e aperti, vassoio bloccati-su-Enzo, spesa, prossimi candidati | `references/close.md` §Report |

## Il contratto con il driver

Il driver non interpreta la prosa: legge l'ultima riga di output e il file di segnale. Chiudi **sempre** ogni invocazione scrivendo `.zp/last-outcome.json` con una di queste forme — e` cio' che permette al driver di distinguere «ho finito il cluster» da «sono stato troncato», che sono due cose completamente diverse:

```json
{"outcome": "cluster-closed",  "cluster": "Z-042", "next": "continue"}
{"outcome": "cluster-closed",  "cluster": "Z-042", "next": "close-requested", "reason": "budget 82%"}
{"outcome": "cluster-interrupted", "cluster": "Z-042", "reason": "<ragione verificata>", "resume_from": "<punto>"}
{"outcome": "session-closed",  "pushed": "<sha>", "next": "restart"}
{"outcome": "nothing-to-do",   "next": "stop"}
{"outcome": "blocked", "reason": "<precondizione mancante>", "next": "stop"}
```

Se l'invocazione viene troncata dall'esterno — tetto `--max-budget-usd` raggiunto, errore, processo ucciso — il file non viene scritto: il driver tratta l'assenza come **troncamento**, non come fallimento del cluster, e la prossima iterazione riprende dal `resume_from` che trova nel register.

## Le cinque regole che non si negoziano

Sono poche perche' ognuna copre un modo specifico in cui il lavoro autonomo degenera.

**Due prove su livelli diversi del sistema, non due esecuzioni della stessa cosa.** Chi scrive il codice ha un punto cieco su cio' che il codice fa, e un test scritto dalla stessa mano verifica il comportamento osservato, non quello desiderato. La seconda prova deve guardare da un altro livello — l'esempio canonico e' un test d'integrazione verde accanto a una query `psql` che mostra che la riga non e' stata scritta. `zp_gate.py` rifiuta una coppia omogenea; se la rifiuta, non e' un ostacolo da aggirare, e' il suo lavoro. La regola vive nel codice, non in una lista da ricopiare: `zp_gate.py tipi` e `zp_gate.py prove A B` la dicono. Perche' sia quella: `references/protocol.md`.

**Tre revisori istruiti a demolire.** Contesto vuoto, vedono solo il diff e il cluster, un mandato negativo ciascuno su lenti distinte. Un rilievo cade solo se almeno due lo smontano. Il mandato e' negativo perche' un revisore premiato per il «va bene» non e' un revisore. `references/adversarial.md`.

**Nessun cluster si chiude su un test verde.** Serve una prova live su dati reali con comando, output, path assoluto e timestamp (ADR-0026). Se manca un input che solo Enzo puo' dare, lo stato e' `blocked-on-Enzo: <cosa, perche'>` — mai `done`. Un «done» falso e' peggio di un lavoro non fatto, perche' toglie il cluster dal radar.

**La classe decide la corsia, non l'urgenza.** Un cluster puo' costare mezz'ora ed essere capace di spegnere la produzione: l'effort e il rischio sono indipendenti. La classe D non entra mai in corsia non presidiata, e non e' una questione di disciplina — e' lo script che la esclude. `references/blast-radius.md`.

**Due tentativi falliti nella stessa direzione bastano.** Al terzo non si aumenta lo sforzo, si cambia oggetto: il cluster va `INTERRUPTED` con la ragione *verificata* (non «sembrava non funzionare») e si passa al prossimo. Insistere in non presidiato brucia budget senza convergere.

## Dove guardare

Leggi il file che serve al passo in cui sei, non tutti in apertura.

| File | Leggilo quando |
|---|---|
| `references/bootstrap.md` | modo `bootstrap`: apertura sessione, verifica del piano, cosa dichiarare |
| `references/selection.md` | devi scegliere il prossimo cluster, o capire dove riprendere |
| `references/protocol.md` | stai eseguendo un cluster: i cinque passi, le coppie di prove, il blocco di evidenza |
| `references/adversarial.md` | devi lanciare i revisori: prompt, lenti, regola di maggioranza, cosa fare dei rilievi |
| `references/blast-radius.md` | devi sapere se un cluster e' ammesso nella corsia corrente e con quali precondizioni |
| `references/gates.md` | devi sapere quali controlli servono per le aree che hai toccato |
| `references/operations.md` | scelta di modello ed effort, budget, `/goal`, e tutti i casi di degradazione |
| `references/close.md` | modo `close` o `report` |
| `references/driver.md` | contratto del driver: interruzione, ripresa, recupero da sessione morta, finestra oraria, guard-rail all'avvio |
| `references/zp.config.yaml` | la configurazione viva: classi dei cluster, corsie, tetti, perimetro del push |
| `references/LEARNINGS.md` | prima di iniziare (gotcha noti) e alla fine (ci scrivi il run-record) |
