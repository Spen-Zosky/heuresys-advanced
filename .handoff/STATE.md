# STATE — vista rapida

*Ultimo aggiornamento: S1110 (2026-09-26), mandato Cowork CHIUSURA-C3 — riparato il sorvegliante
del deploy e completato il rilascio che era rimasto bloccato da giorni. I numeri stanno in
`docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**CHIUSURA-C3: il deploy era bloccato da `ci-gate.sh` a corto di rate limit GitHub**, non dal
bundle in sé. Tre correzioni in strati (VM aveva `gh` moderno e bastava un token; linux-pc ha
`gh` 2.4.0 senza il sottocomando `auth token`, poi anche senza garanzia sull'exit code; alla fine
letto direttamente da `~/.config/gh/hosts.yml`). Rilascio completato: **`origin/prod` = `a8f60932`
su VM e linux-pc**, `verifica-deploy.sh` → DEPLOYATO. Prova live in produzione VERDE su D11
(dossier del DPO, importi mascherati) e sul registro `#30` (permessi effettivi PLATFORM_OPERATOR/
SALES). Verifica lunga sul linux-pc: tutta la suite passata, esito 0. `#28` e `#30` di `TRG.md`
marcate RISOLTE con l'evidenza di stanotte.

## Top priorities

1. **`#258` — la persona di collaudo di piattaforma** (~1 sessione, P1): invariata.
2. **`#251` → `#252`** (contatore persone distinte, poi il ponte sulle letture): invariate.
3. **`#260` — le due chiavi di collaudo sul linux-pc** (P2, pochi minuti sulla macchina): invariata.

▸ Poi: `#149` F4 · `#159` F3 · `#253` · `#257` · `#255` · `#205` F2 · `#256` · `#76` F3 · `#79` F3.

## Open questions

- **`verifica-deploy.sh` non distingue «il sorvegliante fallisce» da «non è ancora passato il
  timer»**: entrambi dicono IN-VOLO. Scoperto stanotte (armamento su `b07143c8` invalidato da
  commit successivi, il sorvegliante si fermava in silenzio e il verdetto non lo diceva). Voce
  nuova, non ancora in un registro strutturato.
- **`check_completezza_self` e `check_exposure`** segnalati `[!!]` dal cancello a tempo durante la
  propagazione di stanotte (letture, non azioni) — non indagati in questa sessione, restano da
  guardare.
- Le 18 voci APERTE residue di `TRG.md` (ora 16 con `#28`/`#30` chiuse): dettaglio in
  `.programmi/K-ruoli-direzione/esiti/TRG.md`.
- Due file non tracciati, lavoro in corso di Enzo, non toccarli: `scripts/align-claude-ecosystem.sh`
  (modificato) e `scripts/align-codex-ecosystem.sh` (nuovo).
- Il `claude` del gemello e della VM ha la sessione OAuth scaduta (invariato).

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/aggiorna_numeri_sot.py --check       # atteso: exit 0
bash scripts/verifica-deploy.sh                            # atteso: DEPLOYATO su a8f60932 (o piu' avanti)
git ls-remote origin refs/heads/prod refs/heads/main       # atteso: uguali
```
