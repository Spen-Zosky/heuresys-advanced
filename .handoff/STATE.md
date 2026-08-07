# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-07 (S1048 — la catena della custodia RTL: quattro rossi, uno dietro l'altro).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1048)

**Le persone hanno di nuovo un traguardo raggiungibile**: percorsi di carriera e obiettivi
erano rimasti indietro dalla ricostruzione dell'organigramma, ora nessuno punta più nel
vuoto. La mappa non è stata inventata — è la stessa che riparò i cataloghi dei requisiti.

**Un rosso ne nascondeva un altro, quattro volte di fila**: la batteria si ferma al primo,
quindi «un check rosso» non ha mai significato «un difetto». Chiusi in cascata obiettivi
irraggiungibili, obiettivi che non erano una crescita, successori incoerenti e mobilità
inventata sopra quella vera. Resta il quarto, che chiede una decisione (`#163`).

**La verifica dal vero ha pagato più dei test**: entrando come una persona reale, la pagina
personale leggeva un incarico chiuso nel 2020 invece di quello in corso — **140 persone su
163**, difetto vecchio che il dato mascherava e che nessun test vedeva.

**Una mia diagnosi era sbagliata e l'ha corretta una misura**: avevo scritto che il seed
della carriera non era ri-eseguibile. Lo era; inventava una mobilità sopra quella vera.

**Ogni scrittura è annullabile**: due migrazioni portano il ritorno versionato
(`storia36_155_rollback`, `storia36_160_rollback`), collaudato per impronta riga-per-riga —
e il collaudo ha trovato due difetti nel ritorno stesso, prima che toccassero i dati.

Referti: `docs/superpowers/specs/2026-08-07-percorsi-carriera-155.md`.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti, task incompleti, errori aperti. Doppia verifica e
review adversarial; le decisioni tecniche sono di Claude.

## Regola su ogni lavoro che nasce dal lab (`#149`, `#150`)

Prima di eseguire una voce con `lab-id`: **rileggere il file di consegna e verificarne le
affermazioni portanti** — il registro conserva il blocco, non il file, e i file sono cambiati.

## ⚠ Due trappole operative scoperte in S1048

- **`storia36.sh custodia --repair-missing` e `costruzione` NON sono comandi innocui**: rieseguono i
  seed. Oggi il seed della carriera è a delta zero alla seconda corsa, ma la prima **recupera** ciò
  che il mondo ha cambiato nel frattempo — in S1048 ha scritto 236 righe legittime.
- **Una batteria che si ferma al primo rosso nasconde tutti gli altri.** Vale come metodo, non come
  aneddoto: dopo ogni check riparato, ri-eseguire l'intera batteria prima di dichiarare chiuso.

## ⚠ Top priorities (next session)

1. **`#163`** — la storia di un'unità si ferma a un nome che non porta più, e il modello ammette
   **un solo riordino**: la ricostruzione del 2026 non è contemplata. Serve **la tua decisione** su
   cosa il prodotto considera «riorganizzazione». ~1h + la scelta. *È l'ultimo rosso della custodia.*
2. **`#156`** — catalogo generico: serve **la tua scelta** su quale superficie aprire per prima,
   poi il resolver dall'atlante. Tutto il resto è pronto e provato.
3. **`#125`** — pagine autenticate irraggiungibili dal menu ed etichette senza traduzione: è la
   superficie che un cliente vede per prima. ~2-3h.

*Subito dietro*: **`#131`** Tenant Builder P1 e **`#127`+`#123`** insieme, perché la seconda assorbe
la prima.

## Open questions (autorità *cosa* = Enzo)

- **`#163` — la ricostruzione dell'organigramma è un secondo riordino?** Se sì il controllo va esteso
  ad ammetterne più d'uno; se no, quei cambi non generano eventi di storia. Non è una scelta tecnica.
- **Dove vive il livello contrattuale delle posizioni?** `#118` e `#120` restano **non misurate**.
- **Quanti altri item sono invisibili al menu?** Il generatore legge un solo formato di blocco e
  nulla avvisa chi ne scrive un altro: serve un controllo bloccante.
- **`#142` cruscotti e `#143` squadra=progetto**: direzioni dichiarate, non pianificate — quando
  entrano, e in che ordine rispetto a `#99`?
- **Due responsabili di direzione senza posizione di comando** (`alice.costa`, `pietro.gallo`) ·
  **quattro OKR nominano un reparto inesistente**, fra cui `Supply Chain` in una banca (tocca I21).
- **Allowlist di `TENANT_ADMIN` asimmetrica**: si può estendere, non revocare. Serve prima di `#131`.
- **`#156` — quale superficie aprire per prima all'agente?** Un modulo, in sola lettura.
- WAIT-INPUT: **#8** Outlook · **#16** SuccessFactors · **#52** SSO IdP · **#85** `AGENTS.md` · **#86** `claude login`.

## Verification (next session)

```bash
python docs/kb/tools/session_start.py   # menu + salute + sentinelle in un round
bash scripts/close-log.sh report        # cosa ha fatto/saltato l'ultima chiusura
bash db/scripts/storia36.sh custodia    # atteso: solo C6c rosso (→ #163)
git log --oneline origin/main..HEAD     # atteso: vuoto
```
**E2E in locale**: la config avvia solo il frontend — l'API dev va accesa a parte (`cd apps/api &&
pnpm dev`, porta **3001**) o tutti i login falliscono in blocco senza dire perché.
**Login come una persona**: due passi, password + TOTP derivato (l'MFA è attiva in locale, non su PROD).
