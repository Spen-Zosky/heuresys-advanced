# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-06 (S1045 — la catena di migrazioni smette di disfare il lavoro fatto; cinque debiti su cinque chiusi; quattro voci tornano visibili nel menu).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1045)

**Il deploy si portava dietro effetti che nessuno aveva chiesto, e la causa era un ciclo con due
estremi**: una migrazione distribuiva i requisiti di competenza a *ogni* posizione del ruolo,
comprese quelle spente; un'altra li archiviava e li staccava; al giro dopo si ricominciava — i
timestamp dell'archivio lo confessano. Corretto a monte: una posizione spenta non ha bisogno di un
catalogo di competenze per essere ricoperta.

**La richiesta ovvia sarebbe stata la trappola.** «Non rieseguire le migrazioni già fatte» descrive
un filtro che avrebbe spento la maggior parte delle verifiche della catena — che in larga misura non
trasforma il database, lo **controlla**. Misurato prima di scrivere una riga, e scartato: ora una
migrazione si dichiara una-tantum e si salta solo se anche l'impronta corrisponde; senza
dichiarazione nulla cambia.

**Quattro voci erano invisibili al menu** — fra cui la priorità numero uno di ieri — perché scritte
fuori dalla sezione che il generatore legge. Rimesse a posto, con un controllo bloccante perché non
si ripeta.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, pending, errori aperti. Doppia
verifica e review adversarial; le decisioni tecniche sono di Claude.

## Stato dei piani

- **#140 + #141**: **CHIUSI** con la prova che ciascuna voce esigeva. Piano e reperti in
  `docs/superpowers/specs/2026-08-06-catena-migrazioni-stabile-S1045.md`.
- **Debiti**: da 5 aperti a **1** (`D-56`, che aspetta solo una decisione d'ambiente).
  Piano in `docs/superpowers/specs/2026-08-05-debiti-aperti-S1045.md`.
- **Consegne del lab**: restano `#117` `#121` `#123` `#125` `#126` `#127` `#128`; `#124` a metà;
  `#144` aperta, `#145` chiusa dal lavoro su `#140`.

## ⚠ Top priorities (next session)

1. **#125 — 22 pagine autenticate irraggiungibili dal menu + 52 etichette senza traduzione**.
   È la superficie che un cliente vede per prima. ~2-3h · elenchi in
   `<lab>/artefatti/pagine-orfane.txt`.
2. **#127 + #123** — stabilizzazione post-ricostruzione e lettura di `organigramma-bis.html`:
   vanno insieme perché la seconda assorbe la prima per dichiarazione propria. ~1 sessione.
3. **#124 residuo** — separare identità professionale e privata chiude quasi tutta la matrice
   senza meccanismi nuovi. ~1 sessione.

## Open questions (autorità *cosa* = Enzo)

- **claude-mem riacceso e ATTIVO** (2026-08-06, richiesta di Enzo): boot pulito, aggancio sulle
  letture asincrono e incapace di bloccare; la riserva «potrebbe essere inerte» è **caduta**, i suoi
  strumenti si sono presentati. Spegnimento: `[Scripts]/disattiva-claude-mem.sh`.
- **Le epiche `#142` cruscotti focalizzati e `#143` squadra=progetto** sono direzioni dichiarate,
  non pianificate: quando entrano, e in che ordine rispetto a `#99` (domini)?
- **Due responsabili di direzione senza posizione di comando** (`alice.costa`, `pietro.gallo`):
  reggono un'unità da una posizione tecnica — crearle è lavoro di struttura.
- **Due cataloghi tacciono** (requisiti formativi e indicatori): riempirli è contenuto di prodotto.
- **Quattro OKR nominano un reparto inesistente**, fra cui `Supply Chain` in una banca (tocca I21).
- **Lacuna di simmetria nell'allowlist di `TENANT_ADMIN`**: esiste un marcatore per *estendere*
  l'elenco, nessuno per *revocare*. Serve prima che `#131` tocchi i permessi.
- WAIT-INPUT: **#8** Outlook · **#16** SuccessFactors · **#52** SSO IdP · **#85** `AGENTS.md` · **#86** `claude login`.

## Verification (next session)

```bash
python docs/kb/tools/session_start.py              # menu + salute + sentinelle in un round
MIGRATE_DRY_RUN=1 bash db/scripts/migrate.sh       # atteso: "salterebbe 1" (000273 una-tantum)
python docs/kb/tools/db_health.py                  # atteso: "tutto nei limiti"
git log --oneline origin/main..HEAD                # atteso: vuoto (tutto pushato in S1045)
```
