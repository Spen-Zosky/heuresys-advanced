# GRD-C — il guardiano non deve piu' essere cieco

Sessione: `536d656f-2e76-4a39-870a-0296c486f867` (canale `grdc-guardiano`), 2026-09-23.
Mandato: passaggio 4 del piano `[Plans]\PIANO_collaudo-e-correzioni-governo_2026-09-19.md`, gruppo C.

## Esito in una riga

**GRD-C1, GRD-C2, GRD-C3, GRD-C4 erano gia' state implementate e committate il 2026-09-19,
19:08:48, commit `0d92c1af` — 4 giorni prima che questo mandato venisse scritto.** Le ho
verificate dal vivo in questa sessione, non ri-eseguite: la conclusione e' misurata, non
dedotta dal messaggio del commit.

```
$ cd "D:\heuresys-advanced" && git log -1 --format="%h %ad %s" --date=format:"%Y-%m-%d %H:%M:%S" -- docs/kb/tools/guardiano.py
0d92c1af 2026-09-19 19:08:48 fix(kb): guardiano - tre rami ciechi chiusi, e la copia del repo riallineata
```

Il commit copre letteralmente le tre correzioni richieste (C-1 transcript da qualunque
cartella, C-2 canale, C-3 picco), ognuna con caso positivo e negativo nel selftest — stessa
numerazione, stessa descrizione del mandato GRD-C1/C2/C3. Messaggio completo nel log git.

## Perche' il mandato descrive un guardiano cieco se era gia' corretto

L'episodio delle 02:24 del 2026-09-23 e' reale (misurato: vedi sotto), ma **non e' lo stesso
difetto** che C-1/C-2/C-3 risolvono. In quel controllo — fatto PRIMA di aprire una sessione,
dalla cartella del canale, senza un `--session` ne' un `--canale` — non esisteva ancora
nessun transcript da trovare: non e' un ramo cieco da riparare, e' una misura impossibile per
costruzione (non si puo' leggere il contesto di una sessione che non e' ancora nata). Il
guardiano ha correttamente dichiarato NON MISURABILE. Le correzioni di 4 giorni prima
risolvono un problema diverso e reale: **una sessione GIA' APERTA**, con un id, misurata da
una cartella che non e' la sua. E' quel caso che ho riprodotto e verificato qui sotto.

## GRD-C1 — il transcript si trova da qualunque cartella

Stesso session-id reale di questa sessione (`536d656f-2e76-4a39-870a-0296c486f867`), eseguito
da tre cartelle diverse:

```
$ cd "D:\heuresys-advanced" && python docs/kb/tools/guardiano.py --session 536d656f-2e76-4a39-870a-0296c486f867 --json | ...
True 133431 C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\536d656f-...jsonl

$ cd "C:\Users\enzospenuso\claude_service_workspace\canale" && python ...\guardiano.py --session ... --json | ...
True 133431 C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\536d656f-...jsonl

$ cd "C:\" && python ...\guardiano.py --session ... --json | ...
True 133431 C:\Users\enzospenuso\.claude\projects\D--heuresys-advanced\536d656f-...jsonl
```

