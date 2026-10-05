# STATE — vista rapida

*Ultimo aggiornamento: S1117 (2026-10-05). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

**Mandati di Cowork letti ed eseguiti dove erano già decisi.** Sette voci in `COWORK_INBOX.md`: quattro riconciliate, tre aperte (#263, #264, #265, vedi backlog). Misura sola lettura su RTL_BANK: **0 inversioni** del principio gerarchia-livelli su 42 unità; 19 unità su 42 senza `org_level`.

**Due migrazioni scritte, provate sul gemello, pushate, NON in produzione**: `000454` (pacchetto del datastore, 29 tabelle + 27 colonne; ha richiesto di emendare `000429` a 282 tabelle e di registrare le tabelle nel registro di riconciliazione) e `000455` (riallinea `org_level` di 21 unità di RTL Bank, con giornale undo; prima/dopo/rollback con impronta identica). **Il deploy che le porta in produzione non è armato**: lo arma Enzo.

**Tunnel `:5433` ricreato** con keepalive. Il blocco di `psql` non era il tunnel ma `-h 127.0.0.1`: `~/.pgpass` ha solo `localhost`, e `psql` aspetta la password su stdin. Usare `-h localhost` o `-w`.

## Top priorities

1. **Armare il deploy** di `000454`/`000455` (decisione di Enzo, `scripts/close-propagate.sh`).
2. **#266** struttura albero RTL (Direzioni di controllo, Divisione Risk & Compliance duplicata) · **#263/#264/#265** decisioni di prodotto sul datastore e sulla gerarchia dei livelli, tutte WAIT-INPUT.
3. **#254** apertura dei perimetri in una mossa (P1, non avviata) · **#159** F3.

## Open questions

- Ordine dei livelli QD assunto crescente (QD4 più alto) e posto di «Quadro» generico: da confermare.
- `github.com` non risolveva a metà sessione (singhiozzo di rete): un `git fetch` fallito non prova che `origin/main` sia fermo.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/handoff_lint.py                      # atteso: 0 FAIL
python docs/kb/tools/check_canale_cowork.py               # atteso: 3 voci aperte (#263 #264 #265)
python docs/kb/tools/aggiorna_numeri_sot.py --check       # atteso: exit 0
bash scripts/verifica-deploy.sh                            # esito dell'armamento (se armato)
```
