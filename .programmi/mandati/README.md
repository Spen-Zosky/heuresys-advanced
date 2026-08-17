# `.programmi/mandati/` — i piani di CICLO, che non sono programmi di voce

**La distinzione, e perché esiste una cartella in più** (S1067, 2026-08-17).

`programmi.py` governa i **programmi multi-sessione**: una voce del register che vale 2-8 sessioni,
agganciata con `> **item**: #N`, che una sessione riprende da dove l'altra l'ha lasciata. Tre dei
suoi controlli presuppongono quell'aggancio.

Un **mandato di ciclo** è un'altra cosa: è il piano-file che `R24 §1` pretende all'apertura di una
sessione — *«ogni ciclo nasce come tabella: una riga per deliverable, con id · cosa · chi · cosa
significa fatto · stato»*. Tocca **molte** voci, non una, e si esaurisce con la sessione.

Metterli nella stessa cartella produceva tre difetti a testa che non erano difetti: «manca
`> **item**: #N`» su un piano che di voci ne tocca dieci. Lo strumento aveva ragione sulla forma e
torto sull'oggetto: **non erano programmi**.

`programmi.py` legge `.programmi/*.md` al primo livello (`carica()`, `d.glob("*.md")`), quindi i
mandati qui dentro sono fuori dal suo radar per costruzione — non per un'esclusione da mantenere.

**Dove sta l'esito, quando un ciclo finisce**: nel register (`SOT_BACKLOG.md`) e in
`.handoff/STATE.md`. Questi file restano come cronaca di **come** ci si è arrivati, non come stato.
