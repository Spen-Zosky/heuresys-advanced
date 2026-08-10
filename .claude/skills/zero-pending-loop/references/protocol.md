# Protocollo di esecuzione di un cluster

E' il «Protocollo di chiusura di un cluster» del piano zero-pendenze, reso meccanico. La differenza fra una procedura scritta e una procedura eseguibile e' che la seconda si puo' rifiutare: due dei cinque passi qui sotto sono verificati da uno script, non dalla buona volonta'.

## Passo 1 — Implementazione

Segui i pattern del repo, non pattern importati da altri progetti. Per un modulo API il pattern e' quello a 7 passi in `CLAUDE.md` (schema Zod in `packages/shared` → repository con SQL parametrizzato → service con `ActorContext` → routes con `requirePermission` + `verifyCsrf` → registrazione allo step 13 di `app.ts` → integration test → commit atomico). Non spezzare un modulo su piu' commit.

Gli invarianti `I1`-`I20` sono vincoli, non consigli. Se il cluster per chiudersi richiede di violarne uno, **non cercare un aggiramento**: fermati, registra la contraddizione con `file:riga`, e metti il cluster nel vassoio bloccati-su-Enzo. `CLAUDE.md` e' esplicito sul punto — quando un requisito sembra contraddire un invariante, si chiede. In non presidiato «si chiede» significa: si scrive nel vassoio e si passa al prossimo.

## Passo 2 — Due prove di natura diversa

Il problema che questo passo risolve e' strutturale, non morale. Chi ha scritto il codice ha un punto cieco su cio' che il codice fa, e un test scritto dalla stessa mano nella stessa sessione tende a verificare il comportamento **osservato** invece di quello **desiderato**. Due prove dello stesso tipo condividono il punto cieco; due prove di natura diversa no.

L'esempio che rende la cosa concreta: un endpoint nuovo. Prova A = test d'integrazione che chiama l'endpoint e verifica la risposta. Prova B = query `psql` sul DB reale che verifica che la riga sia stata scritta. Se A e' verde e B no, hai appena scoperto un endpoint che risponde `200` senza scrivere niente — e due test d'integrazione non l'avrebbero visto mai.

`zp_gate.py` conosce le coppie ammesse e **rifiuta** una coppia omogenea. Se la rifiuta, il modo corretto non e' aggirarla: e' produrre la seconda prova.

La regola non e' «due strumenti diversi» ma **due livelli diversi del sistema** (ridisegno S1030): `unit` guarda il codice isolato, `integration` l'API contro il DB reale, `e2e` l'interfaccia come la vedrebbe una persona, `psql` e `dbvalidate` cio' che e' rimasto scritto, `live` e `runtime` il sistema in esecuzione, `migrate2` la ripetibilita'. Due prove sullo stesso livello condividono il punto cieco, qualunque strumento usino. E **`staticcheck` non conta mai** come una delle due: typecheck e lint sono la soglia d'ingresso. La regola precedente li ammetteva come meta' evidenza — l'esatto contrario di «nessun cluster si chiude su un test verde».

Qui non c'e' l'elenco delle coppie, ed e' voluto: una lista ricopiata a mano invecchia e comincia a mentire. Si interroga il codice, che e' l'unico posto dove la regola e' applicata davvero.

```bash
python docs/kb/tools/zp_gate.py tipi         # i tipi riconosciuti e il livello di ciascuno
python docs/kb/tools/zp_gate.py prove A B    # questa coppia e' ammessa? esce 1 se rifiutata
```

I test che scrivi restano nel repo: sono parte del cluster, non impalcatura da buttare. Un cluster che chiude con due prove e nessun test aggiunto ha verificato, non protetto.

## Passo 3 — Review adversarial

Vedi `adversarial.md`. Tre revisori, contesto vuoto, lenti distinte, mandato di demolire.

**Il passo comincia da `stato`, non dal lancio.** I verdetti vivono su disco, quindi una sessione che riprende deve prima guardare cosa c'è già:

```bash
python docs/kb/tools/zp_review.py stato <cluster>    # quali lenti hanno risposto
```

Si lanciano **solo le lenti mancanti**, e ogni verdetto si registra appena arriva. Il passo è concluso quando `zp_review.py valida <cluster>` esce 0 — tre lenti su tre, nessun rilievo di severità alta ancora aperto.

Questo rende il passo 3 **ripartibile**, che è ciò che non era: in S1052 due corse su due si sono fermate qui, con i verdetti persi in un workflow orfano di una sessione finita per budget. Se il budget finisce a metà, le lenti già registrate restano — la corsa dopo non le rifà.

## Passo 4 — Correzione e ri-test

I rilievi che sopravvivono alla regola di maggioranza si correggono, e dopo la correzione si **ri-esegue** il passo 2. Non basta correggere: una correzione non verificata e' una nuova ipotesi.

Il loop interno ha un limite di **due giri**. Al terzo il cluster va `INTERRUPTED` con la ragione verificata (vedi `selection.md`). Il limite non e' pigrizia: due tentativi falliti nella stessa direzione sono il segnale che il problema e' diverso da come lo stai inquadrando, e in non presidiato non c'e' nessuno che ti fermi.

## Passo 5 — Commit atomico con evidenza

Nessun cluster si chiude su un test verde. Serve una dimostrazione su dati reali — `zp_evidence.py` produce il blocco canonico:

```
verified-by:
  comando:   pnpm exec vitest run test/goals.integration.test.ts
  output:    12 passed (12) — estratto: "goals:write enforced for MANAGER"
  path:      D:\heuresys-advanced\apps\api\test\goals.integration.test.ts
  timestamp: 2026-07-25T23:41:07+02:00
```

Poi:

- **commit atomico**, stile del log esistente (`feat(api): …`, `fix(web+api): …`, `docs(debt): …`).
  Soggetto sotto i 50 caratteri, nessun corpo se non serve, nessun boilerplate di co-autore.
- **spunta la casella** nel piano zero-pendenze e scrivici la nota di chiusura con l'evidenza. E'
  la traccia che rende il piano leggibile a chi arriva dopo.
- **prepara il blocco** per l'Action register e fallo validare da `handoff_lint.py`. Non scriverlo
  tu nel register: `handoff` e' l'unico writer, e la scrittura avviene alla chiusura.
- **appendi al journal**: `bash scripts/journal-append.sh done Z-042 "<una riga>"`.

Se per chiudere serve un input che solo Enzo puo' dare — un segreto, una decisione di business, un'autorizzazione — lo stato e' `blocked-on-Enzo: <cosa, perche'>`. Mai `done`. Un «done» falso e' peggio di un lavoro non fatto, perche' toglie il cluster dal radar e nessuno lo ricontrollera'.

## Il `done when` si esegue, non si interpreta

Ogni cluster del piano porta un `done when` che e' un criterio osservabile con un comando. Eseguilo e allega l'output. Se il `done when` e' ambiguo o non e' un comando, il cluster non e' pronto: correggi il `done when` nel piano — e' un miglioramento reale, non una deviazione — e segnalalo nel run-record.
