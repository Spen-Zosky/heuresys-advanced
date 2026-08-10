# Review adversarial — tre revisori, tre lenti, mandato di demolire

## Perche' funziona (e come si rompe)

Tre proprieta' fanno il lavoro, e togliendone una il resto diventa teatro.

**Contesto vuoto.** I revisori non vedono la conversazione: vedono il diff, la descrizione del cluster e il suo `done when`. E' l'unico modo per non condividere il punto cieco di chi ha scritto il codice. Se gli passi il tuo ragionamento, gli passi anche i tuoi assunti.

**Mandato negativo.** Il compito e' trovare il difetto. Un revisore che conclude «va tutto bene» non ha superato l'esame, ha fallito il compito — e va detto nel prompt, altrimenti il modello scivola verso la conferma, che e' la risposta socialmente piu' facile.

**Lenti distinte.** Tre revisori identici sono un revisore con piu' varianza. Tre revisori con mandati diversi coprono modi di sbagliare diversi.

## Come si lanciano

Sempre via **Workflow tool** (`parallel`), mai `Agent` sciolti: serve il cap di concorrenza, l'output strutturato e il fatto che i tre partano davvero insieme. **Ogni revisore registra il proprio verdetto DA SÉ, come suo ultimo atto** — gli agenti del workflow hanno Bash, e il prompt di ogni lente termina con l'ordine di eseguire `zp_review.py registra` prima di restituire qualunque cosa. Al workflow torna solo la conclusione: il diff non rientra nel contesto principale, e se la sessione muore a workflow in volo le lenti già concluse sono comunque su disco.

### Il verdetto si SCRIVE, non si aspetta (S1052 — difetto misurato)

Questa pagina diceva già «i revisori scrivono il verdetto in un file», ma era una frase: nessun meccanismo la imponeva, e il lavoratore restava in attesa del valore di ritorno del workflow. Misurato **due corse su due** sullo stesso cluster (`Z-112`): la sessione finisce per budget prima che i verdetti tornino, il workflow resta orfano, e la sessione successiva **non può più leggerli**. Il piano del lavoratore lo diceva con parole sue — `P5 | tre revisori adversarial | NON concluso — verdetti non tornati`.

Il costo non è il denaro sprecato: è che **nessun lavoratore può chiudere un cluster da solo**, perché il passo 3 non è mai ripartibile. Da qui `zp_review.py`, che rende il file un meccanismo:

```bash
python docs/kb/tools/zp_review.py stato Z-112      # PRIMA di lanciare: c'è già qualcosa?
python docs/kb/tools/zp_review.py registra Z-112 --lente correttezza --json -   # appena una lente conclude
python docs/kb/tools/zp_review.py valida Z-112     # il cancello: 3 su 3 e nessun rilievo grave aperto
```

**Tre regole che ne discendono, e non sono negoziabili:**

1. **Prima di lanciare i revisori si chiede `stato`.** Se due lenti hanno già risposto, si lancia **solo la terza**: rilanciarle tutte è pagare due volte lo stesso giudizio.
2. **Il verdetto lo registra IL REVISORE, dall'interno del proprio run, come ultimo atto** — non l'orchestratore dopo il ritorno del workflow. La differenza si vede solo quando fa male: se la sessione muore a workflow in volo, le lenti già concluse restano su disco; con la registrazione a valle sarebbero perse di nuovo (il difetto di S1052, seconda forma).
3. **Un rilievo senza `come_si_riproduce` viene rifiutato dallo strumento**, non discusso dopo: è un sospetto, e questa pagina lo dice da sempre.

Un rilievo di severità **alta** blocca il cancello finché non porta `risolto_come` — e «risolto» da solo non è una risoluzione: serve il *come*, che è verificabile. Ri-registrare una lente **archivia** il verdetto precedente in `.zp/revisori/storico/` (coi suoi `risolto_come`): il giudizio nuovo riparte pulito, la storia resta.

