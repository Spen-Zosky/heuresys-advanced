# STATE — vista rapida

**Updated**: 2026-11-26 (riallineamento degli stati; `refs/heads/prod` = `faed9ae4` armato il 26/11, misurato con `git ls-remote origin refs/heads/prod`; l'esito del deploy si legge con `bash scripts/verifica-deploy.sh`; l'ultimo verificato DEPLOYATO era `dd750e70`, PR #516)

*I numeri stanno in `docs/kb/SOT_STATE.md`, non qui. La mappa per argomento è il wiki: `docs/wiki/index.md`.*

## Last session brief

**Riordino della documentazione (25 novembre, thread di progetto)**: piano `docs/piani/PIANO_riordino-documentazione_20261125.md`, approvato da Enzo. I documenti superati escono dal repo con `docs/kb/tools/ritira_documenti.py` (copia con impronta nel cestino della cartella del progetto, recupero dal commit di main scritto nel registro dei ritiri). Nasce il wiki `docs/wiki/` (quindici pagine di dominio, indice, indice analitico, schema in `docs/wiki/LEGGIMI.md`); `check_documenti.py`, `build_adr_index.py --check` e `build_wiki.py --check` girano nel workflow `state-lint.yml`.

**Giro di verifica delle pagine (24-25 novembre)**: chiuso con il rapporto di PR #481 e le correzioni di PR #482, poi in produzione con il rilascio `87d7ce9d`; il giro è stato riaperto il 25 novembre nello stesso mandato, nel suo thread (`docs/piani/forense-frontend_20261123/`).

**Fra il 30 ottobre e il 24 novembre** il lavoro è nei piani di `docs/piani/` e nelle PR unite su `main` (`git log --oneline origin/main`); i registri `SOT_STATE.md`, `SOT_BACKLOG.md` e `DEBT_REGISTER.md` vanno riallineati a quel lavoro (voce R8 del piano di riordino).

**Dal 25 al 26 novembre** (fonte: `git log origin/main` e `bilancio/BILANCIO_fatto-e-da-fare_20261126.md`): ADR-0063 accettato da Enzo il 26/11 alle 03:47 e piano AI-driven in attuazione a onde (`docs/piani/PIANO_heuresys-ai-driven_20261126.md`, la sua tabella è la fonte dello stato di ogni voce); in produzione il gateway degli agenti (#496), il secondo fattore con i codici di recupero (#497), la classe d'azione delle scritture (#504), F0b e F0c (#505), il motore degli scenari F3a (#506), le sentinelle del database (#515, migrazione 000519); ADR-0062 (traduzione del dato nell'API) è PROPOSTO ma già in codice con le PR #498 e #513, e aspetta la decisione di Enzo sul suo stato.

## Top priorities

1. **Giro di verifica e correzione di tutte le pagine**, con rilascio e prova dal vivo delle correzioni: è la priorità indicata da Enzo il 24 novembre.
2. **Riordino della documentazione**: chiudere le voci aperte del piano del 25 novembre (sezione 6).

## Open questions

- Vulnerabilità Dependabot sul ramo principale: da riesaminare (`gh api repos/Spen-Zosky/heuresys-advanced/dependabot/alerts`).
- I programmi multi-sessione aperti si leggono con `python3 docs/kb/tools/programmi.py`; diversi sono fermi da ottobre, e #214 (adozione dell'agente in coda per rischio crescente) è contraddetto da ADR-0040, che supera quella coda: vanno rivisti dalla loro sessione dedicata.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/check_canale_cowork.py               # atteso: 0 voci aperte
python docs/kb/tools/verify_gate.py check
bash scripts/verifica-deploy.sh                            # esito dell'armamento (se armato)
```
