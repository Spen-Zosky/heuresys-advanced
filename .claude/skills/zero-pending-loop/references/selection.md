# Stato su file e selezione del prossimo cluster

## Perche' lo stato non puo' stare in conversazione

Ogni iterazione nasce con contesto vergine: e' il meccanismo che sostituisce `/clear`, non un
effetto collaterale. Quindi «mi ricordo che stavo facendo Z-042» non esiste come categoria. Se una
informazione serve alla prossima iterazione e non e' su disco, e' perduta.

Questo e' anche cio' che rende il loop robusto a interruzioni brutali: corrente che salta,
terminale chiuso, errore del modello, VM che non risponde. Lo stato e' su disco, non nella testa
di nessuno, e la ripresa e' una lettura.

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

`.zp/` e' gitignored per i file di runtime, con un'eccezione voluta: `PROGRESS.md` viene
committato a ogni chiusura di sessione, cosi' Enzo lo legge su GitHub dal telefono senza accendere
il PC. Non e' uno state file nuovo nel senso vietato da `CLAUDE.md` — e' una vista derivata, e i
conteggi che contiene puntano alle fonti, non le sostituiscono.

## Ordine di selezione — deterministico, non a intuito

Applica i filtri in quest'ordine e prendi il primo cluster che sopravvive. L'ordine non e'
arbitrario: ogni gradino evita un modo specifico di sprecare lavoro.

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
   metta'. Se nessun cluster ci sta, il modo giusto e' `close`, non iniziare e troncare.

A parita' di tutto, prendi l'effort minore: libera caselle, riduce il rumore nel piano, e rende
il `PROGRESS.md` piu' informativo per chi legge da fuori.

## Aggiornare il cursore

Scrivi `.zp/cursor.json` **prima** di iniziare il lavoro, non dopo, e aggiornalo a ogni passo del
protocollo. Il valore sta tutto nel caso peggiore: se l'iterazione muore fra il passo 3 e il 4,
la successiva deve sapere che l'implementazione c'e' e i revisori no.

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

Interrompere non e' fallire: e' registrare un limite. Serve, nell'ordine: `status: INTERRUPTED`
nel blocco del register (preparato da qui, scritto da `handoff`), un `resume-from` che dica il
punto esatto, e una ragione **verificata** — comando eseguito e output, non un'impressione. «Non
sembrava funzionare» non e' una ragione: la prossima iterazione la rileggerebbe e ripartirebbe da
zero, e il cluster girerebbe in tondo per sempre.

Se il lavoro parziale ha i gate verdi, committalo: e' progresso reale. Se non li ha, mettilo in
`git stash` e scrivi il riferimento dello stash nel run-record — un working tree sporco che
attraversa le sessioni e' il modo piu' rapido per far collidere questo loop con una sessione
umana.
