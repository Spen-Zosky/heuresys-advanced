# Review adversarial — tre revisori, tre lenti, mandato di demolire

## Perche' funziona (e come si rompe)

Tre proprieta' fanno il lavoro, e togliendone una il resto diventa teatro.

**Contesto vuoto.** I revisori non vedono la conversazione: vedono il diff, la descrizione del
cluster e il suo `done when`. E' l'unico modo per non condividere il punto cieco di chi ha scritto
il codice. Se gli passi il tuo ragionamento, gli passi anche i tuoi assunti.

**Mandato negativo.** Il compito e' trovare il difetto. Un revisore che conclude «va tutto bene»
non ha superato l'esame, ha fallito il compito — e va detto nel prompt, altrimenti il modello
scivola verso la conferma, che e' la risposta socialmente piu' facile.

**Lenti distinte.** Tre revisori identici sono un revisore con piu' varianza. Tre revisori con
mandati diversi coprono modi di sbagliare diversi.

## Come si lanciano

Sempre via **Workflow tool** (`parallel`), mai `Agent` sciolti: serve il cap di concorrenza,
l'output strutturato e il fatto che i tre partano davvero insieme. I revisori scrivono il verdetto
in un file e restituiscono solo il verdetto strutturato — il diff non torna nel contesto principale.

```
parallel([
  () => agent(prompt('correttezza'),   {phase: 'Verify', schema: VERDICT}),
  () => agent(prompt('isolamento'),    {phase: 'Verify', schema: VERDICT}),
  () => agent(prompt('riproducibilita'), {phase: 'Verify', schema: VERDICT}),
])
```

Schema del verdetto: `{"rilievi": [{"severita": "alta|media|bassa", "file": "...", "riga": N,
"cosa": "...", "come_si_riproduce": "..."}], "conclusione": "..."}`.

Un rilievo senza `come_si_riproduce` non e' un rilievo: e' un sospetto. Scartalo o chiedi al
revisore di renderlo concreto.

## Le tre lenti

**Correttezza.** Il codice fa cio' che il cluster dichiara? Cerca: casi limite non gestiti,
`undefined` da accesso indicizzato o `Map.get()` (il repo ha `noUncheckedIndexedAccess`), errori
non tipizzati con le classi di `src/errors/`, transazioni che non usano `withTransaction`,
migrazioni non idempotenti, `date` usato dove serviva `timestamptz` o viceversa.

**Isolamento e sicurezza.** Ogni query filtra per tenant? Il repo non usa RLS (`I5`): l'isolamento
e' FK + middleware, quindi una query senza filtro e' una fuga di dati fra tenant, non una
disattenzione. Cerca anche: `requirePermission` mancante su una route, `verifyCsrf` assente su
POST/PATCH/DELETE, dati sensibili raggiunti per via funzionale invece che organizzativa (`I18`),
segreti finiti in un file versionato o in un log, SQL costruito per interpolazione.

**Riproducibilita'.** Il `done when` si riproduce da zero? Il revisore rifa' il percorso: esegue il
comando, controlla che l'output combaci con l'evidenza allegata, verifica che il test aggiunto
falliesca se si annulla la modifica. E' la lente che scopre l'evidenza scritta a memoria e i test
che passerebbero comunque — il caso peggiore, perche' e' invisibile a tutti gli altri controlli.

## Regola di maggioranza, e cosa ne segue

Un rilievo **cade** se almeno due revisori lo smontano esplicitamente. Un rilievo che resta va
corretto, e dopo la correzione si ri-esegue il passo 2 del protocollo — una correzione non
verificata e' solo una nuova ipotesi.

La maggioranza serve a non farsi bloccare da un singolo revisore paranoico, che in una fila di 218
cluster e' statisticamente garantito. Ma vale in una sola direzione: un rilievo di severita' alta
sull'isolamento tenant o sui segreti si tratta come vero anche da solo, perche' il costo dello
sbaglio non e' simmetrico.

Se i rilievi confermati sono piu' di tre o toccano il disegno e non l'implementazione, il cluster
era mal inquadrato: non accumulare correzioni sopra correzioni. `INTERRUPTED`, con i rilievi
allegati come materiale per il giro successivo.

## Costo, e perche' vale

Tre agenti in piu' per cluster. Su 218 cluster e' la voce di spesa piu' grande dopo
l'implementazione, ed e' anche l'unica che sostituisce Enzo che guarda. Non si taglia per
risparmiare: se il budget non basta per l'adversarial, non basta per il cluster — chiudi la
sessione e lascia il cluster al giro successivo.

Il modello dei revisori non si abbassa mai sotto quello di sessione: il giudizio e' esattamente la
cosa che non si delega verso il basso (vedi `operations.md`).
