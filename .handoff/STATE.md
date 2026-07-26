# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-26 (S1032 — l'accesso smette di passare da sette personas, e un segreto pubblico viene a galla).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1032)

Due cluster tentati e **interrotti** dai revisori adversarial, e un terzo lavoro — non
previsto — che ha cambiato il modello di accesso del progetto.

`Z-257` (il gate GDPR che guardava 74 riferimenti su 248) è stato corretto e reso falsificabile,
ma tre revisori su tre hanno dimostrato che allargare il registro **senza toccare chi lo consuma**
apriva una fuga: l'export self-service consegnava righe intere di fatti altrui. Rollback eseguito,
produzione riportata allo stato di partenza. `Z-259`, nato per chiudere la fuga preesistente sui
riferimenti-attore, ha chiuso due casi misurati ma è caduto su un terzo che nessuna delle sue due
guardie vede — un id dentro una colonna jsonb — e su un test che ereditava lo stesso punto cieco
del codice che sorvegliava.

Cercando come rendere più agile il login di sviluppo è emerso che il repository è **pubblico** e
pubblicava sette segreti TOTP corrispondenti ad altrettanti fattori attivi in produzione. Da lì la
decisione di Enzo: via le personas, accesso per tutti gli utenti. Fatto — 158 su 158 hanno ora
identità, password e secondo fattore **derivati** da una chiave madre gitignored; i segreti sono
usciti dai due file del repo; i file di test non sono stati toccati, grazie a un segnaposto risolto al momento del login.

## Obiettivo permanente (mandato Enzo, S1029 — vale per OGNI sessione futura)

**Portare heuresys-advanced a una fresh session senza pendenze**: zero debiti, zero task incompleti,
zero pending, zero errori aperti. Il censimento è fatto; ora è esecuzione, con **doppia verifica e
review adversarial per ogni task**. Tutte le decisioni tecniche sono di Claude, il tracciamento del
piano pure; a Enzo vanno solo le voci che dipendono da un suo input.

## Stato del piano

`docs/superpowers/specs/2026-07-25-zero-pending-plan.md` — si conta con `zp_state.py piano`.
Piani operativi nuovi: `2026-07-26-z261-mfa-fixture-secret-rotation.md` (superato dai fatti, vedi
`Z-261`) e `2026-07-26-z262-accesso-derivato-tutti-gli-utenti.md` (eseguito nei passi 1-4).

## ⚠ Top priorities (next session)

1. **`Z-261` — i sette segreti pubblicati sono ANCORA attivi.** I fattori `e2e-fixture` non sono
   stati eliminati perché `mfa-enroll-confirm` resta rosso: manipola i fattori di `paolo.caputo` e
   li ripristina nella forma vecchia. Sistemare quel file, poi eliminarli (serve il via di Enzo:
   il sistema blocca le cancellazioni su produzione). **È l'unica cosa aperta verso l'esterno.**
2. 🔴 **CI ROSSA — 158 file su 218 — e deploy BLOCCATO.** È il danno di questa sessione, non un
   guasto preesistente: prima erano 2 workflow, ora è la suite. Il passaggio alle credenziali
   derivate è stato validato su **un campione** (GDPR 9/9 + 5 file auth) e da lì dichiarato valido
   per tutti i 162 file — una generalizzazione da un caso, lo stesso errore che i revisori avevano
   contestato due volte lo stesso giorno. **Cosa è già stato sistemato**: `heuresys_ci` rigenerato
   dalla PROD (160 credenziali / 159 fattori, era 13/0) e la chiave madre raggiungibile in CI via
   `DEV_ACCESS_MASTER_KEY_B64` nell'env del runner (il checkout non porta `.secrets/`, che è
   gitignored — copiare il file nell'area di lavoro del runner si sarebbe rotto da solo).
   **Diagnosi NON confermata**: fra i fallimenti c'è `expected 'e2e-fixture' to be 'derived-access'`
   (un test asserisce l'etichetta vecchia) e `db:seed-test-admin` ora scrive con l'etichetta nuova
   su un DB che porta entrambe. **Da verificare prima di toccare**: eseguire in locale
   `pnpm exec vitest run` sull'intera suite — cosa che questa sessione NON ha fatto, ed è la ragione
   per cui il problema è emerso solo in CI. La VM è ferma a `a13cdb1e`; PROD non è stata toccata.
3. **`Z-259` da riprendere** con i 16 rilievi in `.zp/prove/Z-259-verdetti-adversarial.json`: la
   proiezione deve guardare dentro i valori annidati, e il test deve girare su più soggetti — con
   uno solo era verde su un export bucato.
4. `Z-260` (dossier per i revisori, chiesto da Enzo) · `Z-258` (ambito tenant in tre classi).

## Open questions (autorità *cosa* = Enzo)

- **Ridisegno delle personas**: la direzione è presa (utenti reali al posto delle 7 fisse) e
  l'accesso c'è. Resta da decidere se sostituire le costanti `MANAGER = "paolo.caputo@…"` con
  interrogazioni al DB, e con quale ordine di ondate procedere.
- **`admin@heuresys.com`**: mantenuto come account di servizio (deciso S1032), ora derivato.
  Le sue funzioni dovevano passare a `enzo.spenuso@heuresys.com`, che però **non ha alcun accesso**
  (zero identità, zero credenziali, nessun ruolo): da decidere se e quando.
- **Autonomia non presidiata**: freno inserito. Dopo S1032 restano da fare i controlli su sessione
  viva; il registro delle corse (`.zp/runs.ndjson`) non esiste ancora.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook (NON è il cancello
  dell'onboarding: `rtl-bank.org` non esiste come dominio) · **#16** SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/zp_state.py piano            # cluster totali/chiusi
pnpm dev:whoami luca.conti@rtl-bank.org           # credenziali di chiunque, ricalcolate
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c \
  "SELECT count(*) FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_metadata->>'label'='e2e-fixture'"
                                                  # 7 = Z-261 ancora aperto · 0 = chiuso
```