**Stesso numero (133.431 token) dalle tre cartelle**, inclusa `C:\` — esattamente la
posizione da cui il commit del 19/09 riporta il difetto originale ("non misurabile" pur
avendo il dato sul disco). FATTO.

## GRD-C2 — le 5 ore di una sessione del canale si leggono dal canale

Positivo (sessione del canale, `grdc-guardiano`, la mia — `stato.json` aggiornato 0,1 min fa):

```
$ python docs/kb/tools/guardiano.py --canale grdc-guardiano --json | ... ['cinque_ore']
{'ok': True, 'percento': 49.0, 'frazione': 0.49, ..., 'eta_min': 0.1,
 'fonte': '...\canale\grdc-guardiano\stato.json',
 'nota': 'le 5 ore vengono dal canale (grdc-guardiano), non dalla riga di stato: quella era
          dato stantio (5480 min > 15): la riga di stato non gira, non lo si usa per decidere'}
```

Negativo (sessione che non esiste nel canale):

```
$ python docs/kb/tools/guardiano.py --canale sessione-inesistente-xyz --json | ... ['cinque_ore']
{'ok': False, 'errore': "... | e dal canale: la sessione sessione-inesistente-xyz non e' nel
 canale (...): 5 ore NON MISURABILI da qui"}
```

Un numero con la fonte dichiarata nel caso positivo, NON MISURABILE dichiarato esplicitamente
nel negativo. FATTO.

## GRD-C3 — la soglia scatta sul picco, non solo sul contesto corrente

Transcript sintetici usa-e-getta, cartelle nuove con nome unico (timestamp), MAI un
transcript vero toccato:

- `C:\Users\enzospenuso\.claude\projects\GRDC-C3-PROVA-USA-E-GETTA-20260923-042814\` —
  compattazione simulata: picco 900.001/1.000.000 (90%), ultimo campione 100.000 (10%).
  Verdetto: `⛔ SOGLIA RAGGIUNTA — picco del contesto 90.0% >= 75% (adesso 10.0%: c'e' stata
  una compattazione, ma la capienza e' gia' stata consumata)`, **exit 3**.
- `C:\Users\enzospenuso\.claude\projects\GRDC-C3-PROVA-USA-E-GETTA-NEG-20260923-042821\` —
  nessuna compattazione: 200.000 -> 300.000 (30%, sempre crescente). Verdetto:
  `✓ si continua`, **exit 0**.

Caso positivo e negativo entrambi verificati sulla pipeline reale (non solo sui dict
sintetici del selftest). FATTO. Le due cartelle di prova restano sul disco (fuori dal repo,
in `~\.claude\projects\`, non tracciate da git): non cancellate per divieto esplicito del
mandato.

## GRD-C4 — la batteria, e il suo controllo

```
$ python docs/kb/tools/guardiano.py --selftest
...
61/61 verdi
SELFTEST VERDE
```

61 casi, di cui i tre gruppi C-1/C-2/C-3 sono ciascuno positivo+negativo (righe 957-1054 del
file). Gia' committata nel commit `0d92c1af` insieme al codice che verifica.

## GRD-C5 — le due copie, e il cancello

```
$ diff "C:\Users\enzospenuso\.claude\tools\guardiano.py" "D:\heuresys-advanced\docs\kb\tools\guardiano.py"
(vuoto — IDENTICI, 60.464 byte ciascuna)
$ git status --short -- docs/kb/tools/guardiano.py
(vuoto — nessuna modifica pendente, allineato a HEAD)
```

`python docs/kb/tools/verify_gate.py run`: lanciato una volta sola a fine ciclo, esito in
fondo a questo file.

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
tutti i consumatori puntano a `docs/kb/tools/guardiano.py`, nessun percorso divergente.
Nessuna modifica al file era necessaria: il censimento e' evidenza di supporto, non premessa
di un intervento che non c'e' stato.

## Vincoli osservati

- Nessuna cancellazione eseguita.
- Nessun `git pull --rebase`, nessun `rebase`/`amend`/`reset`/`cherry-pick`.
- Non toccati `scripts/align-claude-ecosystem.sh` e `scripts/align-codex-ecosystem.sh`.
- Non eseguito nessun passo del flusso di chiusura/propagazione/deploy
  (`close-propagate.sh`, `align-clones.sh`, `vm-deploy.sh`, `ci-gate.sh`, `clone-vm-db.sh`).
  **Nota**, come richiesto dal mandato: la chiusura canonica del progetto prevede la
  propagazione — non eseguita per mandato esplicito.

## Verdetto del cancello

```
$ python docs/kb/tools/verify_gate.py run
3 file modificati → suite: programmi, shell-tests
  riuso (verdi, contenuto invariato): shell-tests
  [L1] programmi            exit=0 (0.3s)

verdetto: GREEN → .zp\verify-verdict.json
[exited with code 0]
```

**GREEN.** Instradamento delta-aware: i 3 file dirty in questa sessione (`GRD-C.md` nuovo,
piu' i due file di Enzo non miei — vedi §Vincoli osservati) non toccano `db/**` ne'
`docs/kb/tools/guardiano.py` (che e' allineato a HEAD, nessuna modifica), quindi non ha
instradato la batteria pesante `migrate-idempotent` — corretto: quella prova e' dovuta solo
quando si tocca `db/**`, e qui non e' il caso. `shell-tests` riusato dalla corsa precedente
(verde, contenuto invariato).

## Chiusura GRD-C

**CICLO CHIUSO — 5/5 voci fatte, non resta niente.** GRD-C1, GRD-C2, GRD-C3, GRD-C4 erano
gia' state implementate e committate il 2026-09-19; GRD-C5 (copie identiche + cancello
verde) verificata in questa sessione. Nessun codice modificato. Il confine dichiarato dal
mandato si ferma qui: non apro altre voci, non eseguo chiusura/propagazione/deploy (di
competenza del governo).
