# S1097 — mandato «tutti da P1 a P3, #198, #41, hold e fuori registro, in autonomia»

*Enzo, 2026-09-12: «esegui tutti da P1 a P3, #198, #41, hold a fuori registro. Procedi in
autonomia e automaticamente prendendo decisioni per mio conto, nell'ordine che ritieni più
appropriato. l'unico guardiano che comanda è quello della capienza.»*

> **stato**: IN CORSO
> **registro di sessione** — cronaca di ciò che si fa, non il programma di una voce: non
> dichiara `item` di proposito (D-92). Le fasi che restano aperte a fine sessione vivono già nel
> piano della loro voce: questo file le nomina, non le possiede.

**Confine di sessione dichiarato all'inizio (R24 §4).** Il mandato porta 5 ACTIVE + 2 GATED +
9 HOLD + 4 fuori registro = **20 voci**. Stima totale ~950k contro una capienza utile misurata di
~600k (residuo 597k alla soglia del 75%, meno ~100k di chiusura → ~500k). **Non sono tutte
completabili qui.** Il taglio lo fa il solo criterio nominato: il guardiano. Ogni voce si chiude
**a fase intera**, mai a metà.

**Fuori dal mandato per natura**: `#250` (WAIT-INPUT — la DELETE del fattore TOTP di Enzo resta
sua: è un dato suo, e il register lo dichiara; Enzo non l'ha nominata) · la open-Q **SOSPESA da
Enzo** (custodia della chiave / rotazione `MFA_ENCRYPTION_KEY`: una sospensione esplicita non si
scavalca con una delega generica) · l'igiene di `C:\Git\` (**cancellazione**: divieto assoluto senza
il suo sì esplicito).

**Misura di apertura** (`guardiano.py`, 2026-09-12 20:25): contesto **15.3%** · finestra 5h
**5.0%** · verdetto testuale: `✓ si continua — contesto: mancano 596,853 token · 5h: mancano 75.0 punti`.

**Reperto d'apertura che cambia il confine**: il boot dava viva la sessione
`ux-design-shared-1e918fae` (pid 16400). Misurato: `Get-Process 16400` → **`PowerToys.AlwaysOnTop`,
avviato 2026-09-12 08:52**; il registro è del 2026-09-07. Il pid è stato riusato dopo un riavvio:
**quella sessione è morta**, il repository `ux-design-shared` è **libero** e `#159` F2 rientra nel
confine (era fuori in S1096 per questa sola ragione).

---

## Ordine deciso, e perché

Prima le voci piccole e misurabili che tengono verdi i cancelli (igiene, `#214`, `#149`, `#79`);
poi i fuori-registro eseguibili (piccoli, documentali o un endpoint); poi i HOLD, che sono per
lo più **decisioni** da scrivere e tre lavori veri; poi la catena che sblocca il GATED più
grosso (`#205` F2 → F3 → `#198` T9b); poi `#159` F2 (grosso, standalone, repo ora libero);
`#41` in coda perché è una misura e una decisione, non un lavoro.

