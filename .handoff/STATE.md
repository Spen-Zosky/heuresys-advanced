# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-27 (S1033 — la CI torna verde, i segreti pubblicati muoiono davvero, nasce il mandato storia36).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1033)

La CI rossa lasciata da S1032 è stata diagnosticata **riproducendo il login contro il DB della CI**
(i log mentivano): la chiave di cifratura MFA del runner non era quella con cui i segreti sono
cifrati, e la chiave madre non era mai arrivata all'ambiente del runner. Sistemate entrambe via
drop-in systemd, più il sintomo che aveva sviato tutti — un guasto di decifratura usciva come
richiesta malformata del client, ora è un errore interno tipizzato col suo codice. **Tutti i gate
sono verdi**, Playwright compreso (aveva due cause proprie: un modulo che non compilava una volta
transpilato e la password unica rimasta lato web dopo Z-262). **`Z-261` CHIUSO** con l'ok di Enzo:
i fattori coi segreti pubblicati eliminati dai tre database, nessun utente rimasto senza secondo
fattore. Gli attori dei test si scelgono ora **per caratteristica** (`test/helpers/actors.ts` +
guardia falsificabile; profili estesi agli invarianti I18/I20). Audit di completezza del DBMS
eseguito live → **mandato Enzo: storia RTL su trentasei mesi (#77)**, piano scritto e committato.

## Obiettivo permanente (mandato Enzo, S1029 — vale per OGNI sessione futura)

**Portare heuresys-advanced a una fresh session senza pendenze**: zero debiti, zero task incompleti,
zero pending, zero errori aperti. Il censimento è fatto; ora è esecuzione, con **doppia verifica e
review adversarial per ogni task**. Tutte le decisioni tecniche sono di Claude, il tracciamento del
piano pure; a Enzo vanno solo le voci che dipendono da un suo input.

## Stato dei piani

- Zero-pendenze: `docs/superpowers/specs/2026-07-25-zero-pending-plan.md` — si conta con `zp_state.py piano`.
- **Storia RTL (nuovo, S1033)**: `docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md` — stato vivo in `.storia36/PROGRESS.md`.

## ⚠ Top priorities (next session)

1. **#77 storia36 — eseguire da C0** (il PRIMO atto è il dump completo, prima di ogni scrittura).
   Piano autosufficiente + decisioni di Enzo già vincolate dentro; riprendere sempre dal primo
   cluster non spuntato in `.storia36/PROGRESS.md`. Effort: dettagliato per cluster nel piano.
2. **`Z-259` da riprendere** con i rilievi in `.zp/prove/Z-259-verdetti-adversarial.json`: la
   proiezione deve guardare dentro i valori annidati, e il test deve girare su più soggetti.
3. `Z-260` (dossier per i revisori, chiesto da Enzo) · `Z-258` (ambito tenant in tre classi).

## Open questions (autorità *cosa* = Enzo)

- **`admin@heuresys.com`**: account di servizio (deciso S1032), derivato, senza posizione (unico).
  Le sue funzioni dovevano passare a `enzo.spenuso@heuresys.com`, che però **non ha alcun accesso**:
  da decidere se e quando.
- **Autonomia non presidiata**: freno inserito. Restano i controlli su sessione viva; il registro
  delle corse (`.zp/runs.ndjson`) non esiste ancora.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors ·
  **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
gh run list --limit 8                             # tutti i gate verdi attesi
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc \
  "SELECT count(*) FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_metadata->>'label'='e2e-fixture'"
                                                  # 0 = Z-261 resta chiuso
cat .storia36/PROGRESS.md                         # C0 = primo cluster da eseguire
```
