# 256 — Il cancello sull'isolamento fra clienti copre solo le rotte sensibili di `orgGate`: misurare la superficie scoperta

> **item**: #256 · **priorità**: P3 · **stima**: ~mezza sessione (indagine)
> **stato**: NON AVVIATO
> **nasce-da**: mandato S1101 A3, **corretto dalla misura**. Il censimento Cowork del 2026-09-14 dava M5 («cancello meccanico sull'isolamento fra clienti») senza riscontro; nel register non c'è, **nel codice sì**.

## Il fatto misurato in S1101 (2026-09-14)

- **M5 è fatta**: B23 del bundle del 9 settembre, commit `6522c132` (2026-09-10, S1095) — `tenantGate` in `apps/api/src/lib/scope/gate.ts` **impedisce l'avvio** a una rotta sensibile senza dichiarazione (`TENANT_GATE_MISSING`), provata a esiti opposti; 40 moduli `"service"`, 1 `"platform"` (`assessment-methods`).
- **B1 è fatta con lei**: `sys.v_tenant_boundary_violations_full` (mig `000386`), sentinella sui 352 punti del dato vivo.
- **Il confine dichiarato da B23** (`gate.ts:64`): il cancello copre la **stessa popolazione di `orgGate`** — rotte read non-self su risorsa sensibile — non tutta la superficie. Estendere oltre è «lavoro futuro, non dato per fatto».

## Cosa fa questa voce

Non costruisce M5. **Misura** quante rotte che filtrano per `tenant_id` a monte stanno **fuori** dalla popolazione di `orgGate`, e decide — con il numero davanti — se estendere il cancello o dichiarare il confine sufficiente. È un'indagine con esito, non un rifacimento.

## Fasi

- [ ] **F1 — La misura** — rotte totali dell'API (atlante fresco) · rotte nella popolazione di `orgGate`/`tenantGate` · rotte fuori popolazione il cui `repository.ts` filtra per tenant · rotte fuori popolazione senza filtro (se ce ne sono, è un allarme, non un'indagine). Comando scritto accanto a ogni numero. **fatto =** i quattro numeri sono nella cronaca con i comandi.
- [ ] **F2 — La decisione** — estendere il cancello alla popolazione scoperta, oppure dichiarare il confine sufficiente con la ragione (es. «le rotte fuori sono cataloghi di piattaforma senza `tenant_id`»). Se si estende, nasce una voce nuova con stima; se no, questa si chiude. **fatto =** la decisione è scritta con i numeri di F1.

## Cronaca
