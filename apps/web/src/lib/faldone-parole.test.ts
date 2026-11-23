/**
 * La prova della classe «nomi di colonna mezzi inglesi» del Faldone (21/11/2026): ogni parola che
 * compare nei nomi di colonna del catalogo di produzione (misurate il 21/11/2026 con una lettura di
 * pg_attribute sugli schemi sys, audit, staging e reference_sync) è tradotta, è una sigla, oppure è
 * già italiana ed è elencata qui sotto. Una parola nuova di una migrazione futura che non sta in
 * nessuno dei tre insiemi va aggiunta al dizionario o, se è italiana, a ITALIANE.
 */
import { describe, expect, it } from "vitest";
import { intestazione, PAROLE, PAROLE_EN, SIGLE } from "./faldone-parole";

const CATALOGO = [
  "1y 6mo aaguid accepted account accountable accrual accrued accuracy achievement acknowledged acquisition act acting",
  "action actions activation active activity actor actual address adjusted adjustment adjustments admin adopted adr",
  "adr48 advisor after age agent agente aggiunto aggregation ai algorithm alias aligned alignment allow",
  "ambition amount analysis annotato annual annullata annullato anonymous answers app applicata application applicato applied",
  "approval approvatore approved approver archive archived area areas args asked aspirations assessed assessment assessor",
  "assigned assignee assignment at ateco attachments attempt attempts attendance attended attiva attivo attore audience",
  "audit auth author avvenuta avvenuto azione backup balance band bank base baseline basis before",
  "behalf behavioral benchmark bic bio birth block blockers blocking blueprint body bonus box branch",
  "break bucket budget build business by byte bytes cal calculation calibrated calibration call cancellation",
  "cancelled candidate canonical cap capability capacity card career carryover catalog catalogo categoria category ccnl",
  "centre cert certificate certification change changed channel check chiave child chiusura choice citations city",
  "class classification clock closed closure cluster code codes codice cohort colonna color column comment",
  "comments company compensation competency competitive compito complete completed completion composite computed concedente concept concessioni",
  "condition condizione conf confidence confidenza conflitto consent consolidation consumed contact content context contract contratto",
  "conversation converted converter coordination corpo correlation corsa cost count counter country coverage cp2021 creata",
  "created creato cred credential criteria critical criticality currency current cursor curve custom cycle da",
  "dashboard data date dato day days db deadline decided decisa decision decisione declared deductions",
  "default definition definitive degree delegate delegation delegator deleted delivered delivery delta demographics department dependency",
  "dependent depends derivation derived description descrizione design details detected dettaglio development device difficulty dimension",
  "direction discussed discussion dismissed display distinte document domain dopo dossier draft drafted due duration",
  "duties eccezione economic edge education effective eligibility eligible email embedding emergency employee employees employer",
  "employment en enabled end ended ends engagement engine enterprise entity equivalence era erasure escalated",
  "escalation esco eseguita eseguito esenzione esito estimate estimated etag etichetta eur evaluator event evento",
  "evidence excerpt excluded exclusions executed executor exemption exp experience expires expiry export exported extends",
  "extension external facilitator factor factors family feedback fetched field fields file filename final finalized",
  "fine finished first fiscal fit fk flagged flight focus for forbidden foreign form format",
  "formula frequency from fte functional fuse gap gate gates gdpr gender generated generator genitore",
  "gettone giornale given global goal goals grade grant granted graph gross group groups growth",
  "half handed handoff hash head headcount headline highest hints hire hired history holiday home",
  "horizon host hourly hours http human iban ibrido icon id idempotenza identita identity ids",
  "il impact impiego import importato importazione impronta improvement in incentive inclusion industry initial initiated",
  "initiative input institute institution intensity intera interface internal interview interviewer invitations ip is isco",
  "issued issuer it item job joined jti key keys kind kpi ksaba label lag",
  "language languages last layout lead learning leave legacy legal level lever line1 line2 lineage",
  "link linkedin livello loaded locale location locked login manager mandate mandatory map mapping marital",
  "match maturity max measured measurement mechanism media medical meeting member mentee mentor mentorship message",
  "mestiere metadata method metodo metric metrics mfa mid middle migration migrazione milestone milestones mime",
  "min minimum minutes missing mission mobile mode model modo module months mood motivo ms",
  "multiplier must name narrative nationality nativo natural nature net new next night no node",
  "norm nota note notes notice notification now number nuovo objective obligation occupation occurred of",
  "off offer oggetto okr old on op open opened opening operating operation operazione optional",
  "options ora order ordinal org organization origin original origine otp out outcome output overall",
  "overlap override overtime owner package palette params parent part participant participants parties passo password",
  "path pay payload payment payout payroll pcf pct pending per percent percentage performance performed",
  "perimeter period periodicity periodo periods permission pernr person persona personal persone personnel persons perspective",
  "phase phone picture pk place plan planned plants platform polarity policy pool position postal",
  "posting potential pre precedente predecessor prediction preference prefs prerequisite presence previous prima primary principal",
  "principle priority private probation process processo prof professional proficiency profile program progress project prompt",
  "proof proposal proposed prorated prototype provenienza provider psr public published pulse purpose qualification quarter",
  "query question questions ragione ral rank rate ratificato rating ratings rationale read readiness ready",
  "reason receipt received recipient recommendation recommended reconciliation record recorded recovery ref reference refresh region",
  "registrato registro registry regular regulatory reject rejection related relation relationship relevance reminder reparto report",
  "reports req request requested requester required requirement requires requisition requisito research reset resolved resource",
  "responded response responses responsibility result results retention retired retrieved revenue reverted review reviewed reviewer",
  "revocato revoche revoke revoked reward riapplicato richiesta riga right rimossa risk risolto ritirata ritirato",
  "ritiro role rollback rotate rotated rotta round route row rows rubric rule run ruolo",
  "salario salary salvato satisfaction scade scale schedule scheduled schema scheme scope score scritto scrittura",
  "sdbi sdk search secondary seconds secret section seed seen segment self seniority sent sentiment",
  "seq session severity sha256 share shared shares side sidebar signal site size skill skills",
  "sla slip slug snapshot source specie specific spent stage start started starts state statement",
  "stato status step steps stop storage strategy street strengths stretch study style subarea subject",
  "submission submitted succeeded succession successor suffix suggested suggestion summary superficie superseded supersedes survey swift",
  "system tabella table tags taken talent target tax taxonomy team template tenant tenure term",
  "termination text theme threshold time timeline timezone tipo title to token tokens tolto tool",
  "topics total tracking training transaction translatable translated translation transports trattamento trigger tripped ts tsv",
  "twice type typical typing ui undo unit until up update updated updates uplift uploaded",
  "uri url usage usd used user uso valid validation valore value variable variant verified",
  "version versione visibility vocabulary voce volume wall was watermark wave webauthn week weekly weight",
  "weighting whistleblowing wide work workday working workload written x y year years z zone",
].join(" ").split(" ");

