# S1093 — mandato «tutte le voci P1→P3 e i gated, in autonomia»

*Enzo, 2026-09-08: «esegui tutti da P1 a P3 e i gated in autonomia e automaticamente prendendo
decisioni per mio conto, nell'ordine che ritieni più appropriato. l'unico guardiano che comanda è
quello della capienza.»*

**Confine di sessione dichiarato all'inizio (R24 §4)**: il mandato copre 10 voci, alcune stimate in
più sessioni ciascuna (`#143` ~4-6, `#159` ~3-4, `#54` ~5-7 nella stima del register). **Non sono
tutte completabili in questa sessione**, e non fingerò che lo siano. Il criterio con cui taglio è
uno solo, quello che Enzo ha nominato: il guardiano della capienza (contesto ≥ 75% **oppure**
finestra 5h ≥ 80% → si interrompe, si committa, si chiude). Fino a quella soglia si procede senza
chiedere. Ogni voce che resta si chiude **a fase intera**, mai a metà.

**Misura di apertura** (`guardiano.py`, 2026-09-08): contesto **10.2%** · finestra 5h **9.0%** ·
verdetto testuale: `✓ si continua — contesto: mancano 648,444 token · 5h: mancano 71.0 punti`.

---

## Ordine deciso, e perché

L'ordine non è quello del menu: è quello che **massimizza le voci chiuse per token speso**, mettendo
davanti ciò che sblocca gli altri.

