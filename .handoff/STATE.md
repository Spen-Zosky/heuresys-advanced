# STATE — vista rapida

*Ultimo aggiornamento: S1100 (2026-09-14). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Sessione corta su mandato di Cowork (`.programmi/S1100-mandato-cowork-250-240.md`, CHIUSO): le due voci
che aspettavano un sì di Enzo sono chiuse — `#250` (Enzo è entrato in produzione e il secondo fattore è suo)
e `#240` (i worktree `gov/*` non ci sono più). La migrazione `000414` scritta da Cowork ha attraversato la
prova generale ed è in produzione: `BRANCH_MANAGER` ha una famiglia e l'isolamento del whistleblowing è una
sentinella bloccante (cinquanta a zero). Il giornale MFA di Enzo è stato ritirato, il documento in italiano
semplice sul controllo degli accessi è nel repo (`docs/kb/xtras/RBAC_COME_FUNZIONA_DAVVERO.md`). Il
register non ha più voci `WAIT-INPUT`.

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
`#76` F3 (ondate: il driver, in sessioni dedicate) · `#149` F4 e `#79` F3 (continuativi, verdi al 2026-09-13).

## Open questions

- ⏳ **SOSPESA (Enzo)**: dove custodire la chiave del collaudo; rotazione di `MFA_ENCRYPTION_KEY`.
- **La password di `enzo.spenuso@heuresys.com` resta derivata dalla chiave madre** (Z-262 / `#139`): il
  secondo fattore è ora l'unica separazione. Entrare in `REAL_PERSON_EMAILS` e scegliersi una password è
  un'opzione nominata, non una pendenza.
- **Il `claude` del gemello e della VM** ha la sessione OAuth scaduta: le corse di `#205` girano solo
  col modello su Windows (`ssh -R 8790`). Vuoi ri-loggare le due macchine?
- **Igiene fuori repo — causa confermata anche in S1100**: nella Bash della CLI `$TMPDIR` e
  `$CLAUDE_SCRATCH` sono vuoti, quindi `"$VAR/x"` finisce in `C:\Git\x` (36 log lì oggi). Mai cancellati
  senza il tuo sì; il percorso dello scratchpad va scritto per esteso. Sul gemello resta il fascicolo di
  prova `PROVA-F7-ALFA`: lo toglie il rinfresco del clone. Copie scp della 000414 messe da parte in
  `~/scp-aside-<ts>` su gemello e VM (identiche alla versione tracciata).
- **I file `webapps-*.md` in `~/.claude/sessioni/attive/`** sono sessioni SDK del gateway registrate
  per errore dagli hook (corretto in S1099): da ripulire col tuo sì.
- **Cowork non raggiunge più Linux via SSH** dal 2026-09-08 (`device_bash` → `Workspace unavailable`):
  la prova generale delle migrazioni scritte da Cowork la fa sempre la CLI, prima di applicarle.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/aggiorna_numeri_sot.py --check         # atteso: exit 0 (§0 allineata)
python docs/kb/tools/db_health.py                            # atteso: tutto nei limiti, 50 sentinelle a zero
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -At -c "select auth_role_category from sys.sys_auth_roles where auth_role_code='BRANCH_MANAGER'"   # atteso: hierarchical_operational
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -At -c "select count(*) from sys.v_whistleblowing_fuori_dal_custode"   # atteso: 0
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f docs/kb/xtras/misura-rbac.sql   # i numeri del documento RBAC, rigenerati
bash scripts/verifica-deploy.sh                              # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
