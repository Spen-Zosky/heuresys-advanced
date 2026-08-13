# `rtl-banking-skills` — che cosa sono questi file, e quali si possono rilanciare

Sono seed **fuori dalla catena delle migrazioni**, scritti per portare il tenant RTL Bank
a uno stato coerente. Non entrano nella catena e non devono entrarci: **ADR-0035** dice che
la catena si riapplica per intero a ogni deploy, quindi un file che crea qualcosa una volta
sola lì dentro non ci sta.

Il problema che questo registro chiude (**#174**) non era che fallissero: era che
**fallivano senza dirlo**. Chi li rilanciava per «ricostruire» trovava
`sys_teams_pkey duplicate key` o `sys_upa_dates_ordered_check`, e non aveva modo di capire
se l'errore fosse suo. Ora i tre one-shot si fermano alla prima istruzione con un messaggio
che spiega perché.

## Lo stato, misurato il 2026-08-13

| file | stato | come è stato verificato |
|---|---|---|
| `seed_org_completion.sql` | ⚠ **one-shot, già applicato** | le due unità che crea, `DIR-TREAS` e `DIR-AUDIT`, esistono nel database. Rieseguirlo viola `sys_teams_pkey` per costruzione |
| `seed_key_roles_coverage.sql` | ⛔ **one-shot, SUPERATO** | l'effetto che dichiara — `alice.esposito` riattivata su `POS-00000396` (CRO) — **non c'è più**: zero assegnazioni attive su quella coppia. L'organigramma è stato ricostruito dopo (mig. `000244`-`000256`, poi #113 e #118) e ha sovrascritto queste assegnazioni |
| `seed_residual_user_coherence.sql` | ⚠ **one-shot, già applicato** | chiude con post-condizioni permanenti (sezione F): se quelle passano, l'effetto c'è. Rieseguire il file intero viola `sys_upa_dates_ordered_check` |
| gli altri cinque | ❔ **non verificati qui** | non sono stati eseguiti in questa sessione: provarli significa scriverli su un database di produzione, e non c'era ragione di farlo per chiudere #174. Che due su cinque passassero è una misura di S1051, non di oggi |

**«Superato» non è sinonimo di «già applicato»**, ed è la ragione per cui i primi due hanno
messaggi diversi. Il primo ha prodotto un effetto che è ancora lì: rieseguirlo è inutile. Il
secondo descrive uno stato che il lavoro successivo ha **deliberatamente cambiato**: se
riuscisse a girare, rimetterebbe indietro l'organigramma. Il suo divieto è quindi
incondizionato, non legato a una precondizione.

## Perché non sono stati resi idempotenti

Era l'alternativa che la voce lasciava aperta, ed è stata scartata con una ragione. Renderli
idempotenti vorrebbe dire riscrivere logica di popolamento che ha **già prodotto il suo
effetto**, per farla convivere con un dato che nel frattempo è cambiato per altre vie — cioè
mantenere due verità sullo stesso stato. Il dato di oggi è la verità; questi file sono il
racconto di come ci si è arrivati. Un reperto si dichiara, non si riscrive.

## Se stai ricostruendo il database da zero

`seed_org_completion.sql` va eseguito **prima** che `DIR-TREAS`/`DIR-AUDIT` esistano: la sua
guardia è condizionale apposta, e in quel caso lo lascia passare.
`seed_key_roles_coverage.sql` **no**: andrebbe prima riscritto contro l'organigramma di oggi.
