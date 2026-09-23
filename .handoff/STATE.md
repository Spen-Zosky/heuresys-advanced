# STATE — vista rapida

*Ultimo aggiornamento: S1107 (2026-09-23), mandato Cowork GRD-C (passaggio 4 del piano
`PIANO_collaudo-e-correzioni-governo_2026-09-19`). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**GRD-C — nessun codice toccato: il lavoro richiesto era già stato fatto il 2026-09-19.** Il
mandato chiedeva tre correzioni al guardiano (`docs/kb/tools/guardiano.py`): trovare il
transcript da qualunque cartella, leggere le 5 ore dal canale quando la riga di stato non
gira, far scattare la soglia anche sul picco dopo una compattazione. Misurato sul vivo: tutte
e tre già implementate e committate (`0d92c1af`, 2026-09-19 19:08:48), 4 giorni prima che il
mandato arrivasse. Riverificate senza ricostruire: stesso session-id da tre cartelle diverse
(133.431 token identici, inclusa `C:\`, dove il difetto originale si manifestava), `--canale`
positivo/negativo, transcript compattato sintetico positivo/negativo, selftest tutto verde. Le
due copie (utente + repo) identiche, `verify_gate.py run` GREEN. Esito completo con comandi e
output in `.programmi/K-ruoli-direzione/esiti/GRD-C.md`, committato (`9ee6676d`).
**Non eseguita nessuna propagazione/deploy**: vietato esplicitamente dal mandato ("la chiusura,
la propagazione ai cloni e il rilascio li conduce il governo"). Questa chiusura è dichiarata
"passo 1 di 2" da Cowork — il passo 2 (propagazione) è demandato a chi governa.

## Top priorities

1. **`#258` — la persona di collaudo di piattaforma** (~1 sessione, P1): invariata da S1106.
2. **`#251` → `#252`** (contatore persone distinte, poi il ponte sulle letture): invariate.
3. **`#149` F4** e **`#159` F3**: invariate.

▸ Poi: `#253` · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#79` F3 (continuativi).

## Open questions

- **`#259` mandato K — tre decisioni di Enzo, nessun lavoro CLI residuo**: invariata da S1106
  (D11, `sys_attendance`, D12 — risposte in `esiti/RISPOSTE_ENZO.md`).
- **Propagazione ai cloni NON eseguita in questa chiusura** — per mandato esplicito di Cowork
  (GRD-C). `origin/main` è avanti di 115 commit su `origin/prod` (`refs/heads/prod` ancora a
  `78b40e72`): il "passo 2" annunciato da Cowork è presumibilmente questo.
- **Due file non tracciati, lavoro in corso di Enzo, non toccarli**: `scripts/align-claude-ecosystem.sh`
  (modificato) e `scripts/align-codex-ecosystem.sh` (nuovo) — ancora intoccati.
- Le due file scritti da agenti fuori cartella e le sette bozze `esiti/_bozza_*.md`: si
  cancellano solo con il tuo sì (invariato).
- Tuple morte, tabella variabile — manutenzione ordinaria, non urgente (invariato).
- Il `claude` del gemello e della VM ha la sessione OAuth scaduta (invariato).

## Verification

```bash
python docs/kb/tools/session_start.py                        # atteso: #259 in WAIT-INPUT, nessun P1 nuovo
python docs/kb/tools/handoff_lint.py                         # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check          # atteso: exit 0
python docs/kb/tools/guardiano.py --selftest                 # atteso: 61/61 verdi (GRD-C)
git ls-remote origin refs/heads/prod refs/heads/main          # prod ancora indietro di 115 commit
```
