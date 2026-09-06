# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1089 (2026-09-06). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief — l'ultima sessione, in breve

Tre voci chiuse su richiesta di Enzo. **`#246` è finita** su tutte e quattro le fasi: la quota
di contratti a termine di RTL Bank è passata dal 32 % a **0,0 %**, con due sentinelle a
presidio e un rapporto che rende la domanda ripetibile senza di lui. **`#169` è tornata
attiva**: il blocco esterno è caduto (la suite è verde), ma misurando è emerso che le utenze
di collaudo sono **tre** contro le **sei** persone che la suite usa. **`#219`** ha ora un
workflow di CI dedicato, manuale, che il preflight protegge.

Il filo della giornata, di nuovo: **una misura vera può portare a una conclusione falsa**. Ho
corretto due mie affermazioni — «`heuresys_ci` non ha i dati» (falso: 161 utenti contro 164,
stessi contratti e competenze) e «cinque casi passano da soli» (falso: non erano stati
eseguiti). Il correttivo che funziona è **contare l'oggetto**, non dedurlo da un effetto.

## Top priorities — le priorità

1. **`#219` — il primo giro verde del workflow integrale** (~1 sessione). Stato preciso più
   sotto: il workflow esiste ed è **manuale**; il secondo giro era in corso alla chiusura.
   Si rilancia con `gh workflow run playwright-integrale.yml --ref main` e si guarda **il
   passo di preflight**: è lì che si vede se l'origine ammessa in CI è quella giusta.
2. **`#169` F3a — la suite passa alle utenze di collaudo** (~1-2 sessioni). ⚠ **Serve una
   decisione tua prima di iniziare**: le utenze di collaudo coprono `PLATFORM_ADMIN`,
   `TENANT_ADMIN` e `USER`; restano scoperti *manager*, *outsider* e **custodian**. Per la
   custodia delle segnalazioni whistleblowing — isolamento assoluto per ADR-0036 §5 — va
   deciso **se un'utenza di servizio possa portarne il mandato**. È sicurezza, non tecnica.
3. **`#54` F3 — le quattro fette che restano** (~2 sessioni). Pattern rodato.

## Open questions — le domande aperte

- ⭐ **Da quali fonti la piattaforma accetta di imparare com'è fatta un'azienda?** — il
  registro ne porta **una sola**. Tre voci ferme qui (`#198`, `#205`, il ponte di `#132`).
- **La ricerca semantica sul gemello è accesa** e ogni corsa integrale costa **due chiamate a
  pagamento** al fornitore di embedding. Va bene, o la si rispegne lì?
- ⚠ **Una chiave API è transitata nell'output di un comando** in S1088 (mai scritta in un
  file). Quella del fornitore di embedding è da ruotare, per prudenza.
- **Chi ha pushato il 26 agosto alle 18:47?** Invariata da S1082.

## Dove riprendere ESATTAMENTE — `#219` in CI

Perché una sessione nuova non debba ricostruire niente:

- il workflow è `.github/workflows/playwright-integrale.yml`, **`workflow_dispatch` soltanto**:
  non gira su push, quindi non può rompere nulla mentre è in prova;
- **primo giro rosso** (`34038765559`): mancavano i passi preparatori — `tsx: not found`,
  `node_modules missing`. Corretto riusando la sequenza dello smoke;
- **secondo giro** (`34039328831`): rosso **sul preflight**, e il preflight ha fatto il suo
  mestiere — si e' fermato in **due secondi** dichiarando «porta dell'API NON MISURABILE: ne'
  `NEXT_PUBLIC_API_PROXY_BASE_URL` ne' `PORT` sono dichiarate» invece di indovinare una porta
  e produrre una corsa intera di rossi non attribuibili. In locale la porta si deriva dal
  `.env` del repo; **in CI quel file non esiste** (il checkout e' pulito). Corretto
  dichiarando `PORT: "3001"` e `NEXT_PUBLIC_API_PROXY_BASE_URL` a livello di job — la seconda
  serve **prima del build del web**, perche' Next compila i rewrites al momento del build;
- **terzo giro** (`34040733480`): lanciato alla chiusura di S1089 e **prosegue da se'** — un
  giro di CI non muore con la sessione. Si legge con
  `gh run view 34040733480 --json status,conclusion,jobs` e, se rosso,
  `gh run view 34040733480 --log-failed`;
- sul runner l'origine ammessa è dichiarata da un **drop-in systemd** installato in S1089:
  `/etc/systemd/system/actions.runner.Spen-Zosky-heuresys-advanced.linux-pc-runner.service.d/e2e-origin.conf`
  → `ADMIN_ORIGIN=http://localhost:3187`. Si annulla cancellando quel file. Verificato attivo
  con `systemctl show -p Environment --value <servizio>`;
- ⚠ se il preflight in CI dichiara ancora l'origine non ammessa, **il valore che conta viene
  da un'altra parte** (probabilmente un `.env` nella directory di lavoro del checkout, che
  vince sull'ambiente del servizio): si cerca lì, non si tocca di nuovo il drop-in.

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py       # menu + salute, un solo giro
bash scripts/verifica-deploy.sh             # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
gh run list --workflow=playwright-integrale.yml --limit 3
ssh linux-pc 'cat /proc/loadavg'            # prima di ogni corsa E2E: sotto 2, o i rossi non sono attribuibili
cd apps/web && node scripts/e2e-blocchi.mjs --solo-preflight   # 0 = l'ambiente e' quello che la suite presume
```
