# 260 — Il runner della CI porta una chiave di collaudo che non usa: due chiavi per le stesse quattordici utenze

> **item**: #260 · **priorità**: P2 · **stima**: pochi minuti, ma l'atto è **sulla macchina**, non sul repo
> **stato**: CHIUSO
> **nasce-da**: S1108 (2026-09-25), durante D11-0 e fuori dal suo scope — indagando perché la CI fosse rossa da due giorni. Dettaglio in `.programmi/K-ruoli-direzione/esiti/D11.md` (sezione D11-0) e `esiti/REGISTRO_SCOPERTE.md`, riga 2026-09-24.

## Il fatto, misurato

Sul linux-pc convivono **due** chiavi di collaudo diverse — quelle da cui si derivano le password
delle quattordici utenze `@collaudo.invalid`:

| dove | quando | impronta sha256 (primi 16) |
|---|---|---|
| drop-in systemd del runner, `zz-collaudo-access.conf` | scritto il 2026-09-19 alle 04:42 | `a4191764e85bdde4` |
| `.secrets/collaudo-access.key` (gemello **e** PC Windows) | preesistente | `591962ed4af04342` |

**Il processo del runner usa la seconda**: il servizio non è mai stato riavviato dopo che il
drop-in è stato scritto, quindi quel file esiste sul disco e non è nell'ambiente del processo.

## Che cosa ha già causato

Le cinque identità provisionate nella finestra 04:44–05:04 di quel giorno — `sales@`,
`platform-operator@`, `dpo@`, `security-admin@`, `taxonomy-steward@collaudo.invalid` — sono nate
con la chiave **nuova**, mentre ogni corsa CI da allora derivava con la **vecchia**: login `401`,
sei file di test rossi per due giorni (corse `9ee6676d`, `ddff1607`, `8034b85e`).

La verifica che lo dimostra (read-only, nessun segreto stampato, solo `OK`/`DISALLINEATA`): con la
chiave `.secrets` risultano disallineate esattamente quelle cinque; con la chiave del drop-in, le
altre nove — cioè quelle che in CI **passano**.

## Perché non è più urgente

La causa di fondo era nello strumento, ed è stata corretta in S1108:
`db/scripts/provision-collaudo-access.ts` ora **verifica** con `argon2.verify` che ogni credenziale
corrente derivi dalla chiave in uso, e se non deriva la archivia nel giornale
`staging.collaudo_riallineo_undo` e la ruota. Vale in qualunque verso: se domani il runner venisse
riavviato e passasse alla chiave del drop-in, la corsa successiva riparerebbe da sé invece di
tornare rossa.

Il sintomo è quindi spento. Resta l'**ambiguità su un segreto**, che è la cosa da chiudere.

## Decisioni da prendere (sono due strade, non di più)

- **Riavviare il servizio del runner** — il drop-in diventa effettivo e la chiave buona è
  `a4191764`. La prima corsa CI dopo il riavvio riallineerà da sé le nove identità nate con
  l'altra chiave. Onora l'intenzione di chi ha scritto il drop-in; va fatto con nessuna corsa in volo.
- **Allineare il drop-in** a `.secrets/collaudo-access.key` — la chiave buona resta `591962ed` e
  non cambia niente per nessuno, perché è già quella in uso. È la meno invasiva.

Riguarda una macchina e un segreto, non il codice: la sceglie Enzo.

## Fasi

- [x] **F1 — La misura, rifatta** (2026-09-27) — ri-misurate le due impronte: ancora due (`a4191764` nel drop-in, `591962ed` nel repo). **Scoperta non prevista**: il servizio del runner risultava riavviato il 2026-09-26 21:03 (dopo la scrittura del drop-in del 19/9), quindi il PROCESSO in esecuzione derivava già da `a4191764` — non più da `591962ed` come misurato in S1108. Verificato leggendo `/proc/<pid>/environ` del processo reale.
- [x] **F2 — La decisione, e l'atto sulla macchina** (2026-09-27) — Enzo ha scelto: allineare il repo alla chiave ora viva (`a4191764`), non tornare indietro con un secondo riavvio. Eseguito con `/tmp/allinea-collaudo.sh` (script senza segreti nel testo, verifica l'impronta attesa prima di scrivere, backup del valore precedente in `.secrets/collaudo-access.key.bak-20260927-2`). **Incidente in corsa**: un primo tentativo via comando SSH inline da PowerShell si è rotto per virgolette annidate e ha lasciato il file a 0 byte per una manciata di secondi — corretto subito dal backup fatto in apertura, nessuna perdita: la lezione è usare uno script su file per operazioni con segreti da PowerShell, mai un one-liner con quote nidificate.
- [x] **F3 — La prova che non serve più riparare** (2026-09-27, run `36328679968`) — log dello step «Seed collaudo-access identities»: `credenziali RIALLINEATE ....... 0`, corsa verde.

## Chiuso quando

Una sola chiave di collaudo risulta in uso sul linux-pc, e l'impronta del drop-in coincide con
quella che il processo del runner deriva davvero. ✅ **VERO dal 2026-09-27**: drop-in, processo e
`.secrets/collaudo-access.key` derivano tutti e tre `a4191764e85bdde4`.

## Come si ri-misura

```bash
# impronta della chiave nel drop-in (mai il valore)
ssh linux-pc "grep -o 'COLLAUDO_ACCESS_KEY_B64=[A-Za-z0-9+/=\"]*' \
  /etc/systemd/system/actions.runner.*runner.service.d/zz-collaudo-access.conf \
  | sed 's/^COLLAUDO_ACCESS_KEY_B64=//; s/\"//g' | tr -d '\n' | base64 -d | sha256sum | cut -c1-16"

# impronta della chiave del repo
ssh linux-pc "sha256sum ~/heuresys-advanced/.secrets/collaudo-access.key | cut -c1-16"
```
