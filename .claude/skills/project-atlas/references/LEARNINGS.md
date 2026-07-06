# LEARNINGS.md — auto-aggiornato dalla skill (lezioni + metriche adattive)

> Protocollo: a fine di ogni invocazione refresh/dossier la skill APPENDE un run-record e,
> se emerge una lezione generalizzabile, la aggiunge in prosa qui sopra. Gli adattamenti di
> parametri vanno in `atlas.config.yaml → adaptive` (reversibili), MAI nei template.

## Lezioni (seed S1016)

- Full-sweep 19 agenti ≈ 2,5M token: SEMPRE dietro conferma R20; lo spend-limit può interrompere
  a metà → salvare i frammenti completati + pending-file + item GATED nel register.
- `ls` non mostra i dotfile: usare `ls -a` quando si contano artefatti `.something`.
- psql sul tunnel :5433 può droppare sotto carico (SSL SYSCALL EOF): batch UNION ALL + 1 retry.
- SSH da Git Bash: SEMPRE `MSYS_NO_PATHCONV=1`; sul legacy le pg_stat sono azzerate (usare reltuples).
- Console Windows cp1252: i tool python del repo richiedono `sys.stdout.reconfigure(encoding="utf-8")`;
  per one-liner usare `PYTHONIOENCODING=utf-8`.
- Rate-limit login API 10/5min: i run E2E ripetuti lo esauriscono — attendere la finestra, non ritentare.
- Workflow args possono arrivare come stringa: fare sempre `typeof args === 'string' ? JSON.parse(args) : args`.

## Run-records (append-only)

Schema di ogni record:

```yaml
- date: YYYY-MM-DD
  mode: refresh-delta | refresh-full | dossier
  layers: [api, web]            # o famiglie
  agents: 0                     # lanciati
  est_tokens: 0                 # stima
  coverage: ok | retried:<n> | holes:<lista>
  duration_min: 0
  errors: []                    # gotcha incontrati
  adaptations: []               # override scritti in adaptive: (con perche')
```

<!-- I record vengono appesi sotto questa riga -->