```
parallel(lentiMancanti.map(lente => () =>
  agent(prompt(lente), {phase: 'Verify', schema: VERDICT})))
```

Il contratto dentro `prompt(lente)`, non negoziabile: *«Il tuo ULTIMO atto, prima di restituire qualunque cosa, è registrare il verdetto tu stesso:*
```bash
python docs/kb/tools/zp_review.py registra <cluster> --lente <lente> --json - <<'VERDETTO'
{"rilievi": [...], "conclusione": "..."}
VERDETTO
```
*Se `registra` esce ≠0 (rilievo senza riproduzione = sospetto), correggi il verdetto e riprova. Poi restituisci SOLO la conclusione.»* — `lentiMancanti` viene da `zp_review.py stato` (regola 1), e l'orchestratore al ritorno (o alla ripresa) rifà `stato` e rilancia solo le lenti senza file.

Schema del verdetto: `{"rilievi": [{"severita": "alta|media|bassa", "file": "...", "riga": N, "cosa": "...", "come_si_riproduce": "..."}], "conclusione": "..."}`.

Un rilievo senza `come_si_riproduce` non e' un rilievo: e' un sospetto. Scartalo o chiedi al revisore di renderlo concreto.

## Le tre lenti

**Correttezza.** Il codice fa cio' che il cluster dichiara? Cerca: casi limite non gestiti, `undefined` da accesso indicizzato o `Map.get()` (il repo ha `noUncheckedIndexedAccess`), errori non tipizzati con le classi di `src/errors/`, transazioni che non usano `withTransaction`, migrazioni non idempotenti, `date` usato dove serviva `timestamptz` o viceversa.

**Isolamento e sicurezza.** Ogni query filtra per tenant? Il repo non usa RLS (`I5`): l'isolamento e' FK + middleware, quindi una query senza filtro e' una fuga di dati fra tenant, non una disattenzione. Cerca anche: `requirePermission` mancante su una route, `verifyCsrf` assente su POST/PATCH/DELETE, dati sensibili raggiunti per via funzionale invece che organizzativa (`I18`), segreti finiti in un file versionato o in un log, SQL costruito per interpolazione.

**Riproducibilita'.** Il `done when` si riproduce da zero? Il revisore rifa' il percorso: esegue il comando, controlla che l'output combaci con l'evidenza allegata, verifica che il test aggiunto falliesca se si annulla la modifica. E' la lente che scopre l'evidenza scritta a memoria e i test che passerebbero comunque — il caso peggiore, perche' e' invisibile a tutti gli altri controlli.

## Regola di maggioranza, e cosa ne segue

Un rilievo **cade** se almeno due revisori lo smontano esplicitamente. Un rilievo che resta va corretto, e dopo la correzione si ri-esegue il passo 2 del protocollo — una correzione non verificata e' solo una nuova ipotesi.

La maggioranza serve a non farsi bloccare da un singolo revisore paranoico, che su una fila di cluster lunga come quella del piano e' statisticamente garantito. Ma vale in una sola direzione: un rilievo di severita' alta sull'isolamento tenant o sui segreti si tratta come vero anche da solo, perche' il costo dello sbaglio non e' simmetrico.

Se i rilievi confermati sono piu' di tre o toccano il disegno e non l'implementazione, il cluster era mal inquadrato: non accumulare correzioni sopra correzioni. `INTERRUPTED`, con i rilievi allegati come materiale per il giro successivo.

## Costo, e perche' vale

Tre agenti in piu' per cluster. Su tutto il piano e' la voce di spesa piu' grande dopo l'implementazione, ed e' anche l'unica che sostituisce Enzo che guarda. Non si taglia per risparmiare: se il budget non basta per l'adversarial, non basta per il cluster — chiudi la sessione e lascia il cluster al giro successivo.

Il modello dei revisori non si abbassa mai sotto quello di sessione: il giudizio e' esattamente la cosa che non si delega verso il basso (vedi `operations.md`).
