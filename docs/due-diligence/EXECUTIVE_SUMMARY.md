# Executive Summary — Due Diligence heuresys-advanced — 2026-09-28 (rivalidata)

**Score globale: 66/100 — Verdetto: CONDITIONAL-GO**

(HEAD `5faa2bc2` · rivalidazione della DD del 17/6/2026 (61/100) — voce #255 · 16 pilastri, 5 analisti indipendenti · postura avversariale. Il 58/100 NO-GO dell'8 settembre, fuori repo, è citato in `REPORT.md` §11 come precedente, mai copiato)

## Razionale del verdetto

Tre mesi dopo, il profilo non è cambiato di natura ma si è approfondito: heuresys-advanced resta un **asset di ingegneria che continua a maturare** (direttrice tecnica 76,8% del peso disponibile, era 69%) attaccato a un **business che il mercato ha reso più difficile, non più facile, da costruire** (direttrice product/business 49,6%, era 48%). La rivalidazione indipendente ha **confermato e in parte migliorato** la sostanza tecnica — 66 sentinelle di integrità a zero (erano 7), i due finding gravi di giugno su debito tecnico risolti con evidenza in codice, security passata da Forte-basso a Forte-alto (T6 85, era 78), verifica live vera contro produzione con un'identità di servizio autenticata — e ha trovato **due difetti concreti nuovi** (un endpoint di metriche osservabile pubblicamente contro il proprio commento nel codice; un permesso RBAC del DPO respinto dal service). Sul lato business, zero clienti paganti e zero pricing restano invariati, e l'unico competitor diretto rilevante (365Talents) è stato acquisito da un attore con distribuzione europea nel banking (Docebo) — il wedge competitivo va ripensato, non solo atteso. Il bus factor resta 1. Per questo il verdetto resta **CONDITIONAL-GO**, con lo score che sale da 61 a 66: non un prodotto difettoso da riparare, ma una fondazione tecnica più solida a cui manca ancora, interamente, lo strato di go-to-market.

## Top 5 punti di forza

1. **Security ora Forte-alta** (T6 85/100, era 78): password di test derivate per-email, revoca cross-tenant bloccata, 0 finding Critical.
2. **Sei pilastri tecnici in banda Forte** (T1 78 / T2 78 / T3 76 / T5 79 / T8 79 / T9 82): il debito operativo di giugno (CI-SPOF, backup, rollback, osservabilità) è in gran parte chiuso con evidenza verificata dal vivo.
3. **BPM ora ha un runtime reale** (X1 68, era 60): motore di approvazione (state machine + SLA + 6 handler) usato su 12 richieste vere di RTL Bank — il gap più citato a giugno non c'è più.
4. **GDPR passato da zero a reale** (X2 71, era 66): export, erasure transazionale, retention nel codice, non solo nel design.
5. **Verifica live più credibile** (T9 82): sessione autenticata vera contro produzione, non solo suite di test via tunnel — coerente con l'architettura a singolo ambiente del progetto.

## Top 5 rischi (con severità e GA-blocker)

1. **Nessun business, mercato più difficile** — P2 41 / P3 43, entrambi Debole (pesi 9+11=20). High. GA-blocker commerciale invariato, aggravato dall'uscita di 365Talents dal mercato indipendente.
2. **Bus factor = 1** — X3 63, un finding Critical su bus factor (misurato oggi con `git shortlog`: 0 secondi sviluppatori). Da prezzare con retention + clausole.
3. **AI su abbonamento personale, ora anche un limite di business model** — P3/P4/T7: nessun metering per tenant, non solo un vincolo di licenza Anthropic. GA-blocker pre-commerciale.
4. **`/api/metrics` pubblicamente osservabile** — T8 F-T8-09 (MEDIUM, scoperta nuova): il rewrite Next.js aggira il controllo di loopback. GA-blocker condizionale (hardening pre-enterprise).
5. **Infra ancora single-node** — T4 63 (Adeguato, invariato): managed-DB/HA resta da fare, anche se backup e DR-drill sono ora verificati.

## GA-blocker (finding che bloccano il rilascio commerciale)

> **Nessun difetto tecnico CRITICAL aperto**, su nessuno dei 16 pilastri. I GA-blocker restano prevalentemente **condizionali**, e due di quelli di giugno (T3 debito tecnico, X1 BPM) non lo sono più:
- **Commerciale**: assenza totale di signup/pricing/billing/onboarding (invariato).
- **Licensing/costo AI**: abbonamento personale senza metering per tenant — ora anche un vincolo di unit economics, non solo di ToS.
- **Infra/SLA**: single-node OCI free-tier (invariato); CI ancora parzialmente su VM-PROD (6/12 workflow, era 7/8).
- **Hardening perimetrale**: `/api/metrics` pubblico (nuovo, Medio, basso costo di chiusura).
- **Compliance EU**: AI Act meno urgente (scadenza dic-2027), ma non formalizzato; un bug puntuale sul permesso DPO da correggere.

## Condizioni di remediation (sbloccano l'investimento — CONDITIONAL-GO)

| # | Condizione | Effort | Priorità |
|---|---|---|---|
| C1 | Chiudere `/api/metrics` pubblico (T8-09) e il bug del permesso DPO (X2) | S | **P0** (basso costo, alta visibilità per un audit esterno) |
| C2 | Migrare l'agent-gateway a una API key commerciale con metering per tenant, prima del primo cliente pagante | S-M | **P0** |
| C3 | De-personalizzare l'infra residua: managed-DB + app HA, ultimi 6 workflow CI fuori dalla VM-PROD | 4-7 ww | **P0** |
| C4 | Neutralizzare il key-person: hire 2° dev senior + CONTRIBUTING/ONBOARDING + founder-retention con clausole | continuo | **P0** |
| C5 | Costruire il layer commerciale: signup/provisioning multi-tenant + pricing/billing + onboarding | 5-8 ww | **P1** |
| C6 | Formalizzare la classificazione AI Act (scadenza dic-2027, non più urgente come a giugno) | 2-4 ww | **P1** |
| C7 | Ripensare il wedge competitivo dopo l'uscita di 365Talents dal mercato indipendente + validare la domanda con un pilota reale | — | **P1** |

**Effort totale residuo verso GA commerciale: ~19-34 person-week** (era 27-45 a giugno; il trimestre ha già consegnato una parte reale del percorso). Nessun rewrite — costruzione additiva su base sana.

## Tesi d'investimento (sintesi)

- **Come asset technical/acqui-hire**: più forte di giugno. Sei pilastri tecnici ora in banda Forte; il founder resta il moltiplicatore e il rischio.
- **Come seed-to-GA**: condizionato, con un rischio di mercato nuovo da prezzare (365Talents/Docebo) oltre a key-person e tempo-a-revenue invariati.
- **Red flag occulti**: nessuno strutturale. Le due scoperte nuove (metrics pubblico, permesso DPO) sono difetti puntuali, fixabili in giorni, trovati perché cercati — non nascosti né negati.

## Assunzioni aperte / domande al founder (da confermare prima del closing)

Invariate da giugno (financials/runway/funding-ask, pricing/ICP/target, titolarità IP del legacy, piano di hiring, timeline GA-commerciale e impegno full-time del founder), più due nuove emerse in questa rivalidazione: **riattivare o no l'enforcement MFA in produzione** (capacità tecnica pronta, decisione sospesa da luglio); **come ridefinire il wedge competitivo** ora che l'unico competitor diretto è stato acquisito da un attore con distribuzione bancaria europea. Dettaglio per pilastro nei singoli `workstreams/WS-*.md`.
