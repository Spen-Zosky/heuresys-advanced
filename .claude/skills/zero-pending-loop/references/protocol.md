# Protocollo di esecuzione di un cluster

E' il «Protocollo di chiusura di un cluster» del piano zero-pendenze, reso meccanico. La
differenza fra una procedura scritta e una procedura eseguibile e' che la seconda si puo'
rifiutare: due dei cinque passi qui sotto sono verificati da uno script, non dalla buona volonta'.

## Passo 1 — Implementazione

Segui i pattern del repo, non pattern importati da altri progetti. Per un modulo API il pattern e'
quello a 7 passi in `CLAUDE.md` (schema Zod in `packages/shared` → repository con SQL
parametrizzato → service con `ActorContext` → routes con `requirePermission` + `verifyCsrf` →
registrazione allo step 13 di `app.ts` → integration test → commit atomico). Non spezzare un
modulo su piu' commit.

Gli invarianti `I1`-`I20` sono vincoli, non consigli. Se il cluster per chiudersi richiede di
violarne uno, **non cercare un aggiramento**: fermati, registra la contraddizione con
`file:riga`, e metti il cluster nel vassoio bloccati-su-Enzo. `CLAUDE.md` e' esplicito sul punto —
quando un requisito sembra contraddire un invariante, si chiede. In non presidiato «si chiede»
significa: si scrive nel vassoio e si passa al prossimo.

## Passo 2 — Due prove di natura diversa

Il problema che questo passo risolve e' strutturale, non morale. Chi ha scritto il codice ha un
punto cieco su cio' che il codice fa, e un test scritto dalla stessa mano nella stessa sessione
tende a verificare il comportamento **osservato** invece di quello **desiderato**. Due prove dello
stesso tipo condividono il punto cieco; due prove di natura diversa no.

L'esempio che rende la cosa concreta: un endpoint nuovo. Prova A = test d'integrazione che chiama
l'endpoint e verifica la risposta. Prova B = query `psql` sul DB reale che verifica che la riga sia
stata scritta. Se A e' verde e B no, hai appena scoperto un endpoint che risponde `200` senza
scrivere niente — e due test d'integrazione non l'avrebbero visto mai.

`zp_gate.py` conosce le coppie ammesse e **rifiuta** una coppia omogenea. Se la rifiuta, il modo
corretto non e' aggirarla: e' produrre la seconda prova.

| Prova A | Prova B ammessa |
|---|---|
| integration test su DB reale (tunnel :5433) | prova live con evidenza: comando + output + path assoluto + timestamp |
| test automatico | unit test sul ramo che l'integrazione non raggiunge |
| Playwright E2E con login di una persona reale | query `psql` che conferma la mutazione lato DB |
| migrazione applicata due volte con diff `pg_dump` vuoto | `pnpm db:validate` (7 viste) verde |
| `typecheck` + `lint` verdi | comportamento verificato a runtime sull'endpoint o sulla pagina |

I test che scrivi restano nel repo: sono parte del cluster, non impalcatura da buttare. Un cluster
che chiude con due prove e nessun test aggiunto ha verificato, non protetto.

## Passo 3 — Review adversarial

Vedi `adversarial.md`. Tre revisori, contesto vuoto, lenti distinte, mandato di demolire.

## Passo 4 — Correzione e ri-test

I rilievi che sopravvivono alla regola di maggioranza si correggono, e dopo la correzione si
**ri-esegue** il passo 2. Non basta correggere: una correzione non verificata e' una nuova ipotesi.

Il loop interno ha un limite di **due giri**. Al terzo il cluster va `INTERRUPTED` con la ragione
verificata (vedi `selection.md`). Il limite non e' pigrizia: due tentativi falliti nella stessa
direzione sono il segnale che il problema e' diverso da come lo stai inquadrando, e in non
presidiato non c'e' nessuno che ti fermi.

## Passo 5 — Commit atomico con evidenza

Nessun cluster si chiude su un test verde. Serve una dimostrazione su dati reali —
`zp_evidence.py` produce il blocco canonico:

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

Se per chiudere serve un input che solo Enzo puo' dare — un segreto, una decisione di business,
un'autorizzazione — lo stato e' `blocked-on-Enzo: <cosa, perche'>`. Mai `done`. Un «done» falso e'
peggio di un lavoro non fatto, perche' toglie il cluster dal radar e nessuno lo ricontrollera'.

## Il `done when` si esegue, non si interpreta

Ogni cluster del piano porta un `done when` che e' un criterio osservabile con un comando.
Eseguilo e allega l'output. Se il `done when` e' ambiguo o non e' un comando, il cluster non e'
pronto: correggi il `done when` nel piano — e' un miglioramento reale, non una deviazione — e
segnalalo nel run-record.