| # | voce | perché qui |
|---|---|---|
| **P0** | **CI rossa** (Playwright smoke) | Non è nel menu ma viene prima di tutto: regola di progetto «un CI rosso è un errore che Claude DEVE correggere». E **blocca il deploy** — `verifica-deploy.sh` dice `CI-ROSSA — il deploy non avverrà`, con VM e linux-pc fermi a `9fc9c80f` contro HEAD `411da7ff`. Finché è rossa, nessuna delle voci sotto arriva in produzione |
| 1 | `#169` **F4** | La prova formale, ultima fase della voce. La CI rossa **è** dentro questo perimetro (l'ha aperta F3c): chiudendo P0 la F4 si trova gran parte della strada fatta |
| 2 | `#214` **F6** | Un perimetro per volta, coda già ordinata: costo basso, chiude un pezzo di continuativo |
| 3 | `#79` **F3** | Continuativo che si aggancia a qualunque lavoro popoli tabelle → si esegue **insieme** a `#54` F4, non prima |
| 4 | `#54` **F4** | Frontend `/recruiting` + E2E. Popola tabelle ⇒ trascina `#79` F3 |
| 5 | `#143` **F4/F5** | La più grande delle P1; si affronta con la capienza ancora alta |
| 6 | `#159` **F2** | Il ponte gateway↔pagine |
| 7 | `#149` **F4** | Continuativo per costruzione: si chiude *su* una consegna, e vale come regola applicata alle voci sopra |
| 8 | `#205` / `#198` / `#41` | I tre gated: prima si **misura se il gate è ancora vero** (lo sta facendo la ricognizione), poi si decide |

---

## Registro deliverable

Stato: `da-fare` · `in-corso` · `FATTO` · `non-fatta (ragione)`

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **P0** | CI Playwright smoke torna verde | claude | `gh run list` su HEAD: playwright-smoke = success | in-corso |
| P0b | Typecheck + Lint concludono su HEAD (ora `cancelled`, cioè mai misurati) | claude | entrambe `success` sullo stesso sha | da-fare |
| A1 | `#169` F4 — la prova formale | claude | prova che ri-deriva **tutti** i segreti dalla chiave madre e mostra 0 corrispondenze | da-fare |
| A2 | `#214` F6 — un perimetro | claude | riga in `agent-perimetri.json` + dimostrazione live | da-fare |
| A3 | `#54` F4 + `#79` F3 | claude | pagina `/recruiting` su dati reali + cancello esposizione verde | da-fare |
| A4 | `#143` F4/F5 | claude | API progetti/squadre + confine I18 dimostrato | da-fare |
| A5 | `#159` F2 — il ponte | claude | — | da-fare |
| A6 | `#149` F4 | claude | — | da-fare |
| A7 | i tre gated: verdetto misurato + azione conseguente | claude | per ognuno GATE-REALE / GATE-CADUTO con evidenza | da-fare |

---

## P0 — la CI rossa: diagnosi chiusa, misurata anello per anello

**Non era «la CI è instabile».** È un difetto vero, aperto da `#169` F3c (commit `4d90df2f`) e non
chiuso da `411da7ff`, che pure si intitolava «i tre rossi della CI».

### La catena, tutta misurata

| anello | fatto | evidenza |
|---|---|---|
| la CI accende l'MFA **di proposito** | `MFA_ENFORCEMENT_ENABLED` ha **default `true`** e il job non lo spegne | `apps/api/src/config/env.ts:254-257` · `playwright-smoke.yml:50` |
| il seed crea un fattore TOTP **verificato** per ogni persona | con segreto **casuale** dopo F3c | `db/scripts/seed-test-admin.ts:96` (`segretoTotpCasuale()`) |
| il login chiede il secondo fattore | ma **solo se** l'enforcement è acceso | `apps/api/src/modules/auth/service.ts:392` |
| Playwright non può rispondere | `totpSecretFor` **lancia per progetto** dopo F3c | `apps/web/tests/e2e/mfa-fixture-secrets.ts:50` |
| esito | 6 setup falliti × 2 tentativi | run `34186462524`, `6 failed` |

### Le due affermazioni scritte nel codice che la misura ha smentito

1. **`mfa-fixture-secrets.ts`**: *«la suite Playwright gira contro il server reale, dove l'enforcement
   MFA è spento, quindi questa funzione non viene chiamata»*. Vero **in produzione**, falso **in CI**,
   dove l'enforcement è acceso dal default. È la famiglia **DIF-4**: la misura era giusta, la frase
   più larga della misura. Il reperto era già stato *nominato* alla chiusura di S1092 — ma il buco in
   CI è rimasto aperto.
2. **`seed-test-admin.ts:86-87`**: *«the platform stores TOTP secrets base32-plaintext»*. **Falso
   oggi**: misurato, ogni segreto TOTP in produzione è lungo **93** caratteri, che è esattamente
   `enc:v1:` + iv + tag + ciphertext in base64 → sono **cifrati AES-256-GCM** (QW-SEC6). Il commento
   descrive un mondo precedente al bulk-encrypt.

### La misura che ha salvato la diagnosi

Stavo per concludere che F3c avesse rotto **ogni** login E2E, produzione compresa — lo suggeriva
`mfa-routes.ts:8-10` («un utente con un fattore verificato ottiene `mfa_required`»). Login reale
contro `https://www.heuresys.com/api` con una persona vera: **`status: "success"`, nessun
challengeToken**. La produzione è sana. La condizione vera sta in `service.ts:392`, dove la sfida è
subordinata a `mfaEnforcement`.

### Simulazione a 5 domande (R24 §3) — risposte PRIMA di eseguire

- **Precondizioni**: `apps/web/tests/.auth/` è gitignored → **verificato**, `apps/web/.gitignore:1`.
  Il seed ha già un client PG aperto → verificato. In CI il seed gira **prima** di Playwright nello
  stesso job → verificato, `playwright-smoke.yml:143` poi lo step dei test.
- **Meccanismo**: `decryptSecret` è **self-identifying** — un valore senza prefisso `enc:v1:` torna
  *as-is* (`secret-crypto.ts:24-27`). Quindi un segreto scritto in chiaro dal seed funziona senza
  toccare la cifratura. E i fattori con label `derived-access` sono **esclusi** dalla ri-cifratura
  pigra (`mfa-service.ts:949`), quindi non verranno mutati sotto i piedi della suite.
- **Propagazione**: il file dei segreti è **per-macchina** e si rigenera a ogni seed; non entra nel
  repo (gitignored) e non viaggia con `align-clones`. Nessun artefatto nuovo da propagare.
- **Chi**: claude, per intero.
- **Guardia**: l'export **non deve mai avvenire in produzione**. Guardia: `NODE_ENV === "test"`.
  Regge sul caso limite? Se `NODE_ENV` è **assente** → `undefined !== "test"` → non esporta
  (fail-safe corretto). In produzione `NODE_ENV=production` → non esporta. In CI il job dichiara
  `NODE_ENV: test` → esporta. **Una guardia che sbaglia qui scrive su disco i secondi fattori veri**:
  è il punto più delicato del fix, ed è per questo che è negativa per difetto.

### La decisione, e le due strade scartate

**Scelta**: il seed **esporta** in un file gitignored il segreto casuale dell'ambiente di collaudo, e
la fixture Playwright lo legge da lì.

- ❌ *spegnere l'enforcement in CI* (`MFA_ENFORCEMENT_ENABLED: "false"` nel job): una riga, ma
  **spegne la copertura** che S983 WS-E aveva costruito apposta — la CI accende l'MFA per esercitare
  quel ramo. Rendere verde un test smettendo di provare la cosa non è correggerlo.
- ❌ *spostare la suite sulle utenze di collaudo `#169` F2*: è la strada che il messaggio d'errore
  suggerisce, ma costa la riscrittura delle personas in tutte le spec — ed è esattamente la F3a che
  S1092 ha **cancellato** dopo aver misurato che non serviva.
- ✅ *esportare il segreto di collaudo*: conserva **entrambe** le proprietà che contano — la copertura
  del ramo MFA **e** l'invariante di F3c (chi ha la chiave madre non ricostruisce il secondo
  fattore, perché resta casuale). Il segreto è noto solo al processo che l'ha generato, che è la
  definizione di un ambiente di collaudo.

