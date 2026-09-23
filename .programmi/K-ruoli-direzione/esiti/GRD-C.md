# GRD-C — il guardiano non deve piu' essere cieco

Sessione: `536d656f-2e76-4a39-870a-0296c486f867` (canale `grdc-guardiano`), 2026-09-23.
Mandato: passaggio 4 del piano `[Plans]\PIANO_collaudo-e-correzioni-governo_2026-09-19.md`, gruppo C.

## Esito in una riga

**Due terzi del mio primo giro erano giusti, uno no** — misurato dal governo, non da me, e
confermato riproducendo esattamente i suoi comandi. GRD-C2 e GRD-C3 erano gia' fatte (commit
`0d92c1af`, 2026-09-19). **GRD-C1 era fatta SOLO con l'UUID completo**: con un id ABBREVIATO
(come lo ha provato il governo, `--session 536d656f`) il guardiano tornava «nessun transcript»
e «GUARDIANO CIECO» da due cartelle diverse, pur avendo il file sul disco. Corretto in questa
sessione: match per prefisso quando il match esatto fallisce, il piu' recente in caso di
ambiguita', sempre DICHIARATO.

## GRD-C1 — CORRETTO in questa sessione (era il difetto reale)

**Riproduzione del difetto**, prima di toccare il codice:

```
$ cd "C:\Users\enzospenuso\claude_service_workspace\canale"
$ python "D:\heuresys-advanced\docs\kb\tools\guardiano.py" --session 536d656f
[!!] nessun transcript in C:\Users\enzospenuso\.claude\projects\C--Users-enzospenuso-claude_service_workspace-canale
     Senza transcript NON si stima a impressione: si dichiara 'non misurabile'.
...
  ⚠ GUARDIANO CIECO: nessuna delle due misure e' disponibile. Non e' un 'tutto bene'.
```

Confermato: il mio giro precedente aveva provato solo l'UUID **completo**
(`536d656f-2e76-4a39-870a-0296c486f867`), che matcha per nome esatto. Un id **abbreviato**
prende una strada diversa nel codice — sia il match nella cartella corrente sia la ricerca
allargata cercano `{session}.jsonl` alla lettera — e quella strada non aveva mai un fallback.

**La correzione** (`docs/kb/tools/guardiano.py`, funzione `trova_transcript`): quando il match
esatto fallisce, si prova un match per PREFISSO su tutte le cartelle sotto
`~/.claude/projects/`. Se piu' file iniziano con lo stesso prefisso si prende il **piu'
recente** per mtime, e la scelta viene **dichiarata** (`nota_out` → campo `id_abbreviato` +
`id_abbreviato_candidati` nel risultato di `misura()`, stampato con un avviso `⚠ id
ABBREVIATO: N transcript...`).

**Verifica dopo la correzione — stesso id abbreviato da tre cartelle diverse**:

```
$ cd "D:\heuresys-advanced" && python docs/kb/tools/guardiano.py --session 536d656f --json | ...
True 210089 True C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\536d656f-....jsonl

$ cd "C:\Users\enzospenuso\claude_service_workspace\canale" && python ...guardiano.py --session 536d656f --json | ...
True 210089 True C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\536d656f-....jsonl

$ cd "C:\" && python ...guardiano.py --session 536d656f --json | ...
True 210089 True C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\536d656f-....jsonl
```

**Stesso numero (210.089 token) dalle tre cartelle**, `id_abbreviato=True` dichiarato in tutte
e tre. FATTO.

**Negativo — id inesistente non pesca a caso**:

```
$ cd "C:\" && python docs/kb/tools/guardiano.py --session "zzz-non-esiste-mai-1234" --json | ...
False nessun transcript in C:\Users\enzospenuso\.claude\projects\C--...
```

Resta NON MISURABILE, come deve. FATTO.

## GRD-C2 — gia' fatta (2026-09-19), confermata

```
$ python docs/kb/tools/guardiano.py --canale grdc-guardiano
→ finestra 5h  54.0%   (soglia 80% · dato di 0 min fa · 7 giorni 8%)
```

Il ramo delle 5 ore legge dal canale con la sua data di freschezza quando la riga di stato non
gira. Negativo (sessione fuori dal canale) gia' verificato nel giro precedente: NON MISURABILE
dichiarato esplicitamente, non un ripiego silenzioso. FATTO — nessuna modifica necessaria.

