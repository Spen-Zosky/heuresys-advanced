# Stato su file e selezione del prossimo cluster

## Perche' lo stato non puo' stare in conversazione

Ogni iterazione nasce con contesto vergine: e' il meccanismo che sostituisce `/clear`, non un effetto collaterale. Quindi «mi ricordo che stavo facendo Z-042» non esiste come categoria. Se una informazione serve alla prossima iterazione e non e' su disco, e' perduta.

Questo e' anche cio' che rende il loop robusto a interruzioni brutali: corrente che salta, terminale chiuso, errore del modello, VM che non risponde. Lo stato e' su disco, non nella testa di nessuno, e la ripresa e' una lettura.

| File | Chi ci scrive | Cosa contiene |
|---|---|---|
| `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` | questa skill | caselle spuntate + nota di chiusura con evidenza |
| `docs/kb/SOT_BACKLOG.md` (Action register) | **solo `handoff`** | stato ufficiale: `ACTIVE`/`INTERRUPTED`/`HOLD`/`WAIT-INPUT`/`DONE` + `resume-from` |
| `.handoff/session-journal.ndjson` | questa skill, in corsa | fatti mentre emergono: `bash scripts/journal-append.sh <kind> <ref> <note>` |
| `.zp/cursor.json` | questa skill | cluster corrente, passo raggiunto, iterazione, sha di partenza |
| `.zp/todo.json` | questa skill | i cluster eleggibili, ordinati |
| `.zp/last-outcome.json` | questa skill | il segnale per il driver (forme in `SKILL.md`) |
| `.zp/runs.ndjson` | questa skill | un record per iterazione: modo, cluster, gate, agenti, token, esito, durata |
| `.zp/PROGRESS.md` | questa skill | la vista umana, in italiano, leggibile da telefono |

`.zp/` e' gitignored per i file di runtime, con un'eccezione voluta: `PROGRESS.md` viene committato a ogni chiusura di sessione, cosi' Enzo lo legge su GitHub dal telefono senza accendere il PC. Non e' uno state file nuovo nel senso vietato da `CLAUDE.md` — e' una vista derivata, e i conteggi che contiene puntano alle fonti, non le sostituiscono.

## Se il cluster te l'hanno ASSEGNATO, non si sceglie

Quando l'invocazione porta `--cluster Z-nnn`, quel cluster **e' il tuo, e non ne scegli un altro**. Arriva dal driver in modalita' `gov` (#173), che con piu' lavoratori in parallelo assegna prima di aprire le sessioni e ha gia' preso il lucchetto su quel cluster.

Non e' una preferenza: senza questo, N lavoratori applicherebbero l'ordine qui sotto — che e' **deterministico** — e otterrebbero **tutti lo stesso cluster**, lavorando lo stesso lavoro N volte, ciascuno nel proprio albero, con N chiusure in conflitto alla fine.

Cosa resta valido anche col cluster assegnato:

- il **gradino 0** si applica lo stesso: se il criterio e' gia' soddisfatto, lo chiudi come «risolto per altra via» e scrivi `{"outcome": "cluster-closed", ...}`. Non passi al successivo di tua iniziativa — la scelta del prossimo e' del driver;
- se il cluster assegnato **non e' eleggibile** (bloccato su Enzo, dipendenze aperte, gia' chiuso), non ne sostituisci un altro: scrivi `{"outcome": "blocked", "cluster": "Z-nnn", "reason": "..."}` e chiudi. Sara' il driver a riassegnare, perche' e' l'unico che sa cosa stanno facendo gli altri lavoratori.

Senza `--cluster`, vale l'ordine di sempre.

## Ordine di selezione — deterministico, non a intuito

Applica i filtri in quest'ordine e prendi il primo cluster che sopravvive. L'ordine non e' arbitrario: ogni gradino evita un modo specifico di sprecare lavoro.

