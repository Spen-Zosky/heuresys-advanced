# S1087 — piano di sessione (delega totale)

*Mandato di Enzo, 2026-09-05: «risolvi tutti i punti non verdi e poi affronta tutte le azioni di
P1 P2 P3 automaticamente e autonomamente prendendo le decisioni al posto mio».*

**Confine dichiarato all'inizio (R24 §4).** La somma delle stime del menu supera una sessione:
`#143` ~4-6 · `#54` ~5-7 · `#159` ~3-4 · `#50` ~2. Questa sessione **non le chiude tutte**.
Ordine di esecuzione: prima i non verdi (rendono cieco tutto il resto), poi le voci in ordine di
sbloccaggio e di costo crescente. Il taglio lo decide il guardiano (75% contesto / 80% finestra 5h).

**Regola di scope (memoria cardinale)**: ogni scoperta collaterale si **riporta**, non si esegue.
Le scoperte vanno nel registro in fondo a questo file, non in «cosa resta».

---

## Parte A — i punti non verdi del boot

| id | cosa | chi | fatto significa | stato |
|---|---|---|---|---|
| N1 | Tunnel `:5433` degradato — 78 s per una count su 2 righe, VM scarica (load 0.11) | io | una count torna in pochi secondi | **FATTO** — ricreato, 78 s → 3,2 s |
| N2 | Derivati 2/3 superati | io | `build_derivati.py` verde e registro aggiornato | **FATTO** |
| N3 | Pagine NON MISURABILE (TimeoutExpired) | io | il cancello misura e dichiara un esito | **FATTO** — era il tunnel; 77 pagine, ogni pagina ha una porta |
| N4 | Sentinella `v_incarico_attivo_senza_contratto` = 1 riga | io | sentinella a zero **e** un presidio che la tiene a zero da sola | **FATTO** — mig `000371`, sentinella 0, presidio agganciato all'avanzamento |
| N5 | Allineamento ecosistema Claude rotto (`align-claude-ecosystem.sh:39`) | io | lo script trova il bootstrap, o la riga sparisce con motivo | **FATTO** — sorgente in `~/.claude/scripts/`; allineamento VM+linux-pc exit 0 |
| N6 | Chiusura S1086: 2 passi non sereni (chiusura, propaga) | io | causa nominata; se è N5, si chiude con N5 | **FATTO** — era N5 |
| N7 | **Tre servizi systemd FAILED in produzione**, invisibili al boot (`--no-net`) | io | i tre tornano `Result=success` | **FATTO** — vedi sotto |
| N8 | **CI rossa** su `0d7475d8` (*Lint (all workspaces)*) che blocca il deploy | io | corsa verde su un commit successivo | ⏳ **serve il push** (unico passo non delegato) |

### N7 — i tre servizi, e i cinque guasti in fila

Scoperti misurando la VM, non dal boot: la dashboard li dichiarava `[? ] --no-net`.

| servizio | era | causa vera | ora |
|---|---|---|---|
| `storia36-avanzamento` | FAILED dal 2026-09-04 | cinque guasti annidati (sotto) | `Result=success`, custodia VERDE |
| `storia36-custodia` | FAILED dal 2026-08-31 | gli stessi | `Result=success`, custodia VERDE |
| `deploy-watch` | FAILED | CI rossa su `0d7475d8` — si rifiutava **correttamente** di deployare | `Result=success`; il deploy resta fermo per N8 |

I cinque guasti, ognuno nascosto dal precedente (regola di bonifica §6):
C4a (pavimento CCNL a chi non è un lavoratore) → C4h(i) (stessa classe) → C10a
(qui mancava il **dato**, non il criterio → mig `000372`) → C11b(ii) (pretendeva
candidati da una corsa `FAILED`) → C8a(ii) (**il check misurava l'orologio e il
seed la frontiera**: 26 giorni di divergenza) → e un sesto trovato dalla batteria
stessa, il selftest di C10a(ii) che sceglieva la riga da guastare a caso.

**Frontiera della storia RTL: 2026-09-04** — arrivata a ieri, come D-STORIA-B chiede.

### N4 — simulazione a 5 domande (R24 §3)

**Misura, prima.** Parco contratti RTL, misurato 2026-09-05 via tunnel:

