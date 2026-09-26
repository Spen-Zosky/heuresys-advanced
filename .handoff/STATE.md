# STATE — vista rapida

*Ultimo aggiornamento: S1111 (2026-09-26), mandato Cowork ciclo 3 passaggio 1 — `#258` chiusa: i
test API smettono di impersonare Enzo. I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**`#258` DONE**: molti file di `apps/api/test`+`apps/web/tests` impersonavano `enzo.spenuso@heuresys.com`
per la sfida MFA come PLATFORM_ADMIN; `#250` gli aveva dato il suo secondo fattore VERO. Nuova
persona `platform-test-admin@collaudo.invalid` (SERVICE, PLATFORM_ADMIN con vero grant di
piattaforma, fattore `derived-access` reale) creata in produzione e verificata dal vivo; email
sostituita ovunque; `enzo.spenuso@heuresys.com` torna protetta in `REAL_PERSON_EMAILS`. Scoperto e
corretto un secondo difetto: la soglia di catena sui vertici (ADR-0036 §5) si applica alla nuova
persona (senza posizione) diversamente che a Enzo (che era al vertice reale) — un test derivava
l'atteso presupponendo l'uguaglianza. Prova di chiusura: clone del gemello rinfrescato DOPO il
provisioning, `verify_gate.py run` GREEN su HEAD `82dfb4be`. **Nessuna propagazione/deploy in
questa sessione** — vietati dal mandato del ciclo (li esegue il governo a fine ciclo).

## Top priorities

1. **`#251` → `#252`** (contatore persone distinte, poi il ponte sulle letture): invariate.
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
