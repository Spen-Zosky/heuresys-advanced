# Inventario stash — S1112, 2026-09-19

Verificati sul vivo (`git stash show -p`, `git log`, grep sul main attuale). Nessuno
applicato, nessuno droppato — per regola di questa corsa gli stash non si toccano oltre
la lettura.

## stash@{1} — 26 luglio 2026, "Z-257 INTERRUPTED S1032 — registro GDPR esaustivo"

**Contenuto**: 3 file (`apps/api/src/modules/gdpr/repository.ts`,
`apps/api/test/gdpr.integration.test.ts`, `packages/shared/src/schemas/gdpr.ts`) — introduce
una colonna `gdpr_map_reference_kind` (SUBJECT/ACTOR) sul registro GDPR e riscrive il test
anti-drift per coprire l'intero grafo FK verso `sys_users`, non solo un sottoinsieme filtrato
per nome.

**Verdetto: SUPERATO, non applicabile.** Il main di oggi ha già la stessa funzionalità, fatta
meglio:
- la colonna `gdpr_map_reference_kind` esiste da mig. `000216_gdpr_export_actor_references.sql`
  (elenco esplicito delle righe ACTOR, non una regex — la nota nel file cita esplicitamente
  "la stessa scelta e' costata Z-257");
- il test odierno (`apps/api/test/gdpr.integration.test.ts:186`, "Z-259 — the export bundle
  carries NO identifier of any other person") verifica esattamente il rilievo "export ACTOR
  espone dati altrui" citato nel messaggio dello stash, con una prova più forte (bundle
  reale, non solo classificazione);
- mig. `000304_gdpr_registry_covers_belonging_not_prefix.sql` ha già chiuso il buco di
  copertura (27 tabelle scoperte, filtro per APPARTENENZA non per prefisso), con
  post-condizioni che il diff dello stash non aveva.

**Il secondo rilievo nominato nel messaggio** ("migrazione auto-riapplicata disarma il gate")
**non è nel diff dello stash** — i 3 file toccano solo il primo rilievo. Non risulta un
problema aperto oggi: la dottrina generale che lo previene (ADR-0035, "una tabella non si
ritira cancellandola da un file successivo, si emenda la fonte") è già in vigore e applicata
sistematicamente nelle migrazioni GDPR successive (es. `000304`, `ON CONFLICT ... DO UPDATE`
per farla sopravvivere a una correzione futura). Se Enzo vuole una verifica mirata su questo
punto specifico, è un lavoro a parte — non l'ho aperto qui perché il diff reale non lo tocca.

**Costo di un'integrazione**: nessuno. Non c'è niente da integrare — il lavoro è già fatto,
in una forma più robusta.

## stash@{0} — 18 agosto 2026, `docs/kb/atlas/concepts-corpus.jsonl` (55+/53-)

**Contenuto**: un solo file, l'artefatto generato dall'atlas cross-layer (`build_atlas.py`).

**Verdetto: SUPERATO, non applicabile.** Non è lavoro umano da recuperare: è uno snapshot di
un dato rigenerabile. Il file ha continuato a essere riscritto dopo quella data attraverso i
normali commit di handoff (`git log` mostra `d9a84004`, `d337b9aa`, `9f62c7a1`... tutti
`chore: handoff`), ed è oggi a 109 righe contro le 94 di quello stash. Applicare lo stash
sovrascriverebbe un mese di rigenerazioni con uno snapshot vecchio. Se l'atlas ha bisogno di
un refresh, lo strumento è `python docs/kb/tools/build_atlas.py` — non questo stash.

**Costo di un'integrazione**: nessuno, e sarebbe una regressione se fatta.

## Conclusione

Nessuno dei due stash porta lavoro da integrare. Entrambi restano nello stash (non toccati,
non droppati, come da regola di questa corsa) in attesa che Enzo confermi se vanno droppati in
una sessione futura — non è una decisione che questa sessione prende.
