# STATE — vista rapida

*Ultimo aggiornamento: S1098 (2026-09-13, notte). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Enzo ha ripreso `#206` (Tenant Builder P4) dalla corsia HOLD: T1-T8 costruiti in un commit, dodici
test su un'azienda costruita da P3 e **prova live sul gemello 17/17** via rotte reali — le persone vere
entrano, il segnaposto cede, nessuna posizione `SUPERSEDED`. Sette correzioni alla consegna del lab,
misurate sul DB vivo. Poi il mandato «tutti da P1 a P3»: cinque voci su sei (`#149` F4, `#79` F3,
`#76` F2 con 59 verdetti riportati nel piano, `#214` F6 col quindicesimo perimetro e tre falsi neutri
esclusi, `#205` F2 con quattro corse e due difetti dello strumento corretti); `#159` F2 fermata dal
guardiano (`--budget 250000 → NON CI STA`). Registro in `.programmi/S1098-mandato-p1-p3.md`.

## Top priorities

1. **`#159` F2 — il componente del ponte in `ux-design-shared`** (~250k): da aprire a inizio
   sessione, con la capienza piena. Il repo è libero.
2. **`#198` — le due scoperte di S1098 prima di T9b**: il modello `REGIONAL_RETAIL_BANK_MEDIUM`
   non è costruibile (132 competenze senza categoria) e il motore costruisce unità che violano
   R6/R7 di `v_organization_unit_integrity`. Senza, nessuna azienda vera nasce — e `#206` T9 aspetta.
3. **`#205` F2 — la fonte di settore**: la catena della ricerca ora legge le mappe (3 mappe, 2.094
   indirizzi, 8 pagine scelte) ma `ilo.org` non descrive una società di consulenza. Serve
   `assoconsult.org` nel registro, e le fonti le approvi tu.

▸ Poi: `#214` F6 (18 neutri in coda) · `#76` F3 (ondate: le esegue il driver in sessioni dedicate) ·
`#149` F4 e `#79` F3 (continuativi, oggi verdi) · `#240` e `#250` aspettano un tuo sì.

## Open questions

- **`#205`**: vuoi che `assoconsult.org` (associazione di categoria della consulenza) entri nel
  registro delle fonti per `positions` e `organization_units`? Senza, la ricerca resta vuota.
- ⏳ **SOSPESA (Enzo)**: dove custodire la chiave del collaudo; rotazione di `MFA_ENCRYPTION_KEY`.
- **`#240`**: sì o no alla rimozione dei due worktree `gov/w1` `gov/w2` (contenuto superato da main).
- **Il `claude` del gemello e della VM** ha la sessione OAuth scaduta: la corsa di `#205` gira
  solo col modello su Windows. Vuoi ri-loggare le due macchine?
- **Igiene fuori repo**: `C:\Git\` porta ~30 log di sessioni CLI e
  `.handoff/session-journal.recovered.ndjson` del 6 settembre è già consolidato. Mai cancellati
  senza il tuo sì. Sul gemello restano 7 aziende `P4PROVA*` di prova: le toglie il rinfresco del clone.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/aggiorna_numeri_sot.py --check         # atteso: exit 0 (§0 allineata)
python docs/kb/tools/check_concetti_agente.py               # atteso: 15 aperti · 37 in coda (18 neutri)
python docs/kb/tools/check_verifica_consegne.py             # atteso: VERDE, P4 «PARZIALE · S1098»
python docs/kb/tools/zp_state.py piano                      # atteso: 262 · 105 chiusi · 157 aperti
cd apps/api && pnpm exec vitest run test/tenant-import-runs.integration.test.ts test/tenant-import-run-effect.integration.test.ts   # 8/8 + 4/4
bash scripts/verifica-deploy.sh                              # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
