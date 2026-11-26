# Fuori ciclo: repo e backup sulla VM (26/11/2026)

Mandato di Enzo («esegui tutti i fuori ciclo»). Rapporto di partenza: https://claude.ai/artifact/JvqAoTpr11jt3Db5n8p3q4 (punti 4-12).

Trovato il 26/11: `~/backup-hr/bin`, `log` e `locks` non esistevano più (cartella modificata l'11/11 00:24 UTC; causa non trovata). Ultima copia restic e ultimi pacchetti Git del 10/11; cron falliva in silenzio perché la cartella dei registri mancava.

| id | cosa | fatta quando |
|---|---|---|
| B1 | Ricostruire e versionare `scripts/backup-restic-hr.sh` (copia del 29/10 più le modifiche del 30/10 e 4/11), reinstallare i due script | corsa in ambiente come cron: `ultimo_esito.txt` e `pacchetti_git_esito.txt` OK |
| B2 | Lettore di `ALLARME.txt`: sezione in `docs/kb/tools/status_dashboard.py` (strumento che già legge il registro dei guasti) | rossa su un guasto simulato, verde sui file veri |
| P4/P6 | Cartelle fuori da Git nella copia cifrata | presenti nell'istantanea su VM e Drive |
| P10 | `verifica-cloni.sh` legge in locale la VM | verdetto clone misurato dalla VM |

Limite noto di B2: il cruscotto si legge all'apertura di una sessione; non avvisa da solo.