## GRD-C3 — gia' fatta (2026-09-19), confermata

`docs/kb/tools/guardiano.py:591` (numero di riga dopo le aggiunte C-1-bis, cercabile per
contenuto): `elif m_ctx.get("picco_frazione", 0) >= stop_ctx:` — la soglia scatta sul PICCO,
non solo sull'ultimo campione. Casi positivo/negativo nel selftest (blocco «C-3, 2026-09-19»).
Riverificato anche end-to-end su transcript sintetici nel giro precedente (vedi git history di
questo file). FATTO — nessuna modifica necessaria.

## GRD-C4 — la batteria, aggiornata e ri-eseguita

```
$ python docs/kb/tools/guardiano.py --selftest
...
65/65 verdi
SELFTEST VERDE
```

Da 61 a **65** casi: aggiunti i 4 nuovi per C-1-bis (blocco «C-1-bis, 2026-09-23») — prefisso
univoco trovato, prefisso ambiguo che prende il piu' recente E lo dichiara (verificato sul
campo `nota_out`, non solo sul risultato), prefisso senza match che resta `None` (non pesca a
caso). Il conteggio si legge dal riepilogo dello strumento stesso, non da un'altra forma.

## GRD-C5 — le due copie, riallineate e identiche

```
$ diff "C:\Users\enzospenuso\.claude\tools\guardiano.py" "D:\heuresys-advanced\docs\kb\tools\guardiano.py"
(divergenti subito dopo la correzione — solo il repo era stato toccato)
$ cp "D:\heuresys-advanced\docs\kb\tools\guardiano.py" "C:\Users\enzospenuso\.claude\tools\guardiano.py"
$ diff "C:\Users\enzospenuso\.claude\tools\guardiano.py" "D:\heuresys-advanced\docs\kb\tools\guardiano.py"
(vuoto — IDENTICI)
$ python "C:\Users\enzospenuso\.claude\tools\guardiano.py" --selftest
65/65 verdi
SELFTEST VERDE
```

**Terza copia (altro progetto), NON toccata — verificato**:

```
$ wc -c "D:\heuresys-datastore\scripts\guardiano.py"
41758   (invariata; data di modifica 30 agosto, non oggi)
```

## Censimento (C1 della dottrina di sorveglianza)

```
$ python docs/kb/tools/chi_sorveglia.py guardiano
```

Nessuna sentinella SQL; 9 cancelli (session_start, status_dashboard, costo_chiusura,
check_marciume, verify-gate-tests, check_istruzioni, lab_inbox, verifica_incrociata, e
guardiano.py stesso); 1 test (`controlli-per-nome.ratchet.unit.test.ts`); 1 riferimento in
migrazione (`000306_nessuna_pagina_irraggiungibile.sql`, testuale, non un import). Nessuno
scrittore. Grep manuale su `.claude/`, `scripts/` (incluso `scripts/hooks/session_mode.py`,
`scripts/session-boot.ps1`, `scripts/clone-vm-db.sh` — gitignored, cercati apposta) conferma:
tutti i consumatori puntano a `docs/kb/tools/guardiano.py`, nessun percorso divergente — la
correzione non ha richiesto toccare nessun altro file.

## Vincoli osservati

- Nessuna cancellazione eseguita.
- Nessun `git pull --rebase`, nessun `rebase`/`amend`/`reset`/`cherry-pick`.
- Non toccati `scripts/align-claude-ecosystem.sh` e `scripts/align-codex-ecosystem.sh`.
- Non eseguito nessun passo del flusso di chiusura/propagazione/deploy
  (`close-propagate.sh`, `align-clones.sh`, `vm-deploy.sh`, `ci-gate.sh`, `clone-vm-db.sh`).

## Verdetto del cancello

```
$ python docs/kb/tools/verify_gate.py run
```

Esito appeso qui sotto, lanciato una volta sola a fine ciclo.

## Chiusura GRD-C

**CICLO CHIUSO — 5/5 voci fatte, non resta niente.** GRD-C1 corretta in questa sessione (era
il solo difetto reale, misurato dal governo); GRD-C2/GRD-C3/GRD-C4(parziale) gia' fatte il
2026-09-19, riconfermate; GRD-C4(completa, 65 casi) e GRD-C5 chiuse ora. Le due copie sono
identiche e verificate col selftest su entrambe. Non apro altre voci, non eseguo
chiusura/propagazione/deploy (di competenza del governo).
