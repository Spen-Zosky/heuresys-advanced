# #260 — Il runner della CI porta una chiave di collaudo che non usa

**Aperta**: S1108, 2026-09-25 (scoperta durante D11-0, fuori dal suo scope).
**Stato**: ACTIVE · P2 · effort: pochi minuti, ma l'atto è **sulla macchina**, non sul repo.
**Origine**: `.programmi/K-ruoli-direzione/esiti/D11.md` (sezione D11-0) e
`.programmi/K-ruoli-direzione/esiti/REGISTRO_SCOPERTE.md`, riga 2026-09-24.

---

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

Verifica che lo dimostra (read-only, nessun segreto stampato, solo `OK`/`DISALLINEATA`): con la
chiave `.secrets` risultano disallineate esattamente quelle cinque; con la chiave del drop-in,
le altre nove — cioè quelle che in CI **passano**.

## Perché non è più urgente

La causa di fondo era nello strumento, ed è stata corretta in S1108:
`db/scripts/provision-collaudo-access.ts` ora **verifica** con `argon2.verify` che ogni credenziale
corrente derivi dalla chiave in uso, e se non deriva la archivia nel giornale
`staging.collaudo_riallineo_undo` e la ruota. Vale in qualunque verso: se domani il runner venisse
riavviato e passasse alla chiave del drop-in, la corsa successiva riparerebbe da sé invece di
tornare rossa.

Quindi il sintomo è spento. Resta l'**ambiguità su un segreto**, che è la cosa da chiudere.

## Cosa resta da decidere, e sono due sole strade

1. **Riavviare il servizio del runner** — il drop-in diventa effettivo e la chiave buona è
   `a4191764`. La prima corsa CI dopo il riavvio riallineerà da sé le nove identità nate con
   l'altra chiave.
2. **Allineare il drop-in** a `.secrets/collaudo-access.key` — la chiave buona resta `591962ed`,
   e non cambia niente per nessuno (è già quella in uso).

La (2) è la meno invasiva e non tocca il runner mentre una corsa è in volo; la (1) è quella che
onora l'intenzione di chi ha scritto il drop-in. È una decisione di Enzo: riguarda una macchina e
un segreto, non il codice.

## Chiuso quando

Una sola chiave di collaudo risulta in uso sul linux-pc, e l'impronta del drop-in coincide con
quella che il processo del runner deriva davvero.

## Come si ri-misura

```bash
# impronta della chiave nel drop-in (mai il valore)
ssh linux-pc "grep -o 'COLLAUDO_ACCESS_KEY_B64=[A-Za-z0-9+/=\"]*' \
  /etc/systemd/system/actions.runner.*runner.service.d/zz-collaudo-access.conf \
  | sed 's/^COLLAUDO_ACCESS_KEY_B64=//; s/\"//g' | tr -d '\n' | base64 -d | sha256sum | cut -c1-16"

# impronta della chiave del repo
ssh linux-pc "sha256sum ~/heuresys-advanced/.secrets/collaudo-access.key | cut -c1-16"

# e la prova che conta: una corsa CI in cui il provisioning non riallinea nulla
#   atteso nel log: «di cui DISALLINEATE misurate .. 0»
```
