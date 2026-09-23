# STATE — vista rapida

*Ultimo aggiornamento: S1107 (2026-09-23), mandato Cowork GRD-C, secondo giro di governo. I
numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**GRD-C — un difetto reale trovato dal governo e corretto.** Primo giro: verificato che C-2
(5 ore dal canale) e C-3 (soglia sul picco) erano già fatte il 2026-09-19 (`0d92c1af`); avevo
dichiarato anche C-1 (transcript da qualunque cartella) già fatta, ma il governo ha misurato
che era vero **solo con l'UUID completo** — con un id **abbreviato** (`--session 536d656f`)
il guardiano tornava "GUARDIANO CIECO" pur avendo il file sul disco. Corretto in
`docs/kb/tools/guardiano.py` (`trova_transcript`): match per prefisso quando l'esatto fallisce,
il più recente in caso di ambiguità, sempre **dichiarato** (`id_abbreviato` nel risultato).
Verificato con lo stesso id abbreviato da tre cartelle diverse (stesso numero di contesto in
tutte e tre) e col negativo (id inesistente resta non misurabile). Selftest 61→65 casi verdi.
Le due copie (utente + repo) riallineate e identiche; la terza copia (altro progetto) non
toccata. `verify_gate.py run` GREEN tre volte (dopo ciascun commit). Esito completo in
`.programmi/K-ruoli-direzione/esiti/GRD-C.md` (`399f04d5`, `ddff1607`).
**Nessuna propagazione/deploy eseguita**: vietato esplicitamente dal mandato, anche quando il
profilo di chiusura del progetto lo prescriverebbe (`origin/main` è avanti di 118 commit su
`origin/prod`, invariato a `78b40e72`).

## Top priorities

1. **`#258` — la persona di collaudo di piattaforma** (~1 sessione, P1): invariata.
2. **`#251` → `#252`** (contatore persone distinte, poi il ponte sulle letture): invariate.
3. **`#149` F4** e **`#159` F3**: invariate.

▸ Poi: `#253` · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#79` F3 (continuativi).

## Open questions

- **`#259` mandato K — tre decisioni di Enzo, nessun lavoro CLI residuo**: invariata (D11,
  `sys_attendance`, D12 — risposte in `esiti/RISPOSTE_ENZO.md`).
- **Propagazione ai cloni ancora NON eseguita** — per mandato esplicito di Cowork (GRD-C, due
  giri). `refs/heads/prod` resta a `78b40e72`, `main` a `ddff1607`: 118 commit di scarto.
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
python docs/kb/tools/guardiano.py --selftest                 # atteso: 65/65 verdi (GRD-C1 incluso)
python docs/kb/tools/guardiano.py --session <id-abbreviato>  # atteso: trovato da qualunque cartella
git ls-remote origin refs/heads/prod refs/heads/main          # prod ancora indietro di 118 commit
```
