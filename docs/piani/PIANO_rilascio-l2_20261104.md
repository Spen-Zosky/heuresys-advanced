# Piano del rilascio del lotto L2 (2026-11-04)

Mandato di Enzo: «arma il rilascio di main 7d04cc06». Non si chiude in questa sessione: l'eliminazione dei quattro database heuresys_prova_*_da_eliminare_20261103, bloccata dal controllo dei permessi e in attesa di Enzo.

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| R1 | Atlante rigenerato con `scripts/atlante-automatico.sh` (PR #161) | Claude | `atlante_fresco.py` dice fresco sul commit da armare | in corso |
| R2 | CI di 7d04cc06 e del commit dell'atlante (`gh run list`; Atlas con `gh workflow run atlas-freshness.yml`) | Claude | nessun esito rosso o in corso sul commit da armare | da fare |
| R3 | Copia di fase: `bash scripts/copia-fase.sh copia rilascio-20261104-l2`, poi `prova` e `drive` | Claude | conteggi uguali, impronte verificate | da fare |
| R4 | Armare con `scripts/close-propagate.sh` | Claude | `refs/heads/prod` sul commit da armare | da fare |
| R5 | Esito con `scripts/verifica-deploy.sh`, poi readyz, login e ultima migrazione | Claude | verdetto DEPLOYATO | da fare |

## Simulazione

Precondizione: fra 7d04cc06 e il commit da armare cambiano solo `docs/`; il comando che lo misura è `git diff --name-only 7d04cc06 <commit>`. Se compare altro, ci si ferma e si chiede a Enzo.

Perché non si arma 7d04cc06 in sé: `deploy-watch.sh` deploya solo se `origin/prod` coincide con `origin/main` e blocca sull'ultimo esito rosso di ogni workflow. Atlas è rosso su 7d04cc06 e si corregge solo con un commit nuovo; quel commit non tocca il codice del prodotto.

Nessuna migrazione nella finestra: `git diff --name-status 6028ead3 7d04cc06 -- db/` è vuoto.

Guardia: nessun altro push su main dopo l'armamento finché il verdetto non è DEPLOYATO, altrimenti il deploy armato non parte. Niente `--force`, niente `DEPLOY_REQUIRE_CI=0`.

Ritorno: la copia di fase di R3 (`bash scripts/copia-fase.sh ritorna <cartella>`), solo con il sì di Enzo.