| # | voce | perché qui | budget |
|---|---|---|---|
| 1 | igiene: derivati 2/3 superati | il boot legge da lì | ~5k |
| 2 | **`#214`** F6 — quattordicesimo perimetro | procedura consolidata; ⚠ `candidate-applications` è comparso in testa alla coda «senza dato di persona»: va misurato PRIMA, è la stessa forma del difetto `engagement` | ~50k |
| 3 | **`#149`** F4 — consegne | `check_verifica_consegne.py` + inbox del lab: se nulla è arrivato, la fase resta aperta per costruzione | ~5k |
| 4 | **`#79`** F3 — cancello di esposizione | si ri-esegue dopo ogni lavoro che popola tabelle (2, 6, 9) | ~5k |
| 5 | fuori registro — headline migrazioni auto-derivata alla chiusura | pattern ripetuto a ogni handoff | ~20k |
| 6 | fuori registro — endpoint di lettura per `sys_valutazione_condivisione_eccezioni` (568 righe senza API) | cancello #79: un dato che nessuna API espone non è nel prodotto | ~60k |
| 7 | HOLD `#240` — i due worktree gov: misura e decisione | ~10k |
| 8 | HOLD `#233` — `lab_inbox --ingest` fonde invece di duplicare | difetto a monte, dormiente ma noto | ~30k |
| 9 | HOLD `#232` — le 29 classificazioni in `sys_compensation_bands`: colonna di specie | modellazione decisa qui; ADR-0035 (emendare il file che crea) | ~50k |
| 10 | HOLD `#76` — la sessione preliminare di verifica del piano zero-pendenze | decisione di Enzo: prima la verifica; qui si fa la verifica, non le ondate | ~80k |
| 11 | HOLD `#206` `#4` `#8` `#39` `#52` — decisioni scritte, non lavori | ognuno aspetta un input di business o un processo non ancora sperimentabile: si conferma HOLD con la ragione datata | ~10k |
| 12 | **`#205`** F2 — la fase «indirizzi» deve saper cercare (sitemap/ricerca nel gateway) + corsa su `positions` | la catena che sblocca #198 | ~150k |
| 13 | **`#205`** F3 — strato di forma | dipende da 12 | ~60k |
| 14 | **`#198`** T9b — modello riempito, costruzione gemello → produzione | il GATED che 12-13 sbloccano | ~120k |
| 15 | **`#159`** F2 — il componente in `ux-design-shared` | repo libero (misurato); grosso e standalone | ~250k |
| 16 | **`#41`** — misura del costo di `--update` intero e decisione | dipende dalla finestra 5h | ~20k |

## Registro deliverable

Stato: `[ ]` da fare · `[x]` FATTA con data ed evidenza · `NON FATTA (ragione)`.

- [ ] **F1 Igiene** — **fatto =** `build_derivati.py` verde, staleness check tutto OK
- [ ] **F2 `#214` F6** — **fatto =** `candidate-applications` misurato (classe corretta se necessario); riga in `agent-perimetri.json`, migrazione in produzione, sentinella a 0, `db_health` verde
- [ ] **F3 `#149` F4** — **fatto =** `check_verifica_consegne.py` verde e inbox misurata
- [ ] **F4 `#79` F3** — **fatto =** `check_exposure.py` exit 0 dopo i lavori che popolano
- [ ] **F5 headline migrazioni** — **fatto =** strumento che ri-deriva la headline in `SOT_STATE §0`, con autoprova, agganciato alla chiusura
- [ ] **F6 endpoint eccezioni di condivisione** — **fatto =** rotta `/v1/...` in sola lettura con scope HR, test di integrazione verde sul gemello, deroga tolta da `exposure_waivers.txt`, cancello verde
- [ ] **F7 `#240`** — **fatto =** contenuto dei due worktree misurato, decisione scritta nel register
- [ ] **F8 `#233`** — **fatto =** `--ingest` idempotente: due corse = un blocco; prova a esiti opposti
- [ ] **F9 `#232`** — **fatto =** colonna di specie nel file che crea + migrazione emendativa, prova generale verde, produzione
- [ ] **F10 `#76`** — **fatto =** verifica del piano scritta: cluster ancora validi / superati / già fatti, con numeri
- [ ] **F11 decisioni HOLD** — **fatto =** cinque righe nel register con ragione e data
- [ ] **F12 `#205` F2** — **fatto =** la fase «indirizzi» legge la sitemap/cerca; corsa su `positions` con proposte decise e applicate
- [ ] **F13 `#205` F3** — **fatto =** frase riconoscibile → zero riscontri nello strato di forma
- [ ] **F14 `#198` T9b** — **fatto =** azienda non bancaria costruita dal modello generato, prove 11/11 sul gemello poi in produzione
- [ ] **F15 `#159` F2** — **fatto =** componente pubblicato in `@heuresys/ui`, la console dev lo consuma, secondo consumatore montato
- [ ] **F16 `#41`** — **fatto =** costo misurato e decisione (esecuzione o WON'T-DO motivato)

## Simulazione a 5 domande (R24 §3) — per voce, prima di partire

Si scrive qui sotto **prima** di aprire ciascuna voce.

| voce | precondizioni · meccanismo · propagazione · chi · guardia | cosa la misura ha detto |
|---|---|---|

## Fuori da questo ciclo — presentate una volta sola (R24 §5)

