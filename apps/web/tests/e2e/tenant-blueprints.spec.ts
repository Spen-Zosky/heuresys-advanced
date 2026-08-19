/**
 * apps/web/tests/e2e/tenant-blueprints.spec.ts
 * #131 Tenant Builder P1, T6 — la cascata percorsa da una persona reale.
 *
 * Lo spec entra come `platformAdmin`, apre un fascicolo, compila la carta
 * d'identita', riceve la proposta del modello, la ancora, decide su un processo
 * con la motivazione e sottomette alla firma.
 *
 * Le mutazioni si verificano con un RE-FETCH — cioe' ricaricando la pagina e
 * rileggendo — non fidandosi di quello che la risposta ha detto. Una mutazione
 * che risponde 200 e non scrive e' esattamente il difetto che un test
 * ottimista non vede.
 *
 * Dati veri: nessuna fixture, nessun mock. L'ATECO e la fascia si scelgono dal
 * catalogo reale attraverso l'interfaccia, come farebbe una persona.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("platformAdmin") });

// Il codice cambia a ogni esecuzione: due corse dello stesso spec non devono
// inciampare nel vincolo di unicita' del codice del fascicolo.
const CODICE = `E2E-FASCICOLO-${Date.now()}`;

test.describe("fascicolo di configurazione", () => {
  test("dalla carta d'identita' ai processi, fino alla firma", async ({ page }) => {
    // Stessa ragione del caso della costruzione (S1068): questo percorso attraversa
    // sei schermate e su un dev server appena avviato la compilazione a freddo si
    // mangia i 30 secondi del caso. Era **flaky prima** di questa sessione, e un caso
    // instabile in cima al file rende instabile anche quello che gli sta sotto.
    test.setTimeout(120_000);
    await page.goto("/tenant-blueprints");
    await expect(page.getByTestId("tenant-blueprints-page")).toBeVisible();

    // --- crea il fascicolo (una trattativa: nessuna azienda) ---
    await page.getByTestId("tenant-blueprint-code").fill(CODICE);
    await page.getByTestId("tenant-blueprint-name").fill("Fascicolo di prova E2E");
    await page.getByTestId("tenant-blueprint-create").click();

    // Si ASPETTA che la mutazione sia conclusa prima di ricaricare. Il campo si
    // svuota nel `onSuccess`, quindi vuoto = la POST ha risposto. Senza questa
    // attesa il `reload()` interrompe la richiesta in volo: il fascicolo nasce
    // lo stesso — verificato sul database — ma dopo il ricaricamento, e la
    // pagina non lo mostra piu'. E' il difetto che ha fatto fallire questa
    // prova la prima volta, ed era della prova, non del prodotto.
    await expect(page.getByTestId("tenant-blueprint-code")).toHaveValue("");

    // Re-fetch: si ricarica e si cerca la riga, invece di credere alla risposta.
    await page.reload();
    const riga = page.getByTestId("tenant-blueprints-row").filter({ hasText: CODICE });
    await expect(riga).toHaveCount(1);
    await riga.getByTestId("tenant-blueprint-link").click();

    await expect(page.getByTestId("tenant-blueprint-detail")).toBeVisible();

    // --- passo 1: la carta d'identita' ---
    // L'ATECO si cerca, non si sceglie da una tendina di 3.257 voci.
    await page.getByTestId("identita-ateco-ricerca").fill("64.19");
    const ateco = page.getByTestId("identita-ateco");
    await expect(ateco).toBeVisible();
    // `selectOption` vuole una STRINGA per `label`, non un'espressione regolare
    // (fallisce con «expected string, got object»). Il valore e' un uuid che non
    // si puo' scrivere qui, quindi si legge dall'opzione: si sceglie per cio'
    // che l'utente vede, e si seleziona per cio' che il DOM porta.
    //
    // L'ancoraggio a INIZIO stringa non e' pignoleria: cercando "64.19" il
    // catalogo restituisce anche `46.64.19` (commercio all'ingrosso), che
    // contiene quella sequenza e viene prima in ordine. Selezionandolo, la
    // pagina rispondeva — correttamente — «nessuna famiglia copre questo
    // settore», e la prova falliva accusando il prodotto di un difetto che era
    // suo. Il codice si sceglie per intero, non per sottostringa.
    const atecoOpt = ateco.locator("option").filter({ hasText: /^64\.19 — / }).first();
    await expect(atecoOpt).toHaveCount(1);
    await ateco.selectOption((await atecoOpt.getAttribute("value"))!);

    const fascia = page.getByTestId("identita-fascia");
    const fasciaOpt = fascia.locator("option").filter({ hasText: /^M — / }).first();
    await expect(fasciaOpt).toHaveCount(1);
    await fascia.selectOption((await fasciaOpt.getAttribute("value"))!);
    await page.getByTestId("identita-vigilanza").selectOption("HIGH");
    await page.getByTestId("identita-paese").fill("IT");
    await page.getByTestId("identita-salva").click();
    await expect(page.getByTestId("identita-salvata")).toBeVisible();

    // --- passo 2: il modello proposto ---
    await page.reload();
    await expect(page.getByTestId("modello-proposto")).toBeVisible();
    await page.getByTestId("modello-ancora").click();

    await page.reload();
    await expect(page.getByTestId("modello-ancorato")).toBeVisible();

    // --- passo 3: i processi, con la decisione motivata ---
    const processi = page.getByTestId("processo-riga");
    await expect(processi.first()).toBeVisible();
    const quanti = await processi.count();
    expect(quanti).toBeGreaterThan(0);

    const primo = processi.first();
    // Il pulsante e' spento finche' la motivazione e' vuota: si verifica PRIMA
    // di scriverla, altrimenti non si sta provando niente.
    await expect(primo.getByTestId("processo-salva")).toBeDisabled();

    await primo.getByTestId("processo-inclusione").selectOption("OUT");
    await primo.getByTestId("processo-motivazione").fill("affidato a un fornitore esterno");
    await expect(primo.getByTestId("processo-salva")).toBeEnabled();
    await primo.getByTestId("processo-salva").click();

    await page.reload();
    // ⚠ Dopo un `reload()` la lista dei processi si ri-scarica: leggere il campo
    // dentro la riga con i 5 secondi di default cercava un elemento che non era
    // ancora nel DOM («element(s) not found»), ed era **la causa reale del flaky**
    // di questo caso — non il timeout del test, che alzato a 120s non l'ha risolto.
    // Prima si aspetta la RIGA, poi si legge il campo. S1068.
    const primoDopo = page.getByTestId("processo-riga").first();
    await expect(primoDopo).toBeVisible({ timeout: 30_000 });
    await expect(primoDopo.getByTestId("processo-motivazione")).toHaveValue(
      "affidato a un fornitore esterno",
    );

    // R1: togliere la decisione riporta al modello, e la riga lo DICE.
    await primoDopo.getByTestId("processo-togli").click();
    await page.reload();
    await expect(
      page.getByTestId("processo-riga").first().getByTestId("processo-dal-modello"),
    ).toBeVisible();

    // Rimettiamo una decisione: si sottomette un fascicolo deciso, non vuoto.
    const primoRi = page.getByTestId("processo-riga").first();
    await primoRi.getByTestId("processo-inclusione").selectOption("PARTIAL");
    await primoRi.getByTestId("processo-motivazione").fill("gestito in parte internamente");
    await primoRi.getByTestId("processo-salva").click();

    // --- la firma ---
    await page.reload();
    await page.getByTestId("fascicolo-sottometti").click();
    await expect(page.getByTestId("fascicolo-sottomesso")).toBeVisible();

    // Re-fetch: dopo la sottomissione la versione non e' piu' una bozza, quindi
    // il pulsante di sottomissione non c'e' proprio piu'.
    await page.reload();
    await expect(page.getByTestId("fascicolo-sottometti")).toHaveCount(0);
  });

  test("il confronto dichiara l'impatto non calcolabile invece di mostrare zero", async ({
    page,
  }) => {
    await page.goto("/tenant-blueprints");
    const riga = page.getByTestId("tenant-blueprints-row").filter({ hasText: CODICE });
    await expect(riga).toHaveCount(1);
    await riga.getByTestId("tenant-blueprint-link").click();
    await page.getByTestId("tenant-blueprint-diff-link").click();

    await expect(page.getByTestId("tenant-blueprint-diff")).toBeVisible();
    await expect(page.getByTestId("diff-modello")).toBeVisible();
    await expect(page.getByTestId("diff-decisioni")).toBeVisible();
    // La sezione che conta: uno zero qui si leggerebbe «nessuna conseguenza»,
    // che e' il contrario di quello che il sistema sa.
    await expect(page.getByTestId("diff-impatto-stato")).toBeVisible();
  });

  /**
   * #198 T7 — la pagina di costruzione, sul FASCICOLO REALE di RTL Bank.
   *
   * Non usa il fascicolo creato dal primo caso, e la ragione e' un difetto che ho
   * incontrato scrivendo questa prova: i due casi qui sopra **dipendono l'uno
   * dall'altro** (il secondo cerca il codice che crea il primo), quindi quando il
   * primo diventa instabile il secondo cade con un messaggio che accusa il prodotto.
   * Appoggiarsi allo stesso codice avrebbe portato dentro quell'accoppiamento.
   *
   * `RTL-BANK-CONFIG` v1 e' **APPROVED e mai applicata** (misurato), cioe' esattamente
   * il caso che conta: il piano E' calcolabile su un'azienda vera e la firma E'
   * possibile. Percio' qui si verifica il contrario del caso facile:
   *   - il piano mostra numeri REALI, con le due colonne distinte;
   *   - il pulsante e' **attivo**, perche' lo stato lo consente — e NON viene premuto:
   *     aprirebbe una richiesta di firma vera a delle persone. E' lo stesso limite che
   *     la prova live di T6 ha dichiarato per se'.
   */
  test("la costruzione mostra il piano vero del fascicolo di RTL, e la firma e' possibile senza essere data", async ({
    page,
  }) => {
    // La prima navigazione su una pagina NUOVA la fa compilare al dev server, e i 30
    // secondi di timeout del caso finiscono li' dentro: misurato, «Test timeout of
    // 30000ms exceeded» sul primo tentativo e verde al secondo. Non e' il prodotto a
    // essere lento — in `test:e2e:prod` il bundle e' gia' costruito. Alzare la pazienza
    // NON addomestica la prova: le proprieta' verificate restano identiche, e un caso
    // che passa solo al secondo tentativo insegna a non guardare i rossi.
    test.setTimeout(120_000);
    await page.goto("/tenant-blueprints");
    const riga = page.getByTestId("tenant-blueprints-row").filter({ hasText: "RTL-BANK-CONFIG" });
    await expect(riga).toHaveCount(1);
    await riga.getByTestId("tenant-blueprint-link").click();
    await expect(page.getByTestId("tenant-blueprint-detail")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("tenant-blueprint-build-link").click();

    await expect(page.getByTestId("tenant-blueprint-build")).toBeVisible({ timeout: 30_000 });

    // ⚠⚠ QUESTO CASO HA DUE ESITI LEGITTIMI, e li verifica ENTRAMBI. Non e' indecisione:
    //    e' l'unico modo di scrivere una prova che resti vera attraverso `#132`.
    //    · Fino a `#132` F3 il contenuto del modello viveva in un archetipo TypeScript, e
    //      il piano c'era sempre.
    //    · Da F3 a F6 il modello e' VUOTO per decisione (E29: «l'archetipo deve sparire e
    //      nascere dalla ricerca»), quindi la costruzione **si rifiuta** — ed e' il
    //      comportamento giusto, non un guasto: uno zero silenzioso, «costruito, zero
    //      righe», sarebbe indistinguibile da un successo.
    //    · Da F6 in poi il modello avra' di nuovo contenuto e il piano tornera'.
    //    Un caso che asserisse solo il primo esito sarebbe rosso per mesi su un prodotto
    //    che si comporta come deve — e un rosso che non indica un difetto insegna a non
    //    guardare la suite (e' la lezione della famiglia ③ di F3).
    const piano = page.getByTestId("build-plan");
    const errore = page.getByTestId("build-plan-error");
    await expect(piano.or(errore)).toBeVisible({ timeout: 30_000 });

    if (await piano.isVisible()) {
      // Il piano c'e' e porta la sorgente dichiarata: senza `build_source_key` la
      // costruzione dovrebbe rifiutarsi, non ripiegare su una sorgente qualsiasi.
      await expect(page.getByTestId("build-source")).toBeVisible();

      // Le DUE colonne distinte. Un piano con la sola «nascerebbero» renderebbe
      // indistinguibile una costruzione nuova da una ri-applicazione.
      const unita = page.getByTestId("build-row-orgUnits");
      await expect(unita).toBeVisible();
      const celle = unita.locator("td");
      await expect(celle).toHaveCount(3);
      // Il numero di «nascerebbero» e' un numero, non un trattino: il piano e' reale.
      await expect(celle.nth(1)).toHaveText(/^\d[\d.,]*$/);

      // La firma e' POSSIBILE — e questa e' la prova che la guardia non e' un muro
      // cieco: su una versione approvata il pulsante si accende.
      await expect(page.getByTestId("build-apply-button")).toBeEnabled();
      await expect(page.getByTestId("build-apply-blocked")).toHaveCount(0);
      // ⚠ E NON SI PREME. Aprirebbe una richiesta di approvazione vera.
    } else {
      // ⭐ IL RIFIUTO DEVE DIRE PERCHE'. Non basta che la pagina non mostri un piano: deve
      //    riportare il MOTIVO che il servizio ha dato, altrimenti chi guarda deve aprire i
      //    log per sapere cosa fare. Il messaggio nomina il modello e cosa gli manca.
      await expect(errore).toContainText(/modello|contenuto|sorgente/i);

      // ⭐ E LA FIRMA NON DEVE ACCENDERSI su un piano che non esiste: premerla aprirebbe una
      //    richiesta di approvazione VERA per una costruzione che fallira', e qualcuno
      //    dovrebbe decidere su una cosa impossibile.
      //    ⚠ Il pulsante RESTA nel DOM, disabilitato, e accanto compare il motivo — ed e'
      //      meglio che farlo sparire: un pulsante assente non spiega niente, uno spento col
      //      motivo accanto dice cosa manca. (Prima qui c'era `toHaveCount(0)`: era la
      //      proprieta' sbagliata, e la prova l'ha mostrato restando rossa su un prodotto
      //      che si comportava bene.)
      await expect(page.getByTestId("build-apply-button")).toBeDisabled();
      await expect(page.getByTestId("build-apply-blocked")).toBeVisible();
    }

    // La porta verso il registro esiste in entrambi i casi, perche' e' la' che si verifica
    // cosa e' nato — non nella risposta di `apply`, che di proposito non porta conteggi.
    await expect(page.getByTestId("build-to-registry")).toBeVisible();
  });

  /**
   * #198 T7 — il registro delle righe generate. Finche' nessuna costruzione e' stata
   * applicata in produzione il registro E' vuoto, e la prova verifica proprio che la
   * pagina lo DICHIARI invece di mostrare un elenco vuoto che si legge «guasto».
   */
  test("il registro delle righe generate dichiara il proprio vuoto invece di sembrare rotto", async ({
    page,
  }) => {
    await page.goto("/generated-origins");
    await expect(page.getByTestId("generated-origins-page")).toBeVisible();
    await expect(page.getByTestId("generated-origins-title")).toBeVisible();

    // Il filtro di stato c'e' e i tre stati sono quelli del CHECK in `sys`.
    const filtro = page.getByTestId("generated-origins-status-filter");
    await expect(filtro).toBeVisible();
    await filtro.selectOption("GENERATED");

    // Uno dei due deve essere vero, e sono mutuamente esclusivi: o il registro
    // dichiara di essere vuoto, o ha almeno una riga da mostrare.
    const dichiaraVuoto = page.getByTestId("generated-origins-nothing-yet");
    const righe = page.getByTestId("generated-origins-row");
    await expect
      .poll(async () => (await dichiaraVuoto.count()) + (await righe.count()), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });
});
