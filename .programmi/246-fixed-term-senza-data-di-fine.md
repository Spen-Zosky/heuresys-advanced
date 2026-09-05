# 246 — I venticinque contratti a tempo determinato senza data di fine

> **item**: #246 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: NON AVVIATO
> **nasce-da**: la bonifica di S1087 sui contratti scaduti (mig `000371`). Misurando il parco per
> applicare il rinnovo ricorrente è emerso un secondo fenomeno, **fuori dal punto non verde** che
> quella voce doveva chiudere, e quindi **riportato invece che eseguito**.

## Il fatto, misurato il 2026-09-05 in produzione

```
tipo         senza data di fine   già scaduti   in scadenza entro l'anno
permanent            108               0                  0
fixed_term            25               1                 26
```

Un contratto **a tempo determinato senza scadenza** è una contraddizione nei termini. Ed è la
contraddizione **speculare** a quella che la `000311` ha già corretto il 2026-08-14: due
`permanent` **con** una data di fine, che quella migrazione descrisse come «una contraddizione,
non una scadenza» e sanò togliendo la data.

Qui il verso è opposto: manca la data dove il tipo la pretende.

## Perché nessuno se n'era accorto

**Nessuna sentinella li vede, e non per svista.**
`sys.v_incarico_attivo_senza_contratto` cerca chi non ha **più** un contratto in vigore; e un
contratto senza data di fine è in vigore **per sempre**. Per costruzione, questi 25 non possono
comparire in quella vista — né in nessun'altra delle 31 sentinelle attive.

Restano invisibili finché qualcuno non li misura di proposito, che è esattamente quello che è
successo: sono emersi da una query fatta per **un altro** motivo.

## Le due letture possibili, e perché la scelta non è mia

1. **Sono a tempo indeterminato col tipo sbagliato.** Allora si normalizzano a `permanent`, con
   la stessa dottrina della `000311`, e il caso si chiude.
2. **Sono davvero a termine e manca la data.** Allora la data va ricostruita — e da dove, è una
   domanda a cui il database non risponde: non si inventa una scadenza contrattuale.

La differenza fra le due non è misurabile dai dati: **entrambe** producono esattamente le righe
che si vedono. Serve sapere cosa sono quei rapporti, e questo lo sa Enzo, non una query.

## Le fasi

- [ ] **F1 — Misurare chi sono, non solo quanti** — chi sono le 25 persone, che livello CCNL
      hanno, da quando lavorano, se hanno buste paga recenti. È il materiale che rende
      rispondibile la domanda qui sopra, e nessuna delle due letture si può scegliere senza.
- [ ] **F2 — La correzione, decisa la lettura** — emendando **il file che crea** l'oggetto dove
      serve (ADR-0035: la catena si ri-applica per intero, una `UPDATE` a valle viene disfatta al
      giro dopo), con giornale di rollback e post-condizione che protegge anche ciò che **non**
      doveva cambiare.
- [ ] **F3 — La sentinella che rende impossibile il ritorno** — `fixed_term` senza
      `end_date` deve essere una vista a zero righe, raccolta da `db_health`.
      **Provata ROSSA** iniettando un caso e disfacendolo, come la `000373` ha fatto sulle sue
      quattro porte: una sentinella mai vista rossa non è una prova.

## Da NON fare

Normalizzare i 25 a `permanent` **prima** che la lettura sia scelta: sarebbe scrivere una
decisione di business dentro una migrazione, travestita da bonifica tecnica. È la stessa
distinzione che la `000371` ha rispettato riusando il criterio della `000311` invece di
inventarne uno nuovo.

## Chiuso quando

I 25 hanno un tipo coerente con la loro data, e una sentinella a zero — provata rossa — lo
mantiene nel tempo.