const ITALIANE = new Set([
  "agente aggiunto annotato annullata annullato applicata applicato approvatore attiva attivo attore avvenuta avvenuto azione",
  "catalogo categoria chiave chiusura codice colonna compito concedente concessioni condizione confidenza conflitto contratto corpo",
  "corsa creata creato da data dato decisa decisione descrizione dettaglio distinte dopo dossier eccezione",
  "era eseguita eseguito esenzione esito etichetta evento fine genitore gettone giornale ibrido idempotenza identita",
  "il impiego importato importazione impronta intera livello mestiere metodo migrazione modo motivo nativo nota",
  "nuovo oggetto operazione ora origine passo periodo persona persone precedente prima processo provenienza ragione",
  "ratificato registrato registro reparto requisito revocato revoche riapplicato richiesta riga rimossa risolto ritirata ritirato",
  "ritiro rotta ruolo salario salvato scade scritto scrittura specie stato superficie tabella tipo tolto",
  "trattamento uso valore versione voce",
].join(" ").split(" "));

describe("faldone: ogni parola dei nomi di colonna è detta in italiano", () => {
  it("nessuna parola del catalogo resta senza traduzione", () => {
    const scoperte = CATALOGO.filter((p) => !(p in PAROLE) && !SIGLE.has(p) && !ITALIANE.has(p));
    expect(scoperte).toEqual([]);
  });

  it("i casi visti dal vivo il 21/11 escono in italiano", () => {
    expect(intestazione("auth_refresh_used_at", "sys.sys_auth_refresh_tokens")).toBe("Usato il");
    expect(intestazione("auth_refresh_revoked_at", "sys.sys_auth_refresh_tokens")).toBe("Revocato il");
    expect(intestazione("auth_session_step_up_at", "sys.sys_auth_sessions")).toBe("Riconferma il");
    expect(intestazione("auth_session_ip", "sys.sys_auth_sessions")).toBe("IP");
    expect(intestazione("auth_session_user_agent", "sys.sys_auth_sessions")).toBe("Browser");
  });
});

/** Parole che si scrivono uguali nelle due lingue e in inglese restano come sono. */
const ANCHE_INGLESI = new Set(["data", "dossier"]);

describe("faldone in inglese (K01): nessuna parola italiana nelle intestazioni", () => {
  it("ogni parola italiana dei nomi di colonna ha la sua forma inglese", () => {
    expect([...ITALIANE].filter((p) => !(p in PAROLE_EN) && !ANCHE_INGLESI.has(p))).toEqual([]);
  });

  it("nessuna intestazione inglese contiene una parola italiana del catalogo", () => {
    const italiane = CATALOGO.filter((p) => ITALIANE.has(p))
      .map((p) => intestazione(`x_${p}`, "sys.sys_y", "en").toLowerCase().split(" "))
      .flat()
      .filter((w) => ITALIANE.has(w) && !ANCHE_INGLESI.has(w));
    expect(italiane).toEqual([]);
  });

  it("i casi visti dal vivo il 21/11 escono in inglese, e senza lingua restano in italiano", () => {
    expect(intestazione("auth_refresh_used_at", "sys.sys_auth_refresh_tokens", "en")).toBe("Used at");
    expect(intestazione("auth_refresh_revoked_at", "sys.sys_auth_refresh_tokens", "en")).toBe("Revoked at");
    expect(intestazione("auth_session_step_up_at", "sys.sys_auth_sessions", "en")).toBe("Step-up at");
    expect(intestazione("auth_session_ip", "sys.sys_auth_sessions", "en")).toBe("IP");
    expect(intestazione("user_profile_is_active", "sys.sys_user_profiles", "en")).toBe("Active");
    expect(intestazione("registro_scrittura_persona_user_id", "audit.registro_scritture", "en")).toBe("Log write person user");
    expect(intestazione("auth_refresh_used_at", "sys.sys_auth_refresh_tokens")).toBe("Usato il");
  });
});
