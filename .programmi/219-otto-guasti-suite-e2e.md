# 219 — Gli otto guasti dietro i rossi della suite E2E integrale

> **item**: #219 · **priorità**: P2 · **stima**: ~1-2 sessioni
> **stato**: NON AVVIATO
> **fonti**: `#211` F4 (S1072, 2026-08-19) — il triage completo, con la firma misurata di
> ognuno, vive in `.programmi/211-suite-e2e-completa.md` §F4 e **non si ricopia qui**

## Perché esiste

`#211` ha dichiarato il criterio di verde della suite completa, e quel criterio dice che la
corsa entra in CI **quando i falliti sono zero**. Questa voce è il posto dove quei falliti sono
tracciati: senza, «rosso noto e accettato» scivola in «rosso ignorato», che è esattamente il
difetto per cui 35 rossi sono vissuti invisibili prima di `#211`.

## ⚠ Sono FIRME, non cause

Il triage di `#211` F4 ha raggruppato **12 casi in 8 firme d'errore misurate**. Due firme
diverse possono avere la stessa causa, e una firma può nasconderne due — è successo in `#211`
F3, dove il triage dichiarava «nessuna delle sei è un guasto del prodotto» e **su una si
sbagliava**, ed era l'unica vera. Perciò ogni fase qui sotto **comincia riproducendo il caso**,
non correggendolo.

## Fasi

- [ ] **F1 Le due firme che potrebbero non essere guasti** — budget ~30k
      **A** (MFA, 2 casi) e **E** (il test che riceve 400). Vanno per prime perché, se
      l'ipotesi regge, si chiudono senza toccare il prodotto — e tolgono **3 casi su 12**.
      · **A**: verificare se `MFA_ENFORCEMENT_ENABLED` è spento in produzione per decisione di
        Enzo (SOT_STATE lo dichiara). Se sì, i due casi provano un mondo diverso da quello
        configurato: vanno resi condizionali alla configurazione, non cancellati.
      · **E**: il caso manda un body **incompleto**, quindi la validazione dello schema scatta
        prima del controllo di permesso e il 400 arriva per la ragione sbagliata. Correzione:
        body **valido** + attesa 401/403, così il caso prova davvero ciò che dichiara.
- [ ] **F2 Le due firme con una causa sola e due sintomi** — budget ~40k
      **B** (spiegabilità per-feature, `/insights/skill-gap` e `/insights/succession-readiness`)
      e **C** (l'editor dell'organigramma non si apre, 2 casi). Quattro casi, probabilmente due
      cause: si riproduce una pagina per firma e si guarda la chiamata `/v1/*` che la alimenta.
- [ ] **F3 Le tre firme rimaste, una per una** — budget ~50k
      · **D** creazione/archiviazione di un'azienda (2 casi) · **F** `me-team-name` ripetuto 14
      volte, mentre nel database la squadra «CFO» è **una** — testid duplicato, violazione di
      strict mode · **G** 1 ciclo di valutazione esiste e la pagina ne mostra **zero**.
- [ ] **F4 L'accessibilità, che è l'unica del suo genere** — budget ~30k
      **H**: violazioni a11y **critiche** su `/admin/roles` in vista mobile. Non si raggruppa con
      le altre perché la classe di difetto è diversa e la correzione tocca il markup.
- [ ] **F5 La corsa che chiude la voce, e il passaggio in CI** — budget ~20k (in gran parte attesa)
      Una corsa integrale con **0 falliti**. Solo allora il criterio di `#211` consente di
      portare la suite in CI, e questa voce si chiude insieme a quel passaggio.

## Le prove che devono poter fallire

- **F1/A** — se i due casi MFA diventassero verdi *accendendo* l'enforcement, la correzione
  sarebbe sbagliata: proverebbero una configurazione che la produzione non ha (decisione di
  Enzo). Il verde deve arrivare **senza** cambiare la configurazione.
- **F1/E** — il caso corretto deve diventare **rosso** se si toglie il controllo di permesso
  dalla rotta. Se resta verde, sta ancora misurando la validazione dello schema.
- **F3/F** — il testid duplicato si dimostra contando gli elementi, non leggendo il codice: se
  dopo la correzione il locator ne trova ancora più di uno, la causa era un'altra.

## Chiuso quando

Una corsa integrale della suite E2E riporta **0 falliti**, e la suite entra in CI secondo il
criterio dichiarato in `#211` F4.
