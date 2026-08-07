# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-07 (S1047 — verificare invece di credere; poi due cicli sul substrato semantico e sul catalogo generico dell'agente).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1047 — seconda parte: substrato semantico e catalogo generico)

**Il substrato è sano, ma per dirlo sono serviti due difetti corretti**: un salto-per-hash
**cieco al modello** di embedding — al cambio modello avrebbe lasciato un corpus misto,
in silenzio — e i vettori mancanti, colmati. Ogni corpus è ora coperto per intero.

**Il catalogo dell'agente vede una frazione dei moduli.** La strada per allargarlo —
pochi strumenti generici che navigano il dominio — è stata progettata (`ADR-0033`),
**misurata** e messa in sicurezza, ma **non percorsa**: l'ADR resta `PROPOSED` perché
l'ultima decisione è di Enzo, non tecnica (`#156`).

**Due sbarramenti di sicurezza chiusi.** L'atlante ora conosce i **parametri** di ogni
route, letti da Zod a runtime invece che indovinati; e il gate, che classificava
lettura/scrittura dal **nome** dello strumento, avrebbe **auto-approvato una `DELETE`**
chiesta da uno strumento generico — ora guarda il metodo dell'operazione risolta e nega
ciò che non risolve.

**Il limite trovato vale più dei numeri verdi**: la ricerca sui metadati sa dire *dove
guardare*, **non** *quanto fa*. Le domande di aggregazione non hanno un concetto (`#157`).

Referto completo: `docs/superpowers/specs/2026-08-07-catalogo-generico-referto-di-programma.md`.

## Prima parte della sessione (S1047) — in sintesi

**Verificare invece di credere.** Le consegne del lab chiedevano un'analisi avversariale prima
dell'esecuzione: applicata a loro stesse, undici affermazioni portanti su tredici hanno retto.
La voce di sicurezza in cima al menu **era già risolta da dieci giorni** e nessuno l'aveva
ri-misurata — *riformattare una voce non è ri-misurarla*. Il triage delle voci eseguite non ha
trovato stati sbagliati ma ha scoperto **due difetti di prodotto**: «annulla» che non annullava, e
una versione di organigramma creata da una persona reale senza stili. Entrambi corretti alla radice.

Prove: `docs/superpowers/specs/2026-08-06-ritrattazione-consegne-lab-e-mfa-produzione.md`.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, errori aperti. Doppia verifica e
review adversarial; le decisioni tecniche sono di Claude.

## Regola su ogni lavoro che nasce dal lab (`#149`, `#150`)

Prima di eseguire una voce con `lab-id`: **rileggere il file di consegna e verificarne le
affermazioni portanti** — il registro conserva il blocco, non il file, e i file sono cambiati.
Correzioni già nelle note di `#131`, `#132`, `#139` (l'ultima contiene una decisione di sicurezza
che spetta a Enzo).

## Stato dei piani

- **Consegne del lab**: ritrattate; triage chiuso, con quattro voci dichiarate **non misurate**
  invece che «a posto». · **Sicurezza MFA**: nessun fattore di prova in produzione, nessun residuo
  dopo una corsa completa della suite. · **Debiti**: resta `D-56` (decisione d'ambiente).

## ⚠ Pendenza aperta (`#154`) — Enzo: «lo faremo in un'altra sessione»

**linux-pc serve ancora codice più vecchio del `main`.** GitHub Actions era in disservizio grave
(incidente 2026-08-06T15:22Z): il cancello CI di `vm-deploy` ha letto rosso e **ha bloccato il
deploy sul gemello, correttamente**. Il bypass non è stato usato, e il rinvio è una **decisione
esplicita di Enzo**, non una dimenticanza. **PROD (VM) è deployata e verde.**
Quando la CI torna verde: `bash scripts/vm-deploy.sh linuxpc`.

## La custodia della storia RTL: due anelli chiusi, il terzo è `#155`

Falliva **in silenzio da tre corse settimanali**. Due anelli chiusi (un difetto di prodotto sugli
stili dei grafi, un autocontrollo fragile che moriva su un errore di vincolo invece di dare un check
rosso — ecco perché l'allarme non diceva nulla di utile). **Il terzo è `#155`**, ed è il più serio:
dettaglio nel registro.

## ⚠ Top priorities (next session)

1. **`#155`** — i percorsi di carriera rimasti indietro dalla ricostruzione: **130 persone vedono un
   obiettivo di carriera che nessun percorso raggiunge**. ~1 sessione, lavoro di dominio.
   *È l'unica voce di questo elenco che una persona vera vede aprendo la propria pagina.*
2. **`#156`** — catalogo generico: serve **la tua scelta** su quale superficie aprire per prima,
   poi il resolver dall'atlante. Tutto il resto è pronto e provato.
3. **`#125`** — pagine autenticate irraggiungibili dal menu ed etichette senza traduzione: è la
   superficie che un cliente vede per prima. ~2-3h · `<lab>/artefatti/pagine-orfane.txt`.

*Subito dietro, se le prime tre cadono*: **`#131`** Tenant Builder P1 (rileggendo la consegna, ha
tre correzioni sostanziali) e **`#127`+`#123`** insieme, perché la seconda assorbe la prima.

## Open questions (autorità *cosa* = Enzo)

- **Dove vive il livello contrattuale delle posizioni?** Il triage non ha potuto verificare `#118` e
  `#120`: i codici che citano non stanno dove sembrava. **Non misurate**, non «a posto».
- **Quanti altri item sono invisibili al menu?** Il generatore legge un solo formato di blocco e
  nulla avvisa chi ne scrive un altro: serve un controllo bloccante.
- **`#142` cruscotti e `#143` squadra=progetto**: direzioni dichiarate, non pianificate — quando
  entrano, e in che ordine rispetto a `#99`?
- **Due responsabili di direzione senza posizione di comando** (`alice.costa`, `pietro.gallo`) ·
  **due cataloghi tacciono** (requisiti formativi e indicatori) · **quattro OKR nominano un reparto
  inesistente**, fra cui `Supply Chain` in una banca (tocca I21).
- **Allowlist di `TENANT_ADMIN` asimmetrica**: si può estendere, non revocare. Serve prima di `#131`.
- **`#156` — quale superficie aprire per prima all'agente?** Un modulo, in sola lettura. I criteri
  dell'ADR-0033 misurano la fattibilità, non scelgono cosa esporre: quella è una decisione di
  prodotto e di rischio.
  *(`#157` non è più una domanda: **deciso** il 2026-08-07 via `COWORK_INBOX` — le aggregazioni
  restano fuori dallo scopo, il calcolo lo fanno gli endpoint analitici che già esistono.)*
- WAIT-INPUT: **#8** Outlook · **#16** SuccessFactors · **#52** SSO IdP · **#85** `AGENTS.md` · **#86** `claude login`.

## Verification (next session)

```bash
python docs/kb/tools/session_start.py   # menu + salute + sentinelle in un round
bash scripts/close-log.sh report        # cosa ha fatto/saltato l'ultima chiusura
bash scripts/test/run-shell-tests.sh    # atteso: 115 ok, 0 failed
git log --oneline origin/main..HEAD     # atteso: vuoto se il push di S1047 è avvenuto
```
**E2E in locale**: la config avvia solo il frontend — l'API dev va accesa a parte (`cd apps/api &&
pnpm dev`, porta **3001**) o tutti i login falliscono in blocco senza dire perché.
