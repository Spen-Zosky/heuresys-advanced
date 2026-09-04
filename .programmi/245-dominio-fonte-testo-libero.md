# 245 — Il dominio di una fonte di ricerca è testo libero, e nessuno controlla che esista

> **item**: #245 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: FATTO (S1086, 2026-09-04)
> **nasce-da**: il difetto trovato chiudendo `#132` F7 (2026-09-04, S1086).

## Il fatto, misurato

La sola fonte approvata del sistema — `bancaditalia.it`, approvata da Enzo il 25 agosto —
portava:

```
research_source_domain = '64.19'
```

`64.19` è un **codice ATECO**, cioè un settore. Quella colonna vuole la **chiave di un dominio
ricercabile**, e il commento della migrazione `000333` lo dice: *«Il dominio ricercabile per cui
questa fonte vale; NULLO = vale per tutti»*.

La lettura filtra `WHERE research_source_domain IS NULL OR research_source_domain = $1` con
`$1 = 'business_processes'`. Quindi la riga **non è mai stata vista da nessuna corsa**, ogni
ricerca moriva con `RESEARCH_NO_APPROVED_SOURCES`, e **tre voci del menu** — `#132` F7,
`#198` T9b, `#205` — sono rimaste ferme dieci giorni con una diagnosi sbagliata
(«un input che solo Enzo può dare»).

## Perché è potuto entrare

Lo schema in ingresso accetta il dominio come testo libero:

```ts
dominio: z.string().min(1).max(64)
```

Nessun confronto con `chiaviDominio()`, che è l'elenco dei domini davvero dichiarati in codice.

⚠ **L'incoerenza è il cuore della voce**: l'**avvio** di una corsa un controllo ce l'ha —
un dominio sconosciuto dà `RESEARCH_DOMAIN_UNKNOWN` con l'elenco dei dichiarati — ma la
**registrazione di una fonte** no. Lo stesso concetto è validato in un punto e non nell'altro.

## Cosa è già fatto, e cosa no

✅ **La riga è corretta**, in produzione e sul gemello (`db/scripts/244-...sql`), col settore
conservato in `research_source_metadata.ateco` invece che perso.

✅ **Il buco è chiuso** — nella stessa sessione che l'ha aperto (vedi «L'esito» in fondo).
*Quando questa voce è nata, questa riga diceva «il buco è aperto», ed era la ragione per cui la
voce esisteva: correggere la riga senza chiudere il buco significa riaverlo.*

## Fasi

- [x] **F1 — La validazione** — FATTO — la chiave del dominio si confronta con `chiaviDominio()` nel
      punto che scrive (`repository.ts`, registrazione delle fonti) e/o nello schema Zod,
      restituendo 422 con l'elenco dei dichiarati, come già fa l'avvio corsa.
      **fatto =** una fonte con dominio inesistente viene respinta
- [x] **F2 — Il controllo sull'esistente** — FATTO — una riga già presente con un dominio ignoto deve
      essere **visibile**, non silenziosa: una sentinella o un controllo in `db_health`.
      **fatto =** il controllo esiste e si è visto rosso su un caso finto

## Le prove che devono poter fallire

Tutte e tre insieme, o si è solo spostato il problema:

- registrare una fonte con un dominio **inesistente** → **respinta**;
- registrarne una con un dominio **dichiarato** → **passa** (senza questa, F1 sarebbe verde
  anche in un mondo dove nessuna fonte si può più registrare);
- una riga già esistente con un dominio ignoto → **il controllo la vede**.

## Chiuso quando

Nessun dominio di fonte può essere scritto se non è dichiarato, e ciò che è già scritto e non
lo è viene segnalato invece di restare invisibile.


---

## L'esito (S1086, 2026-09-04)

**F1** — la guardia vive in `guardia-domande.ts`, insieme alle altre, e non annegata nel
servizio: così si può provare da sola. `esigiDominiDiFonteDichiarati(fonti, chiaviDominio())`
lancia `FonteConDominioIgnotoError` → 422 `RESEARCH_SOURCE_DOMAIN_UNKNOWN`, con **l'elenco dei
domini dichiarati dentro l'errore** — la stessa forma che l'avvio corsa usava già. L'incoerenza
fra i due punti è chiusa.

**F2** — il controllo sull'esistente è un test di integrazione contro il database vero: nessuna
riga di `sys_research_sources` può avere un dominio non dichiarato.

### Le prove, e quella che le rende credibili — 23/23 verdi

| prova | esito |
|---|---|
| dominio ignoto → respinto, con l'elenco dei dichiarati | ✅ |
| dominio **dichiarato** → passa | ✅ — senza questa, la guardia potrebbe respingere tutto ed essere lo stesso «verde» |
| `null` → passa (è il «vale per tutti» del commento di colonna) | ✅ |
| nel database nessuna fonte ha un dominio non dichiarato | ✅ |

**Sabotaggio dichiarato**, perché un controllo che non si è mai visto rosso non è un controllo:

```
stato sano   → exit 0
dominio forzato a 'SABOTAGGIO_245' → exit 1
  × nel database non c'e' nessuna fonte con un dominio non dichiarato
  AssertionError: fonti con dominio non dichiarato:
    [{"host":"bancaditalia.it","dominio":"SABOTAGGIO_245"}]
ripristinato → UPDATE 1 · file sporchi: 0
```

Il messaggio **nomina la riga colpevole**: è la differenza fra un controllo che dice «qualcosa
non va» e uno che dice cosa.

Eseguito sul gemello (da Windows la suite muore sul tunnel), e il repo del gemello è stato
rimesso a posto.