| tipo | senza data di fine | già scaduti | scadono entro 1 anno | totale |
|---|---|---|---|---|
| `permanent` | 108 | 0 | 0 | 108 |
| `fixed_term` | 25 | **1** | **26** | 52 |

Scadenze dei `fixed_term`: 2026-09 **9** · 2026-10 **3** · 2026-11 **3** · 2026-12 **7** ·
2027-01 **3** · 2027-02 **2**.

**Il difetto non è la riga di oggi: è che ne arrivano altre 26 nei prossimi cinque mesi**, una
alla volta, perché l'avanzamento giornaliero della storia porta la finestra a ieri e i contratti
a termine scadono da soli. È la **terza** occorrenza dello stesso fenomeno (`000289`: 23 casi il
2026-08-06 · `000311`: 7 casi il 2026-08-14 · oggi: 1). Le prime due sono state fotografie.

- **Precondizioni** — `staging.storia36_floor_at(livello, data)` esiste (dichiarata dalla `000289`);
  `sys.sys_user_contracts` ha `user_contract_type` / `user_contract_end_date` /
  `user_contract_gross_annual_salary`; il giornale `staging.contratti_scaduti_undo` esiste (`000311`).
- **Meccanismo** — il perimetro di `13_avanzamento.sql` **esclude i contratti** (dichiarato:
  calendario, presenze/assenze, buste paga). Quindi non basta correggere: il rinnovo va reso
  **ricorrente** e agganciato all'avanzamento, con lo **stesso criterio della `000311`** — non una
  politica nuova.
- **Propagazione** — migrazione → `pnpm db:migrate:vm` (17 s sulla VM contro ~80 min da qui) +
  gemello; l'avanzamento gira di notte sulla VM, che è la sola macchina che lo dichiara.
- **Chi** — io, per intero.
- **Guardia** — scrive solo su chi soddisfa il criterio della vista **al momento dell'esecuzione**
  (mai ereditato); post-condizione che protegge anche ciò che **non** doveva cambiare (i 108
  `permanent` e i 25 `fixed_term` senza fine restano intatti); rollback nel giornale esistente.

---

## Parte B — le azioni del menu

| id | voce | costo dichiarato | stato |
|---|---|---|---|
| P1-1 | `#198` T9b — la costruzione vera in produzione | ~1 sessione | da fare |
| P1-2 | `#149` F4 — consegne del lab non verificate | continuativo | da fare |
| P1-3 | `#143` F3 — asse funzionale vivo | ~4-6 sessioni | **fuori confine dichiarato** |
| P2-1 | `#231` S7 — triage dei 10 falliti (= `#219` F5d) | continuativo | da fare |
| P2-2 | `#242` — piano esaurito, la voce va chiusa | ~1 sessione | da fare |
| P2-3 | `#219` F5 — la corsa che chiude la voce | ~1-2 sessioni | da fare |
| P2-4 | `#214` F6 — consumo della coda dei neutri | continuativo | da fare |
| P2-5 | `#159` F2 — il ponte | ~3-4 sessioni | **fuori confine dichiarato** |
| P2-6 | `#79` F3 — cancello di esposizione | continuo | da fare |
| P2-7 | `#54` F3 — recruiting/ATS, API | ~5-7 sessioni | **fuori confine dichiarato** |
| P3-1 | `#205` F1 — coda dei domini ricercabili | ~1 sessione | da fare |
| P3-2 | `#50` F3 — la vista del grafo delle competenze | ~2 sessioni | da fare |

---

## Registro delle scoperte — *fuori da questo ciclo* (R24 §5)

Si presentano **una volta sola**. Non entrano in «cosa resta», non bloccano la chiusura.

1. **25 contratti `fixed_term` senza data di fine** (misurato 2026-09-05). È la contraddizione
   **speculare** a quella che la `000311` ha corretto (due `permanent` *con* data di fine). Nessuna
   sentinella li vede, perché la vista cerca chi non ha più un contratto in vigore e uno senza fine
   è in vigore per sempre. Non li tocco: è una scrittura di massa su produzione fuori dal punto non
   verde che mi è stato chiesto di risolvere. Lo vuoi nel prossimo ciclo?
