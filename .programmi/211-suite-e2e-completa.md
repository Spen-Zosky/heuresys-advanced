# 211 — La suite E2E completa: i rossi che non sono guasti del prodotto, e i casi che non girano

> **item**: #211
> **stato**: IN CORSO

La suite E2E intera **non gira in nessuna corsa automatica**: la CI esegue solo
`smoke-5-personas.spec.ts` (101/101 verde). Il resto è verde o rosso solo quando qualcuno lo
lancia a mano, e nessuno lo lanciava. Il triage è fatto: i rossi sono **sei famiglie**, nessuna
è un guasto del prodotto.

## Decisioni e fatti acquisiti (non si ri-discutono)

- **Nessuna delle sei famiglie è una regressione recente.** ① è strutturale della suite (esiste
  da quando supera i 15 minuti), ② data da ADR-0032 (2026-08-04), ③ da `77b52e04`, ④ da mig
  `000272`. Il confronto con un commit precedente **non serve più**: la causa di ciascuna è nominata.
- **Rinnovare i cookie dentro la corsa non è praticabile**, ed era scritto nella config da prima:
  ogni context ricarica lo stesso `tests/.auth/*.json`, il refresh token è single-use, il primo
  che ruota fa scattare `REFRESH_REPLAY_DETECTED` su tutti gli altri.
- **Allungare `ACCESS_JWT_TTL_SECONDS` per la corsa è scartato**: una suite che gira su un TTL
  che nessun utente ha non prova più il prodotto che esiste.
- **La divisione in blocchi è DERIVATA dal filesystem**, mai un elenco scritto a mano: una spec
  nuova lasciata fuori non girerebbe in silenzio, che è il difetto stesso di questa voce.

## Fasi

- [x] **F0 Il triage: sei famiglie, nessun guasto del prodotto** — FATTO 2026-08-17 · `217c74dd` e `292e4db4` · 35 rossi ricondotti a sei cause nominate; gli errori sono «element(s) not found» (43) e «toBeVisible failed» (41), non 400 di validazione
- [x] **F1 ① La suite non si scade più addosso, e ora si CONTA ciò che ha eseguito** — FATTO 2026-08-17 · `5770bdfd` · catena a quattro fasi con re-login, fasi come invocazioni separate (`apps/web/scripts/e2e-blocchi.mjs`); corsa completa ~27 min: **4/4 fasi · 335 passati · 18 falliti · 1 instabile · 80 non eseguiti · totale 434** = esattamente i casi dichiarati da `--list`
- [x] **F2 Gli 80 casi che non vengono eseguiti — la causa è isolata, e sono DUE** — FATTO 2026-08-18 · **74 su 80 sono strumenti a comando**, letti dalle annotazioni: `68 census run only — set F4_SWEEP=1` + `6 cattura on-demand: STORIA36_DEMO=1`. Restano ~6 casi che si dichiarano ciechi sul posto
      **Non erano un guasto, e non erano una cosa sola.** `f4-sweep.spec.ts` genera 68 casi
      (30 + 15 + 22 rotte per tre personas) dietro un `test.skip` a livello di `describe`:
      è un **censimento delle pagine**, uno strumento, non una prova del prodotto — e non deve
      girare in una corsa normale. `storia36-demo.spec.ts` ne aggiunge 6, catture dimostrative.
      **Il difetto vero era il resoconto**, che sommava questi ai casi saltati per mancanza di
      dati: due specie che non si sommano, e un numero che le mescola sembra giusto — la stessa
      lezione di E22 sugli indicatori. Ora `e2e-blocchi.mjs` li **raggruppa per motivo**, letto
      dalle annotazioni del reporter JSON e mai da un elenco scritto a mano: un motivo nuovo
      finirebbe altrimenti in silenzio nella categoria sbagliata.
- [ ] **F3 Le famiglie ②③④⑤⑥ — 18 casi** — budget ~80k
      Una correzione per famiglia, non 18 correzioni. Le cause sono già nominate in F0.
- [ ] **F4 Il criterio di verde, dichiarato** — budget ~20k
      O la suite completa entra in CI, o resta esplicitamente uno strumento a mano **con un rosso
      noto e accettato**. Oggi non è né l'una né l'altra cosa, ed è il motivo per cui 35 rossi
      sono vissuti invisibili.

### L'esito della corsa completa (2026-08-18, ~27 min) — la classificazione tiene

```
  NON ESEGUITI              : 80
  perche' non sono stati eseguiti (letto dalle annotazioni, non da un elenco):
      68  census run only — set F4_SWEEP=1
       6  cattura on-demand: STORIA36_DEMO=1
       1  nessuna variante disponibile su questo database
       1  nessuna attivazione da mostrare
       1  nessuna fascia importata dal legacy su questo tenant
       1  no skill-gap scores in scope
       1  employee has no goals rendered
       1  EMAIL transport non configurato (#8 WAIT-INPUT app-password Outlook)
       1  travolto da un fallimento precedente nel suo blocco `serial`
```

68 + 6 + 6 = 80, e ogni riga ha il suo perché. Due cose che questo elenco ha reso visibili:

- **nessuno dei 6 casi ciechi nasconde un dato che dovrebbe esserci.** Era il sospetto da
  sciogliere: un caso che si salta perché «non trova nulla» può nascondere un dato mancante.
  Il caso delle fasce con importi, per esempio, **non** compare — e infatti gira, perché RTL
  ha 12 bande con importi (misurato in `#209`). L'unico legato a una pendenza vera è quello
  di EMAIL, che rimanda a `#8` ed è già tracciato.
- **il salto «senza motivo» non era una terza specie**: in un blocco `serial` Playwright salta
  ciò che segue un fallimento. Non è un caso spento apposta — è **lavoro non provato a causa
  di un altro rosso**, e ora il resoconto lo dice con quelle parole. `#211` aveva escluso i
  blocchi serial («i tre file che li usano hanno 11 casi»): vero come conteggio, ma la
  conseguenza esiste ed era invisibile.

Corsa completa: **333 passati · 18 falliti · 3 instabili · 80 non eseguiti · 4/4 fasi**.

## Trappole misurate, da non ripetere

- ⚠⚠ **La prima stesura della cura di ① aveva reintrodotto il difetto di questa voce.** I re-login
  dipendevano dal blocco precedente; in Playwright un progetto la cui dipendenza fallisce viene
  **saltato**: 3 failed · 164 passed · **263 DID NOT RUN**. Il controllo di copertura non lo vide
  perché misurava che ogni spec fosse *assegnata* a un blocco, non che il blocco fosse *eseguito*.
- ⚠ **Anche la cura della cura aveva la sua bugia**: stampava «test dichiarati: 434 · fasi
  eseguite 4/4» contando le **fasi**, non i casi — dentro la terza, 71 su 152 non erano stati
  eseguiti. E `--fase 99` usciva **verde senza eseguire niente**.
- **Su Node ≥23 Playwright 1.61 muore all'import** (D-36): usare `pnpm test:e2e:prod:node22`.

## Chiuso quando

Si sa quanti guasti distinti ci sono dietro i casi rossi, ognuno ha una voce o una correzione, e
il criterio di verde della suite completa è dichiarato.
