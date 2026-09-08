# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1092 (2026-09-08). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Sessione su mandato «igiene, verify_gate, poi tutte le voci P1→P3 in autonomia, ordine a
mia scelta». Piano-file in `.programmi/S1092-mandato-p1-p3.md`, chiuso **13 voci su 14**;
poi Enzo ha chiesto una raccomandazione sulle due domande rimaste e ha detto di eseguirla.
Il guardiano non ha mai tagliato.

**Chiuse**: `#54` F3 (recruiting, 7 fette su 7) · `#143` F3 (asse funzionale) · `#214` F6
(decimo perimetro, live) · `#169` F3c (i segreti TOTP non sono più derivati).

## ⭐ Quattro reperti che valgono oltre le voci

1. **Una premessa del nostro piano era falsa, e ha retto tre sessioni.** `#169` F3a doveva
   spostare 89 spec su 101 alle utenze di collaudo, perché «la suite deriva il segreto».
   La domanda giusta non era *da quale identità entrano i test* ma **da dove prendono il
   segreto**: lo leggono dal database. F3a **cancellata**, costo reale **un file**.
   → Le premesse dei nostri piani sono fonti non verificate come le consegne del lab (`#149`).
2. **Ho concluso da una misura giusta una frase più larga di essa**: «il ramo MFA non si
   percorre mai» era vero in produzione (enforcement spento) e **falso nei test**, che lo
   accendono di proposito. Salto di dominio — la famiglia DIF-4.
3. **Un conteggio può misurare la portata invece del titolo**: `resolveActivityScope`
   registrava `self` per un capo la cui squadra è vuota, cioè «non ha ambito funzionale».
4. **Una porta può essere vuota per il criterio e occupata nei fatti**:
   `enterprise_typing_metadata` non contiene indirizzi di posta — quindi la guardia di
   famiglia lo direbbe pulito — ma contiene un nome proprio in chiaro.

## Top priorities

1. **`#169` F4** — la prova formale, ed è l'ultima della voce. La sostanza c'è già: chi ha
   la chiave madre non ottiene più alcun secondo fattore, misurato ri-derivandoli tutti.
2. **`#54` F4** — frontend `/recruiting` + Kanban + E2E con login reale. Le sette tabelle
   sono **vuote**: la dimostrazione su dati di dominio è materia di questa fase.
3. **`#143` F4/F5** — API progetti/squadre col confine I18, poi la dimostrazione con un capo
   progetto gerarchicamente inferiore a un suo membro (3 squadre reali hanno già quella forma).
4. **`#214` F6** — continuativa: la coda si ri-deriva, non si ricorda.

## Open questions

- ⏳ **SOSPESA per decisione di Enzo (2026-09-08)**: dove custodire la chiave del collaudo,
  perché smetta di viaggiare insieme alla chiave madre. F3c l'ha **ridimensionata** — quella
  porta non apre più nulla di amministrativo — ma le due chiavi restano co-locate ovunque.
- **Se e quando accendere l'enforcement MFA**: scelta di prodotto, senza scadenza. È l'unico
  evento che rimetterebbe in gioco le utenze di collaudo per la suite.
- **`#205` F1**: serve sapere **da quali siti** la piattaforma accetta di imparare. Con una
  fonte per dominio il registro c'è ma non discrimina.
- **`#198`** resta GATED su un fatto ri-misurato: `sys_blueprint_content_*` tutte a zero.
- ⚠ Una chiave API è transitata nell'output di un comando in S1088: **da ruotare**.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/check_concetti_agente.py     # pretende l'atlante fresco, e si ferma se non lo e'
bash scripts/verifica-deploy.sh                    # vocabolario chiuso: DEPLOYATO/IN-VOLO/CI-ROSSA/...
python docs/kb/tools/db_health.py                  # sentinelle, atteso exit 0
```
