# Le 13 consegne del lab — piano di esecuzione (S1044)

**Aperto**: 2026-08-04 · **Mandato**: Enzo, primo messaggio di sessione.
**Ordine imposto**: (1) le P1 · (2) le due decisioni retributive · (3) il resto, ordine scelto da me.

## Confine di sessione — dichiarato all'inizio (R24 §4)

Le 13 consegne portano una stima del lab di **~20-30 ore**. **Non sono completabili in
questa sessione.** Questo piano è il registro che sopravvive alla sessione: lo stato si
legge da qui, e una consegna non iniziata resta `da fare` senza travestirsi da pendenza
scoperta all'ultimo momento.

Le consegne sono già nel registro come **#116–#128** (verificato: `lab_inbox.py --ingest`
→ «niente da ingerire», 13 file gemelli in `inbox/ingerite/`, 13 righe `lab-id:` in
`SOT_BACKLOG.md`). Ogni riga qui sotto rimanda al criterio di chiusura scritto nel blocco
del registro: **quello è il contratto**, questo piano ne traccia lo stato.

## Il cancello di Enzo — sciolto

`#120` porta due aumenti che Enzo ha chiesto di vedere prima dell'applicazione.
Misurati sul database vivo e presentati il 2026-08-04:

| | Roberta Caputo | Martina Sala |
|---|---|---|
| Dirige | Direzione Back Office — 9 persone | Direzione Bilancio e Segnalazioni — 5 persone |
| In azienda da | 01/04/2018 (8,3 anni) | 24/05/2024 (2,2 anni) |
| Oggi | 3A3L · 48.049 € | 3A3L · 46.071 € |
| Proposto | 73.200 € (**+52,3%**) | 66.800 € (**+45,0%**) |

Causa del salto: il pavimento di `MG-2` è **65.000 €** (misurato: 65.000–100.000), loro
stanno 17.000 e 19.000 € sotto. **Decisione di Enzo: applicare entrambi come proposti.**

## Le 13 righe

| id | consegna | chi | fatto quando | stato |
|---|---|---|---|---|
| **#116** | atterraggio derivato dal permesso, non dall'elenco di ruoli | io | nessuno atterra dove non ha il permesso + test che fallisce se si ricabla la lista | ✅ **FATTO** — `0f619e85` |
| **#124** | mascheratura nel contratto dati | io | risposta HTTP reale con importo assente e campo `masked` che lo dichiara | ⏸ **INTERROTTA** — `ADR-0032`; **entrambe** le classi che la decisione nomina (pay + valutazioni) mascherate e provate live; resta strato 1 + aggregati + frontend |
| **#118** | dieci responsabili a `QD3` + `martina.gentile` registrata | io | `verifica_incrociata.py --famiglia X1 --famiglia X2`, X2a/X2b a zero | ✅ **FATTO** — mig `000264` |
| **#120** | dieci posizioni a `MG-2` + collocazione retributiva | io | `X3a` a zero su universo ≠ zero; nessuno sotto 65.000 € | ✅ **FATTO** — mig `000264` |
| **#119** | `UI_ADMIN_ROLES` e i tre `return "TEAM"` derivati dai domini | io | `CEO` vede le sezioni senza comparire in alcuna lista | ✅ **FATTO** |
| **#127** | due codici disallineati + quattro decisioni registrate + `X1b` | io | `X1b` a zero; nessun `DIV-COMM`/`DIV-LEGAL` fuori dalle migrazioni storiche | da fare |
| **#123** | leggere `organigramma-bis.html` ed eseguirne le situazioni | io | `verifica_incrociata.py` con universi ≠ zero | da fare |
| **#121** | la guardia lab smette di rifiutare letture legittime | io | `hook.sh selftest` verde coi 6 casi nuovi come regressione | da fare |
| **#128** | registro sessioni completo, niente cancellazione automatica | io | `hook.sh selftest` verde + `hook.sh storico` che elenca le sessioni | da fare |
| **#122** | `HS-MGMT` doppio e `HS-PROD` ri-tipizzata | io | 0 unità attive di tipo `TEAM`; nessun codice condiviso fra assi | 🟡 **META'** — Heuresys fatto (mig `000265`-`000268`); le 23 squadre di RTL → **WAIT-INPUT**, decisione di Enzo |
| **#125** | 22 pagine orfane + 52 etichette senza traduzione | io | nessuna pagina senza voce né motivazione; parità i18n verde | da fare |
| **#126** | predizioni e mentore visibili all'interessato | io | login reale che apre il proprio portale e vede le proprie predizioni | da fare |
| **#117** | completezza del portale derivata meccanicamente | io | strumento ri-eseguibile, zero tabelle «scoperte», conteggio che cambia | da fare |

**Ordine scelto per il gruppo (3)**: `#119` segue `#116` perché è lo stesso difetto (liste
di ruoli cablate) sugli stessi file · `#127`+`#123` insieme perché la seconda assorbe la
prima per dichiarazione propria · `#121`+`#128` insieme perché sono lo stesso file
(`scripts/hooks/session_mode.py`) · `#117` per ultima perché incorpora le decisioni di `#126`.

## Simulazione a 5 domande — compilata prima di eseguire, una sezione per consegna

### #116 — atterraggio sul cruscotto cieco

- **Precondizioni** — verificate: `apps/web/src/lib/landing.ts` esiste (25 righe,
  `SELF_SERVICE_ROLES` + `landingForRoles`); ha **5 chiamanti**, tutti in
  `apps/web/src/app/login/page.tsx` (righe 150, 168, 199, 209, 353) attraverso
  `redirectFor(res.roles)` alla riga 97-100. Il file `apps/api/src/lib/landing.ts` citato
  dal referto D2 **non esiste** — confermata la ri-localizzazione già segnalata da `#119`.
- **Meccanismo** — la risposta di login (`LoginResponseSchema`,
  `packages/shared/src/schemas/auth.ts:52-60`) porta `roles` ma **non** `permissions`.
  L'API ha già la mappa RBAC caricata in memoria all'avvio e la espone su
  `/v1/me/permissions` (`apps/web/src/lib/api/auth.ts:79-97`). Il meccanismo è quindi
  **aggiungere `permissions` alla risposta di login** dalla cache già caricata, e far
  derivare l'atterraggio da `dashboard:view` invece che dall'insieme dei ruoli.
- **Propagazione** — schema condiviso → rotta API → 5 chiamanti nel login → test.
- **Chi** — io, per intero.
- **Guardia** — il test deve **fallire** se qualcuno reintroduce l'insieme cablato: si
  verifica sui 13 ruoli reali letti dal database, non su una lista scritta nel test
  (memoria: no-hardcoded-test-data).

*(le sezioni delle altre consegne si compilano al momento di eseguirle)*

## Registro delle scoperte fuori ciclo (R24 §5 — presentate una volta sola, non bloccano)

- La CI risulta rossa e 5 commit locali non sono pushati (dal boot di sessione).
- `handoff_lint`: 1 WARN · staleness: `RBAC-map` live 947 non presente in `SOT_STATE §0`.
