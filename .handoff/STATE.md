# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1092 (2026-09-08). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Sessione su mandato «esegui tutte le voci da P1 a P3 e i gated in autonomia, decidendo per
mio conto, nell'ordine che ritieni più appropriato — l'unico guardiano che comanda è quello
della capienza». Piano-file in `.programmi/S1093-mandato-p1-p3-gated.md`.

**Chiuse**: `#169` **F4** (misurata, con esito onesto) · `#214` **F6** (undicesimo perimetro,
in produzione) · `#79` **F3** (cancello verde) · la chiave API di S1088 è **ruotata** (Enzo).
**Aperta e strumentata**: la CI Playwright, che era rossa da due commit.

## ⭐ Quattro reperti che valgono oltre le voci

1. **La CI era rossa per un buco lasciato da `#169` F3c, e nessuno l'aveva collegato alla
   voce.** In CI `MFA_ENFORCEMENT_ENABLED` vale **`true` per default** e il job non lo
   spegne: la CI accende quel ramo **di proposito**. Il commento del codice diceva che non
   si percorreva mai — vero in produzione, falso in CI. Ancora **DIF-4**, nella stessa voce
   dove S1092 l'aveva già trovato una volta.
2. **La prova generale ha trovato un difetto mio di un'ora prima.** Il fix scriveva i segreti
   TOTP **in chiaro**: funzionava (`decryptSecret` è self-identifying) ma accendeva
   `v_mfa_secrets_in_cleartext`. «Funziona» non è «è corretto», e un seed non è esente dagli
   invarianti perché è uno script. 26 secondi contro i 25 minuti di un giro di CI.
3. **Un conteggio misurava la portata invece della proprietà, e sembrava dire il contrario.**
   `stop-deriving-totp --dry-run` stampa «DA RENDERE CASUALI: 159» contando i fattori con
   un'etichetta — su un database già bonificato stampa lo stesso numero. Letto come misura
   avrebbe fatto concludere che F3c non fosse mai stata applicata.
4. **Una guardia giusta a metà è una guardia sbagliata.** `NODE_ENV=test` da solo avrebbe
   rigenerato i secondi fattori **veri**, perché su Windows il `.env` punta alla produzione
   via tunnel. La guardia finale pretende anche che il database si dichiari di collaudo dal
   proprio nome, ed è **provata a esiti opposti**.

## Top priorities

1. ✅ **La CI Playwright è tornata VERDE** (`success` su `084dcb30`, run `34239606307`). Ha
   chiuso il cerchio la **cifratura** del segreto — la stessa che la prova generale aveva
   preteso per la sentinella dei segreti in chiaro. Le due impronte messe lì per
   *diagnosticare* hanno finito per **confermare**: depositata `ede4d885`, usata `ede4d885`.
   ⚠ **Resta non spiegato** *perché* il segreto in chiaro venisse rifiutato dal login, dato
   che `decryptSecret` è self-identifying e avrebbe dovuto rileggerlo as-is. Cifrarlo ha reso
   verde la suite: quello è misurato. Il meccanismo no — e non si inventa.
2. **`#54` F4** — frontend `/recruiting` + Kanban + E2E. ⚠ Misurato: `sys_candidates` ha
   **1 riga**, non zero — lo stato precedente diceva le sette tabelle «vuote».
3. **`#143` F4/F5** — API progetti/squadre col confine I18.
4. **`#159` F2** — il ponte gateway↔pagine.

## Open questions

- ⏳ **SOSPESA per decisione di Enzo (2026-09-08)**: dove custodire la chiave del collaudo.
- **Se e quando accendere l'enforcement MFA** — ⭐ ora **ha il suo numero**: **159 utenti su
  164 attivi** hanno un fattore TOTP verificato il cui segreto è casuale e **non è mai stato
  consegnato a nessuno**. Accenderlo oggi chiuderebbe fuori il **97%** delle persone. La
  precondizione è un **percorso di ri-enrollment**: non è più una scelta senza vincoli, è una
  scelta con una precondizione misurata.
- **`#205` F1**: serve sapere **da quali siti** la piattaforma accetta di imparare.
- **`#198`** resta GATED su un fatto ri-misurato: `sys_blueprint_content_*` tutte a zero.
- ✅ **RISOLTA**: la chiave API transitata in un output in S1088 è stata **ruotata**.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/check_concetti_agente.py     # pretende l'atlante fresco, e si ferma se non lo e'
bash scripts/verifica-deploy.sh                    # vocabolario chiuso: DEPLOYATO/IN-VOLO/CI-ROSSA/...
python docs/kb/tools/db_health.py                  # sentinelle, atteso exit 0
```
