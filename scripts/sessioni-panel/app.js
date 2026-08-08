/* Plancia sessioni v2 — React senza build step (UMD + htm, serviti in locale).
   Sola lettura sul progetto: le uniche due azioni (aggiorna, riavvia) agiscono
   sulla plancia stessa.

   2026-08-08: aggiunta la vista "Zero-Pending" (sola lettura, gated su
   d.zp) — si attiva da sola quando a rispondere e' scripts/plancia.py
   (che aggiunge la chiave `zp`), resta nascosta-con-messaggio quando a
   rispondere e' scripts/sessioni_panel.py da solo. Nessuna azione operativa
   qui: quelle restano in scripts/zp_panel.py. */

const html = htm.bind(React.createElement);
const { useState, useEffect, useRef, useCallback, useMemo } = React;

const INTERVALLO = 2000;
const SERIE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];

/* ------------------------------------------------------------- formattazione */
const orario = (iso) => {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  return isNaN(d) ? "--:--:--" : d.toLocaleTimeString("it-IT", { hour12: false });
};
const durata = (sec) => {
  if (sec == null) return "—";
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${Math.floor(h / 24)}g`;
};
const num = (n) => (n == null ? "—" : n.toLocaleString("it-IT"));
const kilo = (n) => (n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const param = (n) => new URLSearchParams(location.search).get(n) || "";

/* La chiave d'accesso arriva nella URL quando la plancia è aperta alla rete
   locale: va rimessa in ogni chiamata, altrimenti il polling prende 403 mentre
   la pagina è già aperta. Da 127.0.0.1 è vuota e non serve. */
const CHIAVE = param("k");
const conK = (u) => (CHIAVE ? u + (u.includes("?") ? "&" : "?") + "k=" + encodeURIComponent(CHIAVE) : u);

/* --------------------------------------------------------------------- icone */
const I = {
  panoramica: "M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z",
  sessioni: "M4 5h16M4 12h16M4 19h10",
  attivita: "M3 12h4l3-8 4 16 3-8h4",
  file: "M6 2h8l4 4v16H6zM14 2v5h5",
  verifica: "M20 6L9 17l-5-5",
  sistema: "M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3",
  zeropending: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  aggiorna: "M21 12a9 9 0 11-3-6.7M21 3v6h-6",
  riavvia: "M12 2v10M18.4 6.6a9 9 0 11-12.8 0",
  pausa: "M7 4v16M17 4v16",
  play: "M6 3l14 9-14 9z",
  piega: "M13 5l-7 7 7 7",
};
const Ico = ({ d }) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d=${d} /></svg>`;

/* ---------------------------------------------------------------- componenti */
function Sparkline({ dati, colore = "#3987e5" }) {
  if (!dati || !dati.length) return null;
  const max = Math.max(1, ...dati);
  const w = 100, h = 30, dx = w / (dati.length - 1 || 1);
  const punti = dati.map((v, i) => `${(i * dx).toFixed(1)},${(h - (v / max) * (h - 3)).toFixed(1)}`);
  return html`
    <svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"
         role="img" aria-label="attività degli ultimi ${dati.length} minuti">
      <polyline points=${`0,${h} ${punti.join(" ")} ${w},${h}`} fill=${colore + "1f"} stroke="none" />
      <polyline points=${punti.join(" ")} fill="none" stroke=${colore}
                stroke-width="2" vector-effect="non-scaling-stroke"
                stroke-linejoin="round" stroke-linecap="round" />
    </svg>`;
}

function Barre({ voci, totale }) {
  const max = Math.max(1, ...voci.map((v) => v[1]));
  return html`
    <div class="barre">
      ${voci.map(([nome, n], i) => html`
        <div class="barra" key=${nome} title=${`${nome}: ${n} usi${totale ? ` su ${totale}` : ""}`}>
          <span class="n">${nome}</span>
          <span class="t"><i style=${{ width: `${(n / max) * 100}%`,
                                       background: SERIE[i % SERIE.length] }}></i></span>
          <span class="v">${n}</span>
        </div>`)}
    </div>`;
}

const CLASSI = { lavora: "verde", attesa: "ambra", enzo: "", chiusa: "arancio",
                 troncata: "arancio", interrotta: "rosso", sospesa: "ambra" };

/* Etichetta di stato leggibile: il colore da solo non basta quando la
   maggior parte delle sessioni e' in stati "tranquilli" che condividono lo
   stesso grigio (silenzio/spenta) — la parola si legge al volo, il colore
   da solo no (segnalato da Enzo il 2026-08-08).

   "silenzio" (ex "conclusa", corretto lo stesso giorno): la sessione
   bf45a545 era etichettata "conclusa" pur essendo aperta e in idle nel CLI
   — falsa certezza. Non esiste un segnale di processo attendibile su
   Windows per sapere se una finestra e' ancora aperta (verificato,
   COWORK_INBOX.md), quindi l'etichetta dichiara solo cio' che si osserva
   (nessuna attivita' da X) senza affermare ne' aperta ne' chiusa. E'
   diversa apposta da "chiusa", che e' un fatto concreto e diverso: il
   lavoro della sessione e' andato avanti oltre l'ultimo messaggio scritto. */
const STATO_TESTO = {
  lavora: "in corso", attesa: "in attesa", enzo: "tocca a te", sospesa: "sospesa",
  chiusa: "chiusa a metà", interrotta: "interrotta", troncata: "troncata",
  silenzio: "silenzio · stato ignoto", spenta: "vecchia · non guardata a fondo",
};
const STATO_BADGE = {
  lavora: "badge-verde", attesa: "badge-ambra", enzo: "badge-blu", sospesa: "badge-ambra",
  chiusa: "badge-arancio", interrotta: "badge-rosso", troncata: "badge-arancio",
  silenzio: "badge-grigio", spenta: "badge-grigio",
};
function Badge({ codice }) {
  return html`<span class=${"badge-stato " + (STATO_BADGE[codice] || "badge-grigio")}
                     title=${"stato: " + codice}>${STATO_TESTO[codice] || codice}</span>`;
}

function Cronologia({ eventi, alta }) {
  const [q, setQ] = useState("");
  const [gen, setGen] = useState("tutto");
  const fine = useRef(null);
  const generi = ["tutto", "voce", "strumento", "Enzo", "ragiona"];
  const filtrati = useMemo(() => (eventi || []).filter((e) =>
    (gen === "tutto" || e.genere === gen) &&
    (!q || (e.testo || "").toLowerCase().includes(q.toLowerCase()))), [eventi, q, gen]);

  return html`
    <div>
      <div class="barra-crono">
        <input class="cerca" placeholder="cerca nella cronologia…" value=${q}
               onInput=${(e) => setQ(e.target.value)} />
        ${generi.map((g) => html`
          <button key=${g} class=${"chip" + (gen === g ? " acceso" : "")}
                  onClick=${() => setGen(g)}>${g}</button>`)}
        <span class="nota">${filtrati.length}/${(eventi || []).length}</span>
      </div>
      <div class=${"cronologia" + (alta ? " alta" : "")}>
        ${filtrati.length === 0
          ? html`<div class="vuoto">nessun evento con questo filtro</div>`
          : filtrati.map((e, i) => html`
              <div class=${"evento g-" + e.genere} key=${i}>
                <span class="quando">${orario(e.quando)}</span>
                <span class="genere">${e.genere}</span>
                <span class="testo">${e.testo}</span>
              </div>`)}
        <div ref=${fine}></div>
      </div>
    </div>`;
}

function Sessione({ s, io, compatta }) {
  const [aperta, setAperta] = useState(false);
  const dedotto = (s.modalita || "").endsWith("?");
  const mostra = aperta || (!compatta && s.viva);
  const strumenti = Object.entries(s.strumenti || {}).slice(0, 7);
  const scritti = (s.file || []).filter((f) => f.scritto);

  return html`
    <div class=${"sessione " + s.codice}>
      <div class="riga-capo" onClick=${() => setAperta(!aperta)} style=${{ cursor: "pointer" }}>
        <span class="pallino"></span>
        <${Badge} codice=${s.codice} />
        <span class="sid">${s.corta}</span>
        ${io === s.sid && html`<span class="io">questa</span>`}
        <span class=${"tag" + (dedotto ? " dedotto" : "")}>${s.modalita}</span>
        <span class="frase">${s.frase}</span>
        <div class="metriche">
          ${compatta && (s.ritmo || []).some((x) => x > 0) && html`
            <span style=${{ width: "84px", opacity: .85 }} title="attività degli ultimi 40 minuti">
              <${Sparkline} dati=${s.ritmo}
                            colore=${s.codice === "lavora" ? "#0ca30c"
                                     : s.codice === "attesa" ? "#fab219" : "#66788d"} />
            </span>`}
          ${s.modello && html`<span>${s.modello}</span>`}
          ${s.durata_sec != null && html`<span>durata <b>${durata(s.durata_sec)}</b></span>`}
          <span><b>${kilo(s.token_out)}</b> tok</span>
          <span><b>${s.eventi_totali || 0}</b> eventi</span>
          <span>${durata(s.eta_sec)} fa</span>
        </div>
      </div>

      ${mostra && html`
        <div class=${"corpo" + (compatta ? " sola" : "")}>
          <${Cronologia} eventi=${s.eventi} alta=${!compatta && !!aperta} />
          ${!compatta && html`
            <div class="laterale">
              <div>
                <h4>ritmo · ultimi 40 min</h4>
                <${Sparkline} dati=${s.ritmo} colore=${s.codice === "lavora" ? "#0ca30c" : "#3987e5"} />
              </div>
              ${strumenti.length > 0 && html`
                <div>
                  <h4>strumenti</h4>
                  <${Barre} voci=${strumenti} />
                </div>`}
              ${scritti.length > 0 && html`
                <div>
                  <h4>file scritti · ${scritti.length}</h4>
                  ${scritti.slice(0, 6).map((f) => html`
                    <div class="file-riga" key=${f.file} title=${f.file}>
                      <span class="p scritto">${f.file.split("/").slice(-2).join("/")}</span>
                      <span class="nota">${f.volte}</span>
                    </div>`)}
                </div>`}
              ${(s.task || []).length > 0 && html`
                <div>
                  <h4>task in background</h4>
                  ${s.task.map((t) => html`
                    <div class="file-riga" key=${t.id}>
                      <span class="p">${t.id}</span>
                      <span class=${"nota" + (t.byte === 0 ? "" : "")}>
                        ${t.byte === 0 ? "vuoto" : num(t.byte) + "b"} · ${durata(t.eta_sec)}
                      </span>
                    </div>`)}
                </div>`}
            </div>`}
        </div>`}
    </div>`;
}

/* ------------------------------------------------------------------- viste */
function Panoramica({ d, io, vai }) {
  const vive = d.sessioni.filter((s) => s.viva);
  const attenzione = d.sessioni.filter((s) => ["chiusa", "interrotta", "troncata"].includes(s.codice));
  return html`
    <div>
      ${d.collisioni.length > 0 && html`
        <div class="avviso-riq">
          <b>${d.collisioni.length} file scritti da più di una sessione.</b> È il rischio vero del
          lavoro in parallelo: due finestre che modificano lo stesso file non si vedono a vicenda.
          <a href="#" onClick=${(e) => { e.preventDefault(); vai("file"); }}
             style=${{ color: "inherit" }}>vedi quali →</a>
        </div>`}

      <h2 class="sezione">sessioni vive · ${vive.length}</h2>
      ${vive.length === 0
        ? html`<div class="riquadro"><span class="nota">nessuna sessione attiva</span></div>`
        : vive.map((s) => html`<${Sessione} key=${s.sid} s=${s} io=${io} compatta=${true} />`)}

      ${attenzione.length > 0 && html`
        <h2 class="sezione">richiedono attenzione · ${attenzione.length}</h2>
        ${attenzione.map((s) => html`<${Sessione} key=${s.sid} s=${s} io=${io} compatta=${true} />`)}`}

      <h2 class="sezione">verifica e repository</h2>
      <${RiquadriStato} d=${d} />

      <h2 class="sezione">adesso</h2>
      <div class="griglia larga">
        <div class="riquadro" style=${{ padding: "13px 0 0" }}>
          <h3 style=${{ padding: "0 15px" }}>ultimi eventi · tutte le sessioni</h3>
          <div class="cronologia" style=${{ maxHeight: "260px" }}>
            ${ultimiEventi(d, 40).map((e, i) => html`
              <div class=${"evento g-" + e.genere} key=${i}>
                <span class="quando">${orario(e.quando)}</span>
                <span class="sid" style=${{ fontSize: "10.5px", width: "66px", flex: "none" }}>
                  ${e.corta}</span>
                <span class="genere">${e.genere}</span>
                <span class="testo">${e.testo}</span>
              </div>`)}
          </div>
        </div>
        <div class="riquadro">
          <h3>lavori in corso · ${d.processi.filter((p) => p.interessante).length}</h3>
          ${d.processi.filter((p) => p.interessante).length === 0
            ? html`<span class="nota">nessun test, build o verifica in esecuzione</span>`
            : d.processi.filter((p) => p.interessante).map((p) => html`
                <div class="coppia" key=${p.pid}>
                  <span class="k">
                    ${(p.marche || []).map((m) => html`<span class="pilla verde" key=${m}
                       style=${{ marginRight: "5px" }}>${m}</span>`)}
                    ${p.nome} ${p.pid}
                  </span>
                  <span class="v">da ${orario(p.avvio)} · ${p.cpu_min} min cpu</span>
                </div>`)}
          <div style=${{ marginTop: "10px" }}>
            <h3>token scritti per sessione viva</h3>
            <${Barre} voci=${vive.map((s) => [s.corta, s.token_out || 0])} />
          </div>
        </div>
      </div>
    </div>`;
}

function ultimiEventi(d, n) {
  const out = [];
  for (const s of d.sessioni) {
    for (const e of (s.eventi || [])) {
      if (e.quando) out.push({ ...e, corta: s.corta });
    }
  }
  return out.sort((a, b) => (a.quando < b.quando ? 1 : -1)).slice(0, n);
}

function RiquadriStato({ d }) {
  const g = d.git || {}, v = d.verdetto || {};
  const fresco = v.head && g.head && v.head.startsWith(g.head);
  return html`
    <div class="griglia">
      <div class="riquadro">
        <h3>git</h3>
        <div class="coppia"><span class="k">ramo</span><span class="v">${g.ramo}</span></div>
        <div class="coppia"><span class="k">HEAD</span><span class="v">${g.head}</span></div>
        <div class="coppia"><span class="k">file sporchi</span>
          <span class=${"v " + (g.sporchi > 0 ? "ambra" : "")}>${g.sporchi}</span></div>
        ${(() => {
          const r = g.remoto || {};
          if (!r.verificato) {
            return html`<div class="coppia">
              <span class="k">commit non spinti</span>
              <span class="v" title=${r.motivo || ""} style=${{ color: "var(--testo-3)" }}>
                non verificato</span></div>`;
          }
          return html`
            <div class="coppia"><span class="k">commit non spinti</span>
              <span class=${"v " + (r.avanti > 0 ? "ambra" : "verde")}>
                ${r.avanti === 0 ? "0 · tutto online" : r.avanti}</span></div>
            ${r.indietro > 0 && html`<div class="coppia">
              <span class="k">il remoto è avanti di</span>
              <span class="v arancio">${r.indietro}</span></div>`}`;
        })()}
        <div class="coppia"><span class="k">ultimo</span>
          <span class="v" style=${{ maxWidth: "60%", textAlign: "right" }}>${g.ultimo_commit}</span></div>
      </div>
      <div class="riquadro">
        <h3>cancello di verifica</h3>
        ${v.presente ? html`
          <div class="coppia"><span class="k">esito</span>
            <span class=${"v " + (v.esito === "green" ? "verde" : "rosso")}>
              ${v.esito === "green" ? "verde" : "rosso"}</span></div>
          <div class="coppia"><span class="k">su HEAD</span><span class="v">${v.head}</span></div>
          <div class="coppia"><span class="k">età</span><span class="v">${durata(v.eta_min * 60)}</span></div>
          <div class="coppia"><span class="k">vale per HEAD attuale?</span>
            <span class=${"v " + (fresco ? "verde" : "rosso")}>${fresco ? "sì" : "no — scaduto"}</span></div>
          <div class="coppia"><span class="k">suite instradate</span>
            <span class="v">${(v.instradate || []).length}</span></div>`
          : html`<div class="coppia"><span class="k">verdetto</span><span class="v">nessuno</span></div>`}
      </div>
    </div>`;
}

/* Stati "muti": nessun segnale osservabile, potrebbero essere sia sessioni
   aperte in idle sia sessioni chiuse per davvero — non lo si puo' sapere
   (vedi STATO_TESTO sopra). Enzo il 2026-08-08 ha chiesto che queste NON
   affoghino in cima alla lista le sessioni con uno stato piu' informativo:
   ordinamento stabile, le mute in coda, senza perdere l'ordine originale
   (piu' recente prima) dentro ciascun gruppo. */
const STATI_MUTI = new Set(["silenzio", "spenta"]);

function VistaSessioni({ d, io }) {
  const ordinate = useMemo(() => {
    const informative = d.sessioni.filter((s) => !STATI_MUTI.has(s.codice));
    const mute = d.sessioni.filter((s) => STATI_MUTI.has(s.codice));
    return [...informative, ...mute];
  }, [d.sessioni]);
  return html`
    <div>
      <h2 class="sezione">tutte le sessioni · ${d.sessioni.length}</h2>
      ${ordinate.map((s) => html`<${Sessione} key=${s.sid} s=${s} io=${io} compatta=${false} />`)}
    </div>`;
}

function VistaAttivita({ d }) {
  const tutti = useMemo(() => {
    const out = [];
    for (const s of d.sessioni) {
      for (const e of (s.eventi || [])) {
        if (e.quando) out.push({ ...e, corta: s.corta, codice: s.codice });
      }
    }
    return out.sort((a, b) => (a.quando < b.quando ? 1 : -1)).slice(0, 400);
  }, [d.sessioni]);
  return html`
    <div>
      <h2 class="sezione">attività di tutte le sessioni · ultimi ${tutti.length} eventi</h2>
      <div class="riquadro" style=${{ padding: 0 }}>
        <div class="cronologia alta" style=${{ maxHeight: "72vh" }}>
          ${tutti.map((e, i) => html`
            <div class=${"evento g-" + e.genere} key=${i}>
              <span class="quando">${orario(e.quando)}</span>
              <span class="sid" style=${{ fontSize: "10.5px", width: "68px", flex: "none" }}>${e.corta}</span>
              <span class="genere">${e.genere}</span>
              <span class="testo">${e.testo}</span>
            </div>`)}
        </div>
      </div>
    </div>`;
}

function VistaFile({ d }) {
  const tutti = useMemo(() => {
    const m = new Map();
    for (const s of d.sessioni) {
      for (const f of (s.file || [])) {
        const v = m.get(f.file) || { file: f.file, scritto: false, volte: 0, chi: [] };
        v.volte += f.volte; v.scritto = v.scritto || f.scritto;
        if (!v.chi.includes(s.corta)) v.chi.push(s.corta);
        m.set(f.file, v);
      }
    }
    return [...m.values()].sort((a, b) => b.volte - a.volte).slice(0, 120);
  }, [d.sessioni]);

  return html`
    <div>
      <h2 class="sezione">collisioni · ${d.collisioni.length}</h2>
      ${d.collisioni.length === 0
        ? html`<div class="riquadro"><span class="nota">nessun file scritto da più di una
                 sessione: le finestre aperte stanno lavorando su cose diverse</span></div>`
        : html`<div class="riquadro">
            <table class="dati">
              <thead><tr><th>file</th><th>sessioni</th></tr></thead>
              <tbody>${d.collisioni.map((c) => html`
                <tr key=${c.file} class="spicca">
                  <td class="tronca" title=${c.file}>${c.file}</td>
                  <td>${c.sessioni.map((x) => `${x.corta} (${x.volte})`).join(" · ")}</td>
                </tr>`)}</tbody>
            </table>
          </div>`}

      <h2 class="sezione">file toccati · ${tutti.length}</h2>
      <div class="riquadro riquadro-scroll" style=${{ maxHeight: "52vh" }}>
        <table class="dati">
          <thead><tr><th>file</th><th>modo</th><th>volte</th><th>sessioni</th></tr></thead>
          <tbody>${tutti.map((f) => html`
            <tr key=${f.file} class=${f.scritto ? "spicca" : ""}>
              <td class="tronca" title=${f.file}>${f.file}</td>
              <td>${f.scritto
                    ? html`<span class="pilla arancio">scritto</span>`
                    : html`<span class="pilla">letto</span>`}</td>
              <td>${f.volte}</td>
              <td>${f.chi.join(" ")}</td>
            </tr>`)}</tbody>
        </table>
      </div>
    </div>`;
}

function VistaVerifica({ d }) {
  const v = d.verdetto || {};
  return html`
    <div>
      <h2 class="sezione">cancello di verifica</h2>
      <${RiquadriStato} d=${d} />
      ${(v.suite || []).length > 0 && html`
        <h2 class="sezione">suite eseguite · ${v.suite.length}</h2>
        <div class="griglia larga">
          ${v.suite.map((s) => html`
            <div class="riquadro" key=${s.suite}>
              <h3>
                ${s.suite}
                ${s.exit === 0 ? html`<span class="pilla verde">verde</span>`
                               : html`<span class="pilla rosso">rosso</span>`}
                <span class="nota" style=${{ marginLeft: "auto" }}>${durata(s.durata_s)}</span>
              </h3>
              ${s.falliti && s.falliti.length > 0 && html`
                <div style=${{ marginBottom: "8px" }}>
                  ${s.falliti.map((f) => html`
                    <div class="file-riga" key=${f}><span class="p scritto">${f}</span></div>`)}
                </div>`}
              ${s.exit !== 0 && (!s.falliti || !s.falliti.length) && html`
                <div class="nota" style=${{ marginBottom: "8px" }}>
                  il verdetto non elenca i file caduti — servirebbe rieseguire la suite
                  (è il difetto consegnato il 2026-08-05)
                </div>`}
              ${s.log && html`<div class="coppia"><span class="k">log</span>
                 <span class="v">${s.log}${s.righe ? ` · ${num(s.righe)} righe` : ""}</span></div>`}
              <div class="cronologia" style=${{ maxHeight: "150px", marginTop: "6px" }}>
                ${(s.coda || []).map((r, i) => html`
                  <div class="evento" key=${i}><span class="testo">${r}</span></div>`)}
              </div>
            </div>`)}
        </div>`}
    </div>`;
}

function VistaSistema({ d }) {
  const g = d.git || {};
  return html`
    <div>
      <h2 class="sezione">processi · ${d.processi.length}</h2>
      <div class="riquadro riquadro-scroll">
        <table class="dati">
          <thead><tr><th>pid</th><th>nome</th><th>avviato</th><th>cpu</th><th>ram</th><th>comando</th></tr></thead>
          <tbody>${d.processi.map((p) => html`
            <tr key=${p.pid} class=${p.interessante ? "spicca" : ""}>
              <td>${p.pid}</td><td>${p.nome}</td><td>${orario(p.avvio)}</td>
              <td>${p.cpu_min} min</td><td>${p.ram_mb} MB</td>
              <td class="tronca" title=${p.riga}>
                ${(p.marche || []).map((m) => html`<span class="pilla verde" key=${m}
                   style=${{ marginRight: "5px" }}>${m}</span>`)}${p.riga}</td>
            </tr>`)}</tbody>
        </table>
      </div>

      <h2 class="sezione">lavoro non committato · ${g.sporchi}</h2>
      <div class="griglia larga">
        <div class="riquadro riquadro-scroll">
          <h3>file sporchi</h3>
          ${(g.elenco_sporchi || []).map((r, i) => html`
            <div class="file-riga" key=${i}><span class="p">${r}</span></div>`)}
        </div>
        <div class="riquadro riquadro-scroll">
          <h3>commit non spinti · ${g.non_spinti}</h3>
          ${(g.elenco_non_spinti || []).map((r, i) => html`
            <div class="file-riga" key=${i}><span class="p">${r}</span></div>`)}
        </div>
      </div>
    </div>`;
}

function VistaZeroPending({ d }) {
  const z = d.zp;
  if (!z) {
    return html`<div class="riquadro">
      <span class="nota">questa vista richiede scripts/plancia.py (la plancia unificata) — non
        è disponibile qui. Nessun problema: apri scripts/zp_panel.py per lo stato completo e
        le azioni operative.</span></div>`;
  }
  const p = z.piano || {};
  const pct = p.totali ? Math.round((100 * p.chiusi) / p.totali) : 0;
  return html`
    <div>
      <div class="avviso-riq" style=${{ display: "flex", alignItems: "center",
                                         justifyContent: "space-between", gap: "14px" }}>
        <span>questa vista è di <b>sola lettura</b>. Per lanciare o fermare il driver, il freno
          o il censimento serve il pannello operativo.</span>
        <a class="bottone acceso" href="http://127.0.0.1:8477/" target="_blank" rel="noopener"
           style=${{ textDecoration: "none", flex: "none" }}>
          Apri pannello operativo (zp_panel) ↗
        </a>
      </div>

      <h2 class="sezione">stato macchina — sola lettura</h2>
      <div class="griglia">
        <div class="riquadro">
          <div class="coppia"><span class="k">freno</span>
            <span class=${"v " + (z.freno_inserito ? "ambra" : "verde")}>
              ${z.freno_inserito ? "inserito" : "tolto"}</span></div>
          <div class="coppia"><span class="k">driver</span>
            <span class="v">${z.lock && z.lock.presente
              ? (z.lock.vivo ? `in esecuzione (pid ${z.lock.pid})` : "lock orfano")
              : "fermo"}</span></div>
          <div class="coppia"><span class="k">STOP</span>
            <span class=${"v " + (z.stop_presente ? "rosso" : "verde")}>
              ${z.stop_presente ? "presente" : "nessuno"}</span></div>
          <div class="coppia"><span class="k">repo</span>
            <span class=${"v " + (z.repo_sporco ? "ambra" : "verde")}>
              ${z.repo_sporco == null ? "ignoto" : (z.repo_sporco ? "con modifiche" : "pulito")}</span></div>
        </div>
        <div class="riquadro">
          <div class="coppia"><span class="k">cluster chiusi</span>
            <span class="v">${p.chiusi}/${p.totali} (${pct}%)</span></div>
          <div class="coppia"><span class="k">aperti</span><span class="v">${p.aperti}</span></div>
          <div class="coppia"><span class="k">autonomi</span>
            <span class="v">${p.autonomi} (${p.ore_autonome}h)</span></div>
          <div class="coppia"><span class="k">aspettano te</span><span class="v">${p.su_enzo}</span></div>
          <div class="coppia"><span class="k">spesa / tetto</span>
            <span class="v">${(z.spesa_usd || 0).toFixed(2)} / ${(z.tetto_usd || 0).toFixed(0)} $</span></div>
        </div>
      </div>

      ${(p.ondate || []).length > 0 && html`
        <h2 class="sezione">aperti per ondata</h2>
        <div class="riquadro"><${Barre} voci=${p.ondate.map((o) => [o.nome, o.pezzi])} /></div>`}

      ${(z.vassoio_enzo || []).length > 0 && html`
        <h2 class="sezione">vassoio «aspetta te» · ${z.vassoio_enzo.length}</h2>
        <div class="riquadro">
          <table class="dati">
            <thead><tr><th>id</th><th>tipo</th><th>effort</th><th>titolo</th></tr></thead>
            <tbody>${z.vassoio_enzo.map((v) => html`
              <tr key=${v.id}><td>${v.id}</td><td><span class="pilla">${v.tipo}</span></td>
                  <td>${v.effort}</td><td>${v.titolo}</td></tr>`)}</tbody>
          </table>
        </div>`}

      ${(z.corse || []).length > 0 && html`
        <h2 class="sezione">storico corse · ${z.corse.length}</h2>
        <div class="riquadro riquadro-scroll">
          <table class="dati">
            <thead><tr><th>esito</th><th>cluster</th><th>costo $</th><th>quando</th></tr></thead>
            <tbody>${z.corse.slice().reverse().map((c, i) => html`
              <tr key=${i}><td>${c.outcome || c.esito || "?"}</td><td>${c.cluster || "—"}</td>
                  <td>${(+c.costo_usd || 0).toFixed(2)}</td><td>${c.quando || c.ts || "—"}</td></tr>`)}</tbody>
          </table>
        </div>`}

      <p class="nota" style=${{ marginTop: "14px" }}>
        sola lettura: lancio del driver, freno, censimento e attività pianificate restano nel
        pannello dedicato (scripts/zp_panel.py) — questa vista non li duplica.
      </p>
    </div>`;
}

/* --------------------------------------------------------------------- app */
const VISTE = [
  ["panoramica", "Panoramica", I.panoramica],
  ["sessioni", "Sessioni", I.sessioni],
  ["attivita", "Attività", I.attivita],
  ["file", "File e collisioni", I.file],
  ["verifica", "Verifica", I.verifica],
  ["zeropending", "Zero-Pending", I.zeropending],
  ["sistema", "Sistema", I.sistema],
];

function App() {
  const [d, setD] = useState(null);
  const [errore, setErrore] = useState("");
  const [acceso, setAcceso] = useState(true);
  const [battito, setBattito] = useState(false);
  const [vista, setVista] = useState(param("vista") || "panoramica");
  const [chiuso, setChiuso] = useState(localStorage.getItem("fianco") === "chiuso");
  const [azione, setAzione] = useState("");
  const inCorso = useRef(false);
  const io = param("io");

  const carica = useCallback(async () => {
    if (inCorso.current) return;
    inCorso.current = true;
    try {
      const r = await fetch(conK("/api/stato"), { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setD(await r.json());
      setErrore("");
      setBattito(true);
      setTimeout(() => setBattito(false), 900);
    } catch (e) {
      setErrore(String(e.message || e));
    } finally {
      inCorso.current = false;
    }
  }, []);

  const agisci = useCallback(async (nome) => {
    setAzione(nome);
    try {
      await fetch(conK("/api/azione"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione: nome }),
      });
    } catch (e) { /* il riavvio chiude la connessione: è atteso */ }
    setTimeout(() => { carica(); setAzione(""); }, nome === "riavvia" ? 1400 : 200);
  }, [carica]);

  useEffect(() => { carica(); }, [carica]);
  useEffect(() => {
    if (!acceso) return;
    const t = setInterval(carica, INTERVALLO);
    return () => clearInterval(t);
  }, [acceso, carica]);
  useEffect(() => { localStorage.setItem("fianco", chiuso ? "chiuso" : "aperto"); }, [chiuso]);

  if (!d) return html`<div class="avvio">${errore ? "la plancia non risponde: " + errore
                                                  : "lettura dei transcript…"}</div>`;

  const vive = d.sessioni.filter((s) => s.viva);
  const attenzione = d.sessioni.filter((s) => ["chiusa", "interrotta", "troncata"].includes(s.codice));
  const proc = d.processi.filter((p) => p.interessante);
  const tokTot = d.sessioni.reduce((a, s) => a + (s.token_out || 0), 0);
  const v = d.verdetto || {};
  const z = d.zp || null;
  const conte = { sessioni: d.sessioni.length, attivita: null, file: d.collisioni.length || null,
                  verifica: (v.suite || []).filter((s) => s.exit !== 0).length || null,
                  sistema: proc.length || null, panoramica: vive.length || null,
                  zeropending: z ? ((z.freno_inserito || z.stop_presente) ? 1 : null) : null };

  const Corrente = { panoramica: Panoramica, sessioni: VistaSessioni, attivita: VistaAttivita,
                     file: VistaFile, verifica: VistaVerifica, sistema: VistaSistema,
                     zeropending: VistaZeroPending }[vista];

  return html`
    <div class=${"guscio" + (chiuso ? " chiuso" : "")}>
      <header class="testata">
        <div class="marchio">
          <span class="glifo">H</span>
          <div><b>Plancia sessioni</b><br/><span>${d.repo}</span></div>
        </div>

        <div class="kpi-riga">
          <div class="kpi buono"><span class="v">${vive.length}</span><span class="k">vive</span></div>
          <div class=${"kpi" + (attenzione.length ? " serio" : "")}>
            <span class="v">${attenzione.length}</span><span class="k">da guardare</span></div>
          <div class=${"kpi" + (d.collisioni.length ? " critico" : "")}>
            <span class="v">${d.collisioni.length}</span><span class="k">collisioni</span></div>
          <div class="kpi"><span class="v">${kilo(tokTot)}</span><span class="k">token scritti</span></div>
          <div class="kpi"><span class="v">${proc.length}</span><span class="k">processi</span></div>
          <div class=${"kpi " + (v.esito === "green" ? "buono" : "critico")}>
            <span class="v">${v.presente ? (v.esito === "green" ? "verde" : "rosso") : "—"}</span>
            <span class="k">cancello</span></div>
          <div class=${"kpi" + (d.git.sporchi ? " avviso" : "")}>
            <span class="v">${d.git.sporchi}</span><span class="k">file sporchi</span></div>
          ${z && html`
            <div class=${"kpi" + (z.freno_inserito ? " avviso" : " buono")}>
              <span class="v">${z.freno_inserito ? "on" : "off"}</span><span class="k">freno zp</span></div>`}
        </div>

        <div class="strumenti-testata">
          <span class=${"battito" + (acceso ? " vivo" : "") + (battito ? " pulsa" : "")}></span>
          <span class="nota">${orario(d.adesso)}</span>
          <button class="bottone" onClick=${() => agisci("aggiorna")} disabled=${!!azione}
                  title="rilegge tutto adesso, svuotando la cache">
            <${Ico} d=${I.aggiorna} /> ${azione === "aggiorna" ? "…" : "Aggiorna"}
          </button>
          <button class=${"bottone" + (acceso ? " acceso" : "")} onClick=${() => setAcceso(!acceso)}>
            <${Ico} d=${acceso ? I.pausa : I.play} /> ${acceso ? `live ${INTERVALLO / 1000}s` : "in pausa"}
          </button>
          <button class="bottone pericolo" onClick=${() => agisci("riavvia")} disabled=${!!azione}
                  title="riavvia il processo della plancia per ricaricarne il codice">
            <${Ico} d=${I.riavvia} /> ${azione === "riavvia" ? "riavvio…" : "Riavvia"}
          </button>
        </div>
      </header>

      <aside class="fianco">
        <div class="titolo">viste</div>
        ${VISTE.map(([id, nome, icona]) => html`
          <div key=${id} class=${"voce" + (vista === id ? " scelta" : "")}
               onClick=${() => setVista(id)} title=${nome}>
            <${Ico} d=${icona} /><span>${nome}</span>
            ${conte[id] != null && html`<span class=${"conta" +
              (id === "file" || id === "verifica" ? " allarme" : "")}>${conte[id]}</span>`}
          </div>`)}
        <div class="voce piega" onClick=${() => setChiuso(!chiuso)} title="apri o chiudi il fianco">
          <${Ico} d=${I.piega} style=${{ transform: chiuso ? "rotate(180deg)" : "none" }} />
          <span>Riduci</span>
        </div>
      </aside>

      <main>
        ${errore && html`<div class="avviso-riq">la plancia non risponde: ${errore}</div>`}
        <${Corrente} d=${d} io=${io} vai=${setVista} />
      </main>

      <footer class="piede">
        <span>sola lettura sul progetto</span><span class="sep">·</span>
        <span>le uniche azioni (aggiorna, riavvia) agiscono sulla plancia stessa</span>
        <span class="sep">·</span><span>segreti redatti</span>
        <div class="destra">
          <span>server dalle ${orario(d.avvio_server)}</span>
          <span class="sep">·</span>
          <span>${d.sessioni.length} transcript letti</span>
          <span class="sep">·</span>
          ${(d.rete && d.rete.esposta)
            ? html`<span style=${{ color: "var(--avviso)" }}
                          title=${d.rete.aperta
                            ? "chiunque sulla rete locale può leggere questa pagina"
                            : "fuori da localhost serve la chiave d'accesso"}>
                ${d.rete.aperta
                  ? `aperta in rete · ${d.rete.ip}:${location.port}`
                  : `rete locale · con chiave · ${d.rete.ip}:${location.port}`}</span>`
            : html`<span>solo 127.0.0.1:${location.port}</span>`}
        </div>
      </footer>
    </div>`;
}

ReactDOM.createRoot(document.getElementById("radice")).render(html`<${App} />`);
