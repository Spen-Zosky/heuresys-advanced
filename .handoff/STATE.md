# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1094 (2026-09-09). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Mandato: «procedi con tutto in autonomia». I commit sono tutti col cancello verde e pushati.
**`#143` CHIUSA, tutte le fasi** — i progetti hanno un'API, una pagina e una prova del confine I18.
**`D-88` RISOLTO.** `test-api` gira sul gemello. L'ascolto di RTL non scade più.
**`#149`** F2/F3/F4 chiuse: il presidio delle consegne ora si misura a macchina.

## ⭐ Il filo: sei difetti, una famiglia sola

Ognuno era **un verde che significava «non ho guardato»** — la contestazione di Enzo dell'8/9,
trovata sei volte in un giorno:

- il cancello certificava **2 suite su 12** e rispondeva VERDE;
- l'impronta di verifica valeva `e3b0c442…` (SHA-256 del **vuoto**) e passava su qualsiasi contenuto;
- una rilevazione chiamata «in corso» era **chiusa da un mese**, e la finestra non poteva spostarsi;
- il menu di avvio invitava a **chiudere `#169`**, che ha due fasi aperte di cui una di sicurezza;
- `#149` era cieco su **metà del proprio innesco**, e stavo per essere la sesta sessione a sbagliare;
- un marker diceva «verificata» con numeri di un mese prima (`sys` 225 → oggi **240**).

**Tre volte uno strumento ha colto un mio errore prima che diventasse un danno**: il selftest
dell'impronta (due difetti nel mio codice), `programmi.py` (due incoerenze mentre chiudevo un
piano), il cancello locale (i test di `verify_gate` che avevo rotto violando C1 io stesso).

## Top priorities

1. **`#169` F3 — «il segreto smette di essere derivato»**. Tocca l'autenticazione di **159 utenti
   su 164**: merita capienza piena, non un residuo di fine sessione. ⚠ Il menu diceva «voce da
   chiudere» ed era falso: ora dice `2/4, riprendi da F3`.
2. **`#54` F4** — frontend `/recruiting` + E2E. ⚠ `sys_candidates` ha **1 riga**, non zero.
3. **`D-92`** — due piani si dichiarano CHIUSI con fasi aperte (`246-fixed-term` e `S1093-mandato`). Il parser è corretto; resta il **lavoro** che dichiaravano fatto.

▸ Poi: `#159` F2 (il ponte gateway↔pagine) · `#214` F6 (dodicesimo perimetro) · `#149` F4, che ora
ha uno strumento che gli dice quando ha bersagli.

## Open questions

- **Il pattern da catturare, proposto e non deciso**: tre volte in una sessione ho ri-derivato a
  mano la headline delle migrazioni in `SOT_STATE.md`, o `handoff-lint D3` blocca. Uno script o un
  hook? Non implementato di iniziativa.
- **Enforcement MFA** — accenderlo oggi chiuderebbe fuori **159 utenti su 164**. Precondizione: un
  percorso di ri-enrollment. È la stessa cosa che `#169` F3 deve rendere possibile.
- ⏳ **SOSPESA (Enzo, 2026-09-08)**: dove custodire la chiave del collaudo.
- **`#205` F1**: da quali siti la piattaforma accetta di imparare.
- ⚠ **NON SPIEGATO** (da S1093): perché il segreto TOTP *in chiaro* venisse rifiutato dal login.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/verify_gate.py selftest        # 10 casi router + 4 sull'impronta
python docs/kb/tools/check_verifica_consegne.py     # 0 verde · 1 non verificata · 2 NON MISURATO
python docs/kb/tools/programmi.py --selftest        # 22 casi, 2 nuovi con controprova
bash scripts/verifica-deploy.sh                     # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
python docs/kb/tools/db_health.py                   # sentinelle, atteso exit 0
```
