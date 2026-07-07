# Autonomia operativa cross-tool (R23 globale — project enforcement)

> Extracted from `CLAUDE.md` at the 2026-07-07 session-start forensics to keep the always-loaded
> project instructions lean. `CLAUDE.md` keeps a terse pointer + the two most-operative rules
> (push session-scoping · red-CI-must-fix); this file holds the full project-level detail.

Vale la regola **R23** della SoT cross-tool (`C:\Users\enzospenuso\.claude\CLAUDE.md`): zero delega evitabile + proactive tool loading + self-diagnose fallback + no user-executable instructions when autonomously executable + evidence non suggerimento. Specifiche project-level che si applicano sopra R23 in heuresys-advanced:

- **Tool primari per task tipici di questo repo**: edits codice/test/migration → preferire Filesystem MCP o Desktop Commander `edit_block` (real disk) per file >900B, con Windows-MCP PowerShell come fallback. Bash sandbox solo per logica/calcolo non-stateful (parsing, format, regex). Git operations → sempre via Windows-MCP PowerShell (`.git/index.lock` può non rimuoversi dal sandbox mount).
- **Push autorizzazione**: la regola storica "never `git push` without explicit ask" resta valida come default ma **una volta che l'utente ha autorizzato push autonomi in una sessione (esplicitamente, es. via /authorize o approvazione esplicita), l'autorizzazione vale per quella sessione fino a sua revoca**. La nuova sessione riparte da default "ask". Esempio: S933 ha autorizzato push autonomi → S934 + S935 + S936 hanno ereditato → la prossima nuova sessione richiederà nuova autorizzazione.
- **CI workflow + self-hosted runner**: post-S935 F, i 6 workflow GitHub Actions girano su OCI VM runner. Il commit autonomo include automatica esecuzione CI se il path tocca file rilevanti (vedi `.github/workflows/*.yml` paths-ignore). Claude può consultare lo stato CI via `gh run list` + `gh run watch` come parte di evidenza (R23/e). Una CI rossa è un errore Claude DEVE correggere (R3 cross-project), non scaricare all'utente.
- **Live re-run + DB queries**: per task che richiedono SSH tunnel 5433 attivo, Claude prima verifica `Test-NetConnection localhost -Port 5433`; se down, tenta start tunnel via SSH agent loaded; se passphrase prompt → fallback documentato (vedi `qa_artifacts/s936_outcome_summary.md` §5 workaround SSH automation). Non chiedere all'utente di "aprire un terminale per il tunnel" se ssh-agent persistent setup è già documentato come task open.
- **Test verification level**: vitest test files con mocked pool (es. `upsert-sql-cw-b60-a-silent-skip.test.ts`) sono sufficienti come unit verification per R3 closure di un fix observability. Live DB validation è "belt-and-suspenders" non-blocking quando il fix è già unit-tested verde.

Cross-reference: R6 (global no-delega base), R22 (CLASSE A/B decision), R23 (autonomy comprehensive), R3 (correggere ogni errore), R12 (git safety cross-project).
