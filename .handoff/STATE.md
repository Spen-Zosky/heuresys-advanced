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

- **`verifica-deploy.sh` non distingue «il sorvegliante fallisce» da «non è ancora passato il
  timer»** (da S1110, invariata): entrambi dicono IN-VOLO. Voce nuova, non ancora in un registro
  strutturato.
- **`check_completezza_self` e `check_exposure`** segnalati `[!!]` durante la propagazione di
  S1110 (letture, non azioni) — non indagati, restano da guardare.
- Uno `git stash` ("CRLF residue pre-258") è rimasto sul working tree del clone del linux-pc: lo
  ha creato la CLI per sbloccare un `git pull` bloccato da differenze CRLF/LF preesistenti (non
  legate a `#258`). Si vede con `git stash list` sul gemello; sparisce da sé al prossimo
  `align-clones.sh linuxpc` (`reset --hard`).
- Due file non tracciati, lavoro in corso di Enzo, non toccarli: `scripts/align-claude-ecosystem.sh`
  (modificato) e `scripts/align-codex-ecosystem.sh` (nuovo).
- Il `claude` del gemello e della VM ha la sessione OAuth scaduta (invariato).

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check       # atteso: exit 0
grep -rn "enzo.spenuso@heuresys.com" apps/api/test apps/web/tests  # atteso: 0 righe
python docs/kb/tools/verify_gate.py run                    # atteso: GREEN
```
