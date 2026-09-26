# STATE — vista rapida

*Ultimo aggiornamento: S1114 (2026-09-26), mandato Cowork `REGOLE` — regole snellite per Claude 5 e
due controlli che non girano più a vuoto. I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**Tre lavori del mandato `REGOLE`, tutti chiusi** (dettaglio in `.programmi/esiti-regole/REGOLE.md`):

1. `CLAUDE.md` sostituito con la bozza approvata da Enzo (52 KB → 13 KB, meno istruzioni di verifica,
   niente enfasi ripetuta). Storico integrale in `docs/kb/xtras/PERCHE_LE_REGOLE.md`. Un riferimento
   sbagliato nella bozza (`db/scripts/clone-vm-db.sh`) corretto in `scripts/clone-vm-db.sh`.
2. Il cancello di fine turno (`cmd_stop_gate`) respinge il turno solo quando l'ultimo messaggio
   dell'assistente **dichiara** la fine (riga che comincia con `@COWORK FATTO`), non a ogni turno
   intermedio. Due correzioni in sequenza, trovate dal vivo usando il cancello appena costruito:
   prima solo la dichiarazione contava (non ogni verdetto rosso), poi una semplice CITAZIONE del
   marcatore dentro una frase non conta più come dichiarazione. Batteria completa verde.
3. `test-api`/`migrate-idempotent` erano **già** instradate sul gemello (dal 2026-09-09 e
   2026-08-27): la premessa del mandato era una citazione invecchiata di un difetto già risolto.
   Nessun codice da correggere.

**Gemello (`linux-pc`) irraggiungibile per tutta la sessione** (misurato 4 volte, sempre *timeout*,
mai *refused*) — `test-api`/`migrate-idempotent` non riverificabili da qui. **Enzo ha deciso di
rinviare**, non aspettare: fase rinviata, da riprendere quando il gemello torna raggiungibile. Per
chiudere il turno ho impegnato il freno locale `.zp/verify-off` (gitignored, solo questa macchina,
non su CI né sui cloni) — **va tolto** appena si rilancia `verify_gate.py run` col gemello su.

CI verde su tutti i job dell'ultimo commit di codice (`7150f491`). Nessuna propagazione/armamento in
questa sessione: la propagazione è passo separato, di Enzo.

## Top priorities

1. **`#253`** (il diario del gate diventa interrogabile) — P2, ~1 sessione, invariata da S1113.
2. **`#254`** (apertura di tutti i perimetri) — resta GATED sul solo `#253`.
3. **`#260`** — le due chiavi di collaudo sul linux-pc — invariata.

Poi, invariata da S1113: `#149` F4 · `#159` F3 · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#79` F3.

## Open questions

- Quando il linux-pc torna raggiungibile: `rm .zp/verify-off` su questo Windows e
  `python docs/kb/tools/verify_gate.py run`, per rimettere verdi `test-api`/`migrate-idempotent`
  (rinviate per decisione di Enzo, S1114 — dettaglio in `.programmi/esiti-regole/REGOLE.md`).
- Il linux-pc è spento o isolato dalla rete di casa? Solo Enzo può controllarlo fisicamente.
- Il `[ERR] R24 GUARD-RAIL ASSENTE` sul CLAUDE.md **globale** (`~/.claude/CLAUDE.md`) segnalato al
  boot di questa sessione — coerente con una riscrittura fatta lo stesso giorno (SoT-versione
  2026-09-26), non verificato oltre l'osservazione. Da controllare da chi ha accesso a `~/.claude`.
- (riportate da S1113, invariate) soglia-lettura solo conservativa su metadati; `#251`/`#252` non
  seguono ancora un `resume` di conversazione; comportamento del freno non misurato senza
  `AGENT_GATEWAY_SUBSCRIPTION_AUTH` o su tenant diverso da RTL Bank.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check       # atteso: exit 0
python docs/kb/tools/verify_gate.py check                 # atteso: rosso solo test-api/migrate-idempotent finché il gemello è giù
ssh -o ConnectTimeout=8 linux-pc true                     # quando risponde: rm .zp/verify-off && verify_gate.py run
```