0. **Il criterio e' gia' soddisfatto?** Prima di lavorare un cluster, **riesegui il suo criterio di
   chiusura**. Se passa gia', il cluster si chiude come **«risolto per altra via»** citando
   l'evidenza (comando + output + data) e si passa al successivo. Costa secondi; l'alternativa e'
   spendere ore su un problema che non esiste piu'. Se il criterio non e' rieseguibile con un
   comando, il cluster va **prima riscritto perche' lo sia** — un criterio che nessun comando puo'
   verificare non e' un criterio, e' un'opinione.

   *Perche' e' il passo zero e non un dettaglio*: il piano e' stato censito una volta e la sessione
   canonica continua a lavorare in parallelo, quindi lo scarto fra «aperto nel piano» e «aperto
   nella realta'» cresce ogni giorno. Misurato in lab il 2026-08-03 su un campione mirato di 8
   cluster aperti: **8 su 8** erano gia' risolti, a premessa mutata, o con l'effort da riscrivere.
   La sessione di prova di quello stesso impianto ha perfino proposto **Z-203**, chiuso in S1032
   con la casella mai spuntata. Senza questo gradino il loop lavora sulla fotografia invece che
   sulla realta'.

1. **`INTERRUPTED` con `resume-from`** — priorita' assoluta. Un lavoro a metta' e' la cosa piu'
   fragile che esiste nel repo: piu' resta aperto, piu' il contesto che lo giustificava svanisce.
2. **`blocking: HARD`** — cluster che tengono fermo altro lavoro. Chiuderne uno sblocca N.
3. **Ondata corrente** — non si salta avanti. Le ondate sono ordinate perche' W2 (test e CI) e' la
   rete che protegge W3-W5: lavorare su W4 con la rete bucata significa non accorgersi dei danni.
4. **`dependsOn` tutti risolti** — se una dipendenza e' aperta, il cluster non e' pronto, e
   forzarlo produce lavoro da rifare.
5. **Classe ammessa dalla corsia** — vedi `blast-radius.md`. Un cluster di classe non ammessa non
   viene «rinviato»: va accodato nel lotto presidiato e riportato a Enzo.
6. **Effort che sta nel budget residuo dell'iterazione** — meglio un cluster chiuso che due a
   metta'. Se nessun cluster ci sta, il modo giusto e' `close`, non iniziare e troncare. Il tetto
   non e' una valutazione tua: il driver passa `--budget-ore` con
   `budget.max_effort_hours_per_cluster` (oggi 4) e i cluster piu' grandi non compaiono fra i
   candidati. Prima che fosse passato davvero, la coda conteneva cluster da 18 ore contro un
   budget di 12 dollari a iterazione — cioe' troncamento garantito, che e' il modo di fallire
   piu' costoso. Un lavoro piu' grande del tetto va spezzato nel piano, o fatto presidiato.

A parita' di tutto, prendi l'effort minore: libera caselle, riduce il rumore nel piano, e rende il `PROGRESS.md` piu' informativo per chi legge da fuori.

## Aggiornare il cursore

Scrivi `.zp/cursor.json` **prima** di iniziare il lavoro, non dopo, e aggiornalo a ogni passo del protocollo. Il valore sta tutto nel caso peggiore: se l'iterazione muore fra il passo 3 e il 4, la successiva deve sapere che l'implementazione c'e' e i revisori no.

```json
{
  "cluster": "Z-042",
  "step": "adversarial",
  "iteration": 7,
  "started_at_sha": "3596be42",
  "notes": "verifica A verde (integration), verifica B da fare (psql)"
}
```

## Quando un cluster va interrotto

Interrompere non e' fallire: e' registrare un limite. Serve, nell'ordine: `status: INTERRUPTED` nel blocco del register (preparato da qui, scritto da `handoff`), un `resume-from` che dica il punto esatto, e una ragione **verificata** — comando eseguito e output, non un'impressione. «Non sembrava funzionare» non e' una ragione: la prossima iterazione la rileggerebbe e ripartirebbe da zero, e il cluster girerebbe in tondo per sempre.

Se il lavoro parziale ha i gate verdi, committalo: e' progresso reale. Se non li ha, mettilo in `git stash` e scrivi il riferimento dello stash nel run-record — un working tree sporco che attraversa le sessioni e' il modo piu' rapido per far collidere questo loop con una sessione umana.