### Decomposizione fino al comando

1. `db/scripts/seed-test-admin.ts` — `ensureTotpFactor` diventa: genera il segreto, **impone** il
   fattore fixture (l'`INSERT … WHERE NOT EXISTS` odierno non basta: in CI il clone ha già il
   fattore, quindi il seed non genererebbe nulla e non conoscerebbe il segreto), e **ritorna il
   segreto in chiaro** al chiamante.
2. Stesso file — dopo il giro sulle personas, se `NODE_ENV === "test"`, scrive
   `apps/web/tests/.auth/totp-secrets.json`.
3. `apps/web/tests/e2e/mfa-fixture-secrets.ts` — `totpSecretFor` legge quel file; se manca o non ha
   la persona, **lancia ancora**, con un messaggio che dice di lanciare il seed.
4. Prova: `pnpm db:seed-test-admin` con `NODE_ENV=test` su una copia, poi login a due passi.
5. Prova vera (DoD): la CI torna verde su un commit nuovo.

**Prova di chiusura**: `gh run list` mostra `playwright-smoke` = `success` sullo sha del commit di
questa correzione, e `verifica-deploy.sh` smette di dire `CI-ROSSA`.

---

## Registro delle scoperte fuori ciclo (R24 §5 — si presentano UNA volta, non diventano pendenze)

- Le corse **Typecheck** e **Lint** su HEAD sono `cancelled`, non verdi: su quel commit non sono mai
  state misurate. Entra come **P0b** perché è la stessa CI, non una voce nuova.
- Lo step `playwright install-deps chromium` del job esce **1** (`Failed to install browser
  dependencies`) e il job prosegue lo stesso. Oggi non fa danno — i browser ci sono già sul runner —
  ma è un fallimento silenziato: da guardare, non in questo ciclo.
