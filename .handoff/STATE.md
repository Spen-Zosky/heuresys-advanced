# STATE — vista rapida

*Ultimo aggiornamento: S1096 (2026-09-12, terza corsa). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief

Mandato di Enzo: P1→P3, poi i debiti aperti e i due gated, in autonomia col solo guardiano della
capienza. Registro in `.programmi/S1096-mandato-p1-p3-debiti-gated.md`: **sei voci su undici**.
`#149` F4 sulle quattro consegne rimaste (una PARZIALE); tredicesimo perimetro dell'agente
(`skill-categories`, mig `000407`); il buco del cancello di esposizione chiuso (le migrazioni che
popolano ora si vedono); **D-90 e D-91 risolti** — il registro debiti è a zero. `#205` F2 è stata
**percorsa davvero** e ha trovato due difetti del motore di ricerca (corretti), ma produce zero
proposte per la consulenza: la fase «indirizzi» indovina i percorsi. `#198` T9b resta ferma di
conseguenza; `#41` è superato dai fatti. Il cancello locale è stato **fermato apposta**: la
verifica lunga si legge dal linux-pc dopo la propagazione.

## Top priorities

1. **`#250` — Enzo non entra in produzione dal browser** (WAIT-INPUT): serve la tua conferma a
   cancellare il tuo fattore TOTP; al login successivo ti ri-iscrivi col tuo authenticator.
2. **La ricerca deve saper cercare** (`#205` F2 → `#198` T9b): la fase «indirizzi» del gateway
   indovina gli URL (metà sono 404) e per un settore non bancario non trova pagine utili. Serve
   uno strumento di ricerca o una sitemap nel gateway, **oppure** le tre corse di proposte-fonte
   (`7550b570`, `1c830468`, `1fad2338`, sul gemello) presentate a te. E `claude login` su gemello
   e VM: la sessione OAuth è scaduta su entrambi (misurato).
3. **`#159` F2** — il componente del ponte in `ux-design-shared` (~250k): repository libero e
   capienza piena.

▸ Poi: `#214` F6 (prossimo `job-roles`, con la motivazione già scritta) · `#149` F4 (continuativo,
oggi tutto verde) · `#41` (GATED: il top-up è superato, serve un `--update` intero) · Bundle Cowork fase 4
(B13 dossier persona, B15 censimento API↔pagine, B16 scheda cliente: da progettare).

## Open questions

- ⏳ **SOSPESA (Enzo)**: dove custodire la chiave del collaudo; rotazione di `MFA_ENCRYPTION_KEY`.
- **`sys_valutazione_condivisione_eccezioni` ha 568 righe e nessuna API la espone**: oggi in
  deroga come attestazione di governo. Se HR deve vederle dal prodotto, serve un endpoint.
- **Il pattern da catturare**: la headline delle migrazioni in `SOT_STATE.md` si ri-deriva a mano
  a ogni chiusura. Uno script o un hook? Non implementato di iniziativa.
- **Igiene fuori repo**: `C:\Git\` porta ~29 log di sessioni CLI e
  `.handoff/session-journal.recovered.ndjson` del 6 settembre è già consolidato. Mai cancellati
  senza il tuo sì.

## Verification

```bash
python docs/kb/tools/session_start.py
python docs/kb/tools/verify_gate.py check                 # atteso: da verificare (fermato apposta: si legge dal linux-pc)
python docs/kb/tools/check_exposure.py --selftest         # 13/13 · poi senza flag: 140/133/7/0
python docs/kb/tools/build_index.py --selftest            # 5/5
bash scripts/posso-uscire.sh --selftest                   # 7/7
python docs/kb/tools/check_concetti_agente.py             # 13 aperti · 44 in coda
bash scripts/verifica-deploy.sh                           # DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO
```
