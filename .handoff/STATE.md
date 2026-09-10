# STATE — vista rapida

*Ultimo aggiornamento: S1095 (2026-09-10). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

S1095 (due corse). **Prima corsa**: trovati 19 commit locali su main mai pushati (fix B1-B20 +
verify_gate + headline SOT_STATE, committati dopo che S1094 aveva già chiuso) → pushati, 0 residui.
**Seconda corsa** — mandato Cowork (bundle `BUNDLE_CLI_20260909`, revisione del 2026-09-09 su 3
voci dichiarate chiuse quando non lo erano):
- **3 vulnerabilità Dependabot corrette** (sharp 0.35.3→0.35.4, js-yaml 4.3.1→4.3.2, `ai`-sdk
  provider-utils 4.0.27→4.0.33 — pin esatto, non major-bump): override in `package.json`,
  typecheck+lint verdi.
- **B18 (secondo fattore obbligatorio) CHIUSA davvero**: le due politiche per cliente
  (`sys_auth_mfa_policies`) portate a `enabled=true` via API live, login reale (federica.marchetti,
  enzo.spenuso). I 5 utenti ACTIVE senza fattore: 3 SERVICE già esentati (#169 F2), 2 persone reali
  (andrea.spenuso, chiara.spenuso) andranno in iscrizione al prossimo login. Guardia a esiti
  opposti verde (dettaglio conteggi → SOT_STATE).
- **B23 (cancello tenant) CHIUSA**: `gate.ts` esteso con `tenantGate` (stessa popolazione di
  `orgGate`). Guardia provata a esiti opposti: rotta senza dichiarazione impedisce l'avvio
  (dettaglio conteggi → SOT_STATE).
- **VOCE 3 del mandato (rotazione chiave) NON eseguita**: il piano aggiornato (`01_PIANO.md`,
  riga `B18b`) la dichiara **SOSPESA da Enzo il 2026-09-09** — non una pendenza, una decisione già
  presa. Nessuna credenziale toccata.
- ⚠ **Pulizia dovuta**: `apps/api/scripts/_tmp-enable-mfa-policy.mjs` e
  `_tmp-verify-mfa-gate-prod.mjs` sono script usa-e-getta lasciati nel repo (non committati) — da
  rimuovere con conferma esplicita (regola: mai cancellare senza autorizzazione).
- **CI-ROSSA trovata e corretta**: `sdbi-perf-feedback.integration.test.ts` dava per invariante che
  `sys_continuous_feedback` fosse solo-RTL — pre-esistente, non da questa sessione. Una riga
  legacy risolve a due utenti Heuresys System; il tenant della riga la segue correttamente, era il
  test ad avere l'assunzione stale. Sostituito con un controllo di coerenza reale, verificato 0 sul
  vivo. Pushato; CI in corso su questo commit.

## Top priorities

1. **`#169` F3 — «il segreto smette di essere derivato»**. Tocca l'autenticazione di **159 utenti
   su 164**: merita capienza piena, non un residuo di fine sessione.
2. **`#54` F4** — frontend `/recruiting` + E2E. ⚠ `sys_candidates` ha **1 riga**, non zero.
3. **`D-92`** — due piani si dichiarano CHIUSI con fasi aperte (`246-fixed-term` e `S1093-mandato`).
4. **Bundle Cowork, fase 3** — B11 (mappature ESCO), B12 (CSV pronti), B30 (KPI settore): dati già
   pronti in `03_sql/`+`04_dati/` del bundle, da caricare.

▸ Poi: `#159` F2 (ponte gateway↔pagine) · `#214` F6 (dodicesimo perimetro) · `#149` F4.

## Open questions

- **Il pattern da catturare**: la headline delle migrazioni in `SOT_STATE.md` si ri-deriva a mano
  ogni volta. Uno script o un hook? Non implementato di iniziativa.
- ⏳ **SOSPESA (Enzo, 2026-09-08 e 2026-09-09)**: dove custodire la chiave del collaudo; rotazione di
  `MFA_ENCRYPTION_KEY`/chiave API — nessuna delle due si tocca finché Enzo non decide.
- **`#205` F1**: da quali siti la piattaforma accetta di imparare.
- ⚠ **NON SPIEGATO** (da S1093): perché il segreto TOTP *in chiaro* venisse rifiutato dal login.
- **andrea.spenuso / chiara.spenuso** vedranno «iscrizione richiesta» al prossimo login (effetto
  atteso di B18, non un guasto).

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
