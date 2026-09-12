# STATE — vista rapida

*Ultimo aggiornamento: S1095 (2026-09-12, seconda corsa). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Mandato di Enzo: tutte le voci P1→P3 in autonomia, con il solo guardiano della capienza a
governare il taglio. Registro in `.programmi/S1095-mandato-p1-p3.md`: **sette voci su otto**.
`#169` e `#54` **chiuse** (la chiave madre non completa più un accesso in produzione; il
recruiting dal browser con Kanban e vetrina pubblica `/jobs`, E2E verde con login reale);
`D-92` risolto (il difetto era al rovescio: una fase fatta e mai spuntata); dodicesimo
perimetro dell'agente; `#205` F1 (lo strumento della coda dei domini ricercabili); `#149` F4 su
una consegna. Due strumenti corretti misurando: `compatta_register.py` gonfiava l'archivio a
ogni corsa, e il criterio R3 scambiava l'owner di una posizione per una persona. Cancello di
fine turno GREEN su tutte le suite, test-api compresa sul gemello. `#159` F2 non aperta, con la
ragione: altro repository, e capienza insufficiente a chiuderla intera.

## Top priorities

1. **`#250` — Enzo non entra in produzione dal browser** (WAIT-INPUT): fattore TOTP casuale
   mai consegnato + obbligo acceso + **0 codici di recupero**, misurato. Serve la tua conferma
   a cancellare il fattore: al login successivo ti ri-iscrivi col tuo authenticator.
2. **`#159` F2** — il componente del ponte gateway↔pagine in `ux-design-shared` (~250k): si
   apre con capienza piena e quel repository libero da sessioni parallele.
3. **`#205` F2** — percorrere `positions` (testa della coda, fonte `ilo.org`) con una corsa di
   ricerca sul gateway; poi F3. Reperto da sciogliere prima: `business_processes` ha una fonte
   ma la sua destinazione non ha `tenant_id`.

▸ Poi: `#214` F6 (prossimi: `job-roles`, `skill-categories` — vocabolari delle persone, vanno
motivati su quella vicinanza) · `#149` F4 (4 consegne citate ancora NON-VERIFICATO) · Bundle
Cowork fase 4 (B13 dossier persona, B15 censimento API↔pagine, B16 scheda cliente: da progettare).

## Open questions

- ⏳ **SOSPESA (Enzo)**: dove custodire la chiave del collaudo; rotazione di `MFA_ENCRYPTION_KEY`
  (procedura pronta nel bundle). Non è più un gate di `#169`.
- **Il pattern da catturare**: la headline delle migrazioni in `SOT_STATE.md` si ri-deriva a mano
  ogni volta (oggi due volte). Uno script o un hook? Non implementato di iniziativa.
- **Igiene fuori repo**: `C:\Git\` porta ~29 log di sessioni CLI (4 di questa: una variabile vuota
  in un redirect) e `.handoff/session-journal.recovered.ndjson` del 6 settembre è già consolidato.
  Nessuno dei due cancellato: mai senza il tuo sì.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/verify_gate.py check                 # GREEN su 344cd461 (9 suite)
python docs/kb/tools/check_domini_ricercabili.py --selftest   # 9/9
python docs/kb/tools/compatta_register.py --selftest      # 15/15; a secco: «NIENTE DA COMPATTARE»
python docs/kb/tools/programmi.py --verifica              # 51 programmi, nessun difetto
bash scripts/verifica-deploy.sh                           # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
cd apps/api && node scripts/verify-derived-login.mjs federica.marchetti@rtl-bank.org https://www.heuresys.com/api   # atteso: passo 2, 401
```
