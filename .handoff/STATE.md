# STATE — vista rapida

*Ultimo aggiornamento: S1095 (2026-09-10). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

S1095, tre corse. **Prima**: 19 commit di S1094 rimasti solo locali → pushati. **Seconda** — 3
vulnerabilità Dependabot corrette; **B18** (secondo fattore obbligatorio) chiuso davvero (le due
politiche per cliente erano spente, ora accese via API live, nessuno resta bloccato); **B23**
(cancello sull'isolamento clienti) costruito — `gate.ts` esteso con `tenantGate`, l'app rifiuta di
avviarsi se una rotta sensibile dimentica il confine; trovata e corretta una CI-rossa pre-esistente
(un test dava per invariante che una tabella fosse solo-RTL, non lo è più — dato corretto, test
stale). **Terza** — Fase 3 del bundle Cowork chiusa: **B11** (160 ruoli ri-mappati su ESCO, 0
scadenti, 0 senza mappatura), **B30** (73 KPI/73 legami, tutti i processi coperti), **B12** (33
unità + 71 posizioni + 132 competenze nelle tabelle di contenuto del blueprint bancario, prima
vuote — nessun SQL era pronto, scritto sul modello di B11/B30). `db_health.py` verde dopo tutto.
Misurata (non ruotata) `MFA_ENCRYPTION_KEY`: tutti i fattori cifrati, procedura scritta in
`02_istruttorie/PROCEDURA_rotazione_MFA_ENCRYPTION_KEY_20260910.md` del bundle, decisione a Enzo.
⚠ Pulizia fatta su richiesta: i due script usa-e-getta `_tmp-*.mjs` sono stati cancellati (confermato
da Enzo), incluse le copie orfane rimaste sul gemello dopo la propagazione.

## Top priorities

0. ⚠ **CI ROSSA da chiudere per prima — `Test (api integration)` su `1987af4a`.** Le altre
   SETTE corse sono verdi. Non e' stata diagnosticata: la sessione si e' fermata sulla soglia
   del contesto (guardiano: «mancano 5.054 token», e il contesto e' un pavimento) mentre il
   cancello locale era ancora in corso. **Ipotesi NON verificata**, da provare e non da
   credere. **AGGIORNATO con la MISURA**: il cancello locale, finito dopo la chiusura, nomina
   **DUE file**, ed entrambi nascono da B14 di questo blocco:
   · `apps/api/test/branches.integration.test.ts` — atteso: le 6 righe di `sys_branches` non
     esistono sul clone della CI (dato entrato da script e non dalla catena, il difetto gia'
     visto tre volte in questa sessione). Rimedio probabile: portare le filiali nella catena,
     come ha fatto la `000401` per i contenuti KPI.
   · `apps/api/test/rbac-tenant-admin-allowlist.test.ts` — **QUESTO NON ERA PREVISTO, ed e' il
     piu' importante**: esiste un'allowlist di cio' che `TENANT_ADMIN` puo' possedere, e la
     mig. `000404` gli ha concesso `branch:list`/`branch:read` senza aggiungerli a quell'elenco.
     E' un difetto del mio lavoro, non un test stale: o i due permessi entrano nell'allowlist
     con la loro ragione, o non vanno concessi a `TENANT_ADMIN`. Da decidere guardando il file,
     non a memoria.
   Primo comando: `cd apps/api && pnpm exec vitest run test/rbac-tenant-admin-allowlist.test.ts`.


1. **`#169` F3 — «il segreto smette di essere derivato»**. Tocca l'autenticazione di **159 utenti
   su 164**: merita capienza piena, non un residuo di fine sessione.
2. **`#54` F4** — frontend `/recruiting` + E2E. ⚠ `sys_candidates` ha **1 riga**, non zero.
3. **`D-92`** — due piani si dichiarano CHIUSI con fasi aperte (`246-fixed-term` e `S1093-mandato`).
4. **Bundle Cowork, fase 4** — B13 (dossier persona), B14 (filiali), B15 (censimento API↔pagine),
   B16 (scheda cliente per il cliente): nessun dato pronto, da progettare.

▸ Poi: `#159` F2 (ponte gateway↔pagine) · `#214` F6 (dodicesimo perimetro) · `#149` F4.

## Open questions

- **Il pattern da catturare**: la headline delle migrazioni in `SOT_STATE.md` si ri-deriva a mano
  ogni volta. Uno script o un hook? Non implementato di iniziativa.
- ⏳ **SOSPESA (Enzo)**: dove custodire la chiave del collaudo; rotazione di `MFA_ENCRYPTION_KEY` —
  procedura pronta (vedi sopra), la decisione di quando resta sua.
- **`#205` F1**: da quali siti la piattaforma accetta di imparare.
- ⚠ **NON SPIEGATO** (da S1093): perché il segreto TOTP *in chiaro* venisse rifiutato dal login.
- **andrea.spenuso / chiara.spenuso** vedranno «iscrizione richiesta» al prossimo login (effetto
  atteso di B18, non un guasto).
- **Discrepanza rimisurata**: il mandato riportava `v_valutazione_completata_non_condivisa` a 570
  righe (568 coperte + 2 no); rimisurato in S1095 è **0**. Non indagato — registrato nel piano del
  bundle, fuori dal mandato di questa corsa.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/verify_gate.py selftest        # 10 casi router + 4 sull'impronta
python docs/kb/tools/check_verifica_consegne.py     # 0 verde · 1 non verificata · 2 NON MISURATO
python docs/kb/tools/programmi.py --selftest        # 22 casi, 2 nuovi con controprova
bash scripts/verifica-deploy.sh                     # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
python docs/kb/tools/db_health.py                   # sentinelle, atteso exit 0
cd apps/api && pnpm exec vitest run test/org-gate.integration.test.ts   # tenantGate, 4/4 attesi
```
