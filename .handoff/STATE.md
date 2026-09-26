# STATE — vista rapida

*Ultimo aggiornamento: S1112 (2026-09-26), mandato Cowork ciclo 3 passaggio 2 — `#251` chiusa: il
contatore di persone distinte per conversazione dell'agente. I numeri stanno in
`docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**`#251` DONE** (ADR-0040 R2, primo dei tre passi che precedono `#254`). L'agente ora conta
**quante persone diverse** ha letto in una conversazione e lo scrive nel diario del gate
(`personeDistinte` + `livelloPersone`), piu' una voce di **chiusura** col totale — necessaria
perche' il gate audita PRIMA di eseguire. Le soglie **non sono numeri nel codice**: un generatore
misura il tenant piu' grande e il codice ri-deriva le due soglie dal criterio di ADR-0040 §3. Prova
LIVE con login reale e secondo fattore: una conversazione con quattro letture annidate stampa
1 · 7 · 38 · 160 nel diario, coi quattro livelli. Sabotaggio del codice di produzione visto
ROSSO (8 prove) e poi VERDE su tutta la batteria del gateway; anche la dimostrazione LIVE si e' vista rossa prima.

⭐ **Da leggere prima di pianificare `#252`**: sui soli sedici perimetri **gia' aperti** — quelli
scelti perche' parlano poco di persone — quattro letture toccano **55 persone distinte**, cioe'
**oltre la soglia alta OGGI**, senza `#254`. Il freno non dipende dall'apertura.

**Nessuna propagazione/deploy in questa sessione** — vietati dal mandato del ciclo (li esegue il
governo a fine ciclo).

## Top priorities

1. **`#252`** (il ponte di approvazione anche sulle letture): `#251` e' chiusa, quindi non e' piu' bloccata. Si aggancia a `GateOptions.persone` in `write-gate.ts`; `non-misurato` va trattato come «oltre la soglia».
2. **`#260` — le due chiavi di collaudo sul linux-pc** (P2, pochi minuti sulla macchina): invariata.
3. Poi: `#149` F4 · `#159` F3 · `#253` · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#79` F3.

## Open questions

- **Il cancello locale: un difetto trovato e corretto a chiusura, e una mia affermazione
  sbagliata da non ereditare.** Un `verify_gate.py run` **a vuoto** riscriveva
  `.zp/verify-verdict.json` con `results: []` (comportamento di S1054: mai un verde per assenza
  di misura) e così **azzerava il registro per-suite dei verdi**: `check` ricominciava a
  pretendere tutte le suite non perché qualcosa fosse cambiato, ma perché il libro contabile era
  stato cancellato da una corsa che non aveva fatto niente. Corretto: una corsa a vuoto ora
  lascia il verdetto **intatto** (portare avanti una voce non può fabbricare un verde — ogni voce
  porta l'impronta del contenuto su cui è stata misurata, e `check` la ri-confronta).
  ⚠ **Da correggere nella memoria di chi legge**: avevo scritto che `migrate-idempotent` applica
  le migrazioni alla produzione da Windows. **È falso dal 2026-08-27**: la suite esegue
  `db/scripts/prova-idempotenza.sh`, che lancia `ci-rehearsal.sh` **sul gemello, su una copia
  usa-e-getta**, in 12-26 secondi, ed esce **rosso** se il gemello non risponde invece di
  ripiegare in locale. Il cancello si esegue senza toccare la produzione.

- **Il baseline è misurato per intero, non per campione**: a chiusura di S1112 il cancello locale
  ha eseguito **tutte** le suite instradabili su `17fa1899`, nessuna esclusa e nessuna riusata dal
  ricordo — verdetto GREEN, `test-api` compresa (sul gemello). I numeri stanno nell'esito della
  voce e in `.zp/msg_commit/251/cancello-integrale.txt`. Chi apre la prossima sessione parte da qui.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check       # atteso: exit 0
grep -rn "enzo.spenuso@heuresys.com" apps/api/test apps/web/tests  # atteso: 0 righe
python docs/kb/tools/verify_gate.py run                    # atteso: GREEN
```
