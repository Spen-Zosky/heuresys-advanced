# S1098 — mandato «finita #206, tutti da P1 a P3 in autonomia»

*Enzo, 2026-09-13: «quando hai finito questa corsa, esegui tutti da P1 a P3 in autonomia e
automaticamente prendendo decisioni per mio conto, nell'ordine che ritieni più appropriato.
l'unico guardiano che comanda è quello della capienza.»*

> **stato**: CHIUSO
> **chiuso**: 2026-09-13 — 5 voci fatte su 6; `#159` F2 non aperta per verdetto del guardiano (`--budget 250000 → NON CI STA`, residuo alla soglia 125.789 token). CHIUSO vuol dire «la sessione ha finito», non «il lavoro è finito»
> **registro di sessione** — cronaca di ciò che si fa, non il programma di una voce: non
> dichiara `item` di proposito (D-92). Le fasi che restano aperte vivono nel piano della loro
> voce; questo file le nomina, non le possiede.

**Misura all'apertura del mandato** (`guardiano.py`, dopo `#206` T1-T8): contesto **42.4%** ·
finestra 5h **18.0%** · verdetto testuale: `✓ si continua — contesto: mancano 325,707 token · 5h:
mancano 62.0 punti`.

**Confine di sessione dichiarato (R24 §4).** Le corsie P1-P3 del menu portano **6 voci ACTIVE**
(`#149` F4, `#76` F2, `#214` F6, `#159` F2, `#79` F3, `#205` F2). Capienza utile: ~325k alla soglia
meno ~80k di chiusura → **~245k**. `#159` F2 da sola è stimata ~250k (S1097): **non ci sta a fase
intera** insieme alle altre, e si dichiara fuori confine per prima. Ogni voce si chiude a fase
intera, mai a metà. Il taglio lo fa il solo guardiano.

**Fuori dal mandato per natura**: `#250` e `#240` (WAIT-INPUT: sono decisioni sue, il register lo
dichiara) · la open-Q SOSPESA da Enzo (chiave del collaudo) · l'igiene di `C:\Git\` (cancellazione).

---

## Ordine deciso, e perché

Prima ciò che è **misura e riporto** (piccolo, tiene verdi i cancelli): `#149` F4 e `#79` F3
(continuativi, si chiudono con la misura di oggi), poi `#76` F2 (riportare 59 verdetti nel piano
zero-pendenze: lavoro documentale, sblocca ogni ondata futura). Poi `#214` F6 (un perimetro dell'agente,
~1 pagina ciascuno). Poi `#205` F2 (la corsa della ricerca su `positions`: se produce, sblocca `#205`
F3, `#198` T9b e con essa `#206` T9). `#159` F2 per ultima, solo se il guardiano lo consente a fase intera.

| # | voce | fase | chi | fatto quando | stato |
|---|---|---|---|---|---|
| 1 | `#149` | F4 — la consegna ingerita oggi (P4) trattata come non verificata | io | l'analisi avversariale di `#206` è registrata come esito di F4 | ✅ FATTA (`10be43af`): marker P4 CONFERMATO→PARZIALE·S1098, presidio verde |
| 2 | `#79` | F3 — il lavoro che popola tabelle (P4) passa dal cancello | io | `check_exposure.py` → 0 lacune dopo `#206` | ✅ FATTA (`10be43af`): 0 lacune |
| 3 | `#76` | F2 — riportare i verdetti nel piano zero-pendenze | io | `zp_state.py piano` ri-conta; i 59 verdetti sono nel piano | ✅ FATTA (`10be43af`): 59/59, 157 aperti |
| 4 | `#214` | F6 — il prossimo perimetro neutro | io | una riga in `agent-perimetri.json` + `check_concetti_agente.py` verde | ✅ FATTA (`4c931319`): `activity-classifications`, mig 000411, 4 falsi neutri esclusi |
| 5 | `#205` | F2 — la corsa su `positions` con la fase «indirizzi» | io | `fonti` nell'esito della corsa, o la ragione misurata per cui non produce | ✅ FATTA (`af8f8f7e`): 4 corse, 2 difetti corretti, `mappe`+`indirizzi` nella corsa; 0 proposte per limite della fonte (ilo.org) — F2 resta aperta sulla fonte di settore, di Enzo |
| 6 | `#159` | F2 — il ponte in `ux-design-shared` | io | ⛔ fuori confine salvo budget: ~250k | ⛔ NON APERTA: guardiano `--budget 250000 → NON CI STA` (misurato dopo la voce 5) |
