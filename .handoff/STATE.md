# STATE — vista rapida

*Ultimo aggiornamento: S1099 (2026-09-13, sera). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Mandato «tutti da P1 a P3 in autonomia»: **sei voci su sei** (`.programmi/S1099-mandato-p1-p3.md`, CHIUSO).
`#159` F2 è chiusa — `AgentPanel` vive in `ux-design-shared` ed è pubblicato come `@heuresys/ui@1.2.0`,
la console `dev/agent` lo consuma, e la prima E2E della pagina ha trovato che dal browser il ponte non era
mai stato intero (gateway senza CORS: corretto, E2E live verde). Sedicesimo perimetro dell'agente
(`blueprint-processes`) con la prova live delle tre domande di nuovo verde dopo due rimedi al gateway
(`tools/list` rotto dal bump SDK di inizio settembre, hook di sessione dentro l'agente). Per `#205` la fonte di
settore è nel registro per delega (`000413`), la corsa la legge, e il limite si è spostato sul tipo di
contenuto (PDF). Il cancello ha trovato e fatto correggere un 500 sulla LIST delle corse senza tenant.

## Top priorities

1. **`#159` F3 — la prima pagina idonea monta `AgentPanel`** (~150k): una parametrica fra le 83 di
   `check_idoneita_agente.py`, col proprio namespace e un `context` vero; riuscita = non tocca né
   `use-agent-stream` né il componente. Gateway acceso con `AGENT_GATEWAY_WEB_ORIGIN`.
2. **`#198` — le due scoperte di S1098 prima di T9b**: `REGIONAL_RETAIL_BANK_MEDIUM` non costruibile
   (132 competenze senza categoria) e il motore viola R6/R7 di `v_organization_unit_integrity`.
   Senza, nessuna azienda vera nasce — `#206` T9 aspetta.
3. **`#205` F2 — il lettore delle fonti apre solo HTML**: i rapporti di settore (Osservatorio
   Assoconsult) sono PDF. Finché non li apre, la ricerca sulla consulenza risponde vuoto con la fonte
   giusta. È una capacità nuova del lettore, da decidere se aprirla (scoperta fuori ciclo S1099).

▸ Poi: `#214` F6 (17 neutri in coda; prossimi `organization-unit-processes`, `blueprint-activations`) ·
`#76` F3 (ondate: il driver, in sessioni dedicate) · `#149` F4 e `#79` F3 (continuativi, oggi verdi) ·
`#240` e `#250` aspettano un tuo sì.

## Open questions

- ⏳ **SOSPESA (Enzo)**: dove custodire la chiave del collaudo; rotazione di `MFA_ENCRYPTION_KEY`.
- **`#240`**: sì o no alla rimozione dei due worktree `gov/w1` `gov/w2` (contenuto superato da main).
- **Il `claude` del gemello e della VM** ha la sessione OAuth scaduta: le corse di `#205` girano solo
  col modello su Windows (`ssh -R 8790`). Vuoi ri-loggare le due macchine?
- **Igiene fuori repo — causa trovata**: in Git Bash `$TMPDIR` è vuoto, quindi `"$TMPDIR/x"` finisce in
  `C:\Git\x`: i file lì sono log e messaggi di commit delle sessioni CLI (anche di questa). Mai
  cancellati senza il tuo sì; d'ora in poi il percorso dello scratchpad va scritto per esteso.
  `.handoff/session-journal.recovered.ndjson` (del 6 settembre) è già consolidato. Sul gemello resta il fascicolo
  di prova `PROVA-F7-ALFA` con una corsa di ricerca: lo toglie il rinfresco del clone.
- **I file `webapps-*.md` in `~/.claude/sessioni/attive/`** sono sessioni SDK del gateway registrate
  per errore dagli hook (corretto in S1099 con `settingSources: []`): da ripulire col tuo sì.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/aggiorna_numeri_sot.py --check         # atteso: exit 0 (§0 allineata)
python docs/kb/tools/check_concetti_agente.py               # atteso: 16 aperti · 36 in coda (17 neutri)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -At -c "select count(*) from sys.v_processo_di_modello_con_dato_di_persona"   # atteso: 0
cd apps/agent-gateway && pnpm exec vitest run               # atteso: 99/99 (tools/list sul server vero)
cd apps/web && node scripts/e2e-node22.mjs test tests/e2e/agent-dev-console.spec.ts --project=chromium   # gateway :8790 + NEXT_PUBLIC_ENABLE_AGENT_DEV=1
bash scripts/verifica-deploy.sh                              # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
