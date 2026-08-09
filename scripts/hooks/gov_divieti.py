#!/usr/bin/env python3
"""gov_divieti — cio' che un lavoratore di gov non puo' fare MAI.

Regola di Enzo, 2026-08-09, ribadita:

    «un worker committa nel suo ramo ma non ha facolta' di trasferire su main e di
     fare operazioni sul repo github. Tutte le attivita' di controllo finale e di
     effettiva chiusura sono responsabilita' della sessione gov che ha lanciato il
     runner e i worker.»

Perche' i divieti stanno QUI e non nella lista dei permessi
----------------------------------------------------------
Due ragioni, entrambe misurate:

1. `bypassPermissions` — concesso perche' senza di esso un lavoratore non puo'
   nemmeno far girare i test — significa letteralmente «non chiedere». Una lista
   di divieti nei permessi verrebbe scavalcata.
2. `.claude/settings.local.json` e' tracciato da git, quindi vive DENTRO l'albero
   del lavoratore, che puo' modificarlo. Un divieto che il sorvegliato puo'
   riscrivere non e' un divieto.

Quindi i divieti sono un hook, e l'hook si protegge da se': modificare
`scripts/hooks/` o `.claude/` e' fra le cose vietate.

Che cosa NON e' vietato
-----------------------
Committare sul proprio ramo. E' l'unica forma in cui il lavoro di un lavoratore
deve esistere, ed e' il presupposto perche' gov possa poi verificarlo e decidere.
Leggere e' sempre permesso, GitHub compreso: `gh pr list` serviva a un cluster
vero e non fa danno.

Modulo separato per una ragione pratica: un elenco di divieti si legge, si
discute e si estende meglio quando non e' annegato nella logica che lo applica.
"""
from __future__ import annotations

import re

# Ogni voce: (espressione, spiegazione). La spiegazione arriva al lavoratore, quindi
# dice anche COSA FARE invece — un rifiuto senza alternativa produce solo tentativi.
VIETATI: list[tuple[re.Pattern, str]] = [

    # ---- pubblicare: e' la catena piu' corta verso il deploy in produzione ----
    (re.compile(r"\bgit\s+(?:-\S+\s+)*push\b", re.I),
     "pubblicare non e' facolta' di un lavoratore. Il tuo lavoro resta sul TUO ramo: "
     "committa li', e sara' la sessione gov a verificarlo e a decidere se trasferirlo."),

    (re.compile(r"\bgh\s+\S+\s+(?:create|merge|close|edit|delete|dispatch|rerun|cancel|"
                r"set|login|logout|clone|fork|sync|upload|ready|review|comment)\b", re.I),
     "le operazioni che scrivono sul repository GitHub sono di gov, non di un lavoratore. "
     "La lettura resta permessa: `gh pr list`, `gh pr view`, `gh pr checks`."),

    # ---- main non si tocca, in nessuna forma ----
    (re.compile(r"\bgit\s+(?:-\S+\s+)*(?:checkout|switch)\b[^;|&]*\bmain\b", re.I),
     "main non si tocca da un albero di lavoro. Il tuo ramo e' gov/wN e ci resti."),

    (re.compile(r"\bgit\s+(?:-\S+\s+)*(?:merge|rebase|cherry-pick)\b[^;|&]*\bmain\b", re.I),
     "portare lavoro da o verso main e' responsabilita' della sessione gov."),

    (re.compile(r"\bgit\s+(?:-\S+\s+)*branch\b[^;|&]*(?:\s-[dDmM]\b|--delete|--move)", re.I),
     "cancellare o rinominare rami non e' facolta' di un lavoratore."),

    (re.compile(r"\bgit\s+(?:-\S+\s+)*(?:remote|config)\b[^;|&]*"
                r"(?:\sset\b|\sadd\b|\sremove\b|\srename\b|set-url|--global|--system)", re.I),
     "la configurazione del repository non si cambia da dentro un albero di lavoro."),

    # ---- distruggere lavoro, proprio o altrui ----
    (re.compile(r"\bgit\s+(?:-\S+\s+)*reset\s+--hard\b", re.I),
     "`git reset --hard` distrugge lavoro non salvato, anche di chi non sei tu. "
     "Se davvero serve ripartire, fermati e dichiara «blocked» spiegando perche'."),

    (re.compile(r"\bgit\s+(?:-\S+\s+)*(?:checkout|restore)\s+(?:--\s+)?\.\s*$", re.I),
     "buttare via TUTTE le modifiche non e' un'operazione da sessione non presidiata."),

    (re.compile(r"\bgit\s+(?:-\S+\s+)*clean\b[^;|&]*-\w*[fdx]", re.I),
     "`git clean` cancella i file non tracciati: nel tuo albero ci sono anche i segreti."),

    (re.compile(r"\bgit\s+(?:-\S+\s+)*worktree\s+(?:remove|prune|add)\b", re.I),
     "gli alberi di lavoro li governa il driver, non chi ci lavora dentro."),

    # ---- la produzione, il database, i servizi ----
    (re.compile(r"\b(?:pnpm|npm|yarn)\s+(?:run\s+)?db:(?:reset|drop|nuke)\b", re.I),
     "azzerare il database non appartiene a nessuna corsia non presidiata."),

    (re.compile(r"\b(?:close-propagate|vm-deploy|align-clones|align-claude-ecosystem)\b", re.I),
     "deploy e allineamento dei cloni sono atti presidiati, e sono di gov."),

    (re.compile(r"\bsystemctl\s+(?:--\S+\s+)*(?:start|stop|restart|reload|enable|disable|mask)\b",
                re.I),
     "i servizi di produzione non si toccano da un lavoratore."),

    # ---- autoprotezione: il sorvegliato non riscrive la sorveglianza ----
    (re.compile(r"\b(?:sed|perl|awk)\b[^;|&]*-i[^;|&]*"
                r"(?:\.claude|scripts[/\\]hooks|settings\.local)", re.I),
     "la configurazione della sorveglianza non si modifica dall'interno."),

    (re.compile(r"(?:>>?|\btee\b)[^;|&]*(?:\.claude|scripts[/\\]hooks|settings\.local)", re.I),
     "la configurazione della sorveglianza non si riscrive dall'interno."),

    (re.compile(r"\brm\b[^;|&]*(?:\.zp[/\\](?:diario|incarico)|scripts[/\\]hooks)", re.I),
     "il diario e l'incarico non si cancellano: sono la prova di cosa e' successo."),

    # ---- il database e i servizi: vietati solo se ESEGUITI (vedi in fondo) ----
    (re.compile(r"\b(?:drop|truncate)\s+(?:table|schema|database)\b", re.I),
     "DROP e TRUNCATE non si eseguono da una sessione non presidiata. Se il lavoro li "
     "richiede, SCRIVILI nel tuo esito: li eseguira' gov."),

    (re.compile(r"\b(?:delete\s+from|update)\s+\w*\.?sys_\w+", re.I),
     "le scritture sulle tabelle di sistema non sono di un lavoratore: la tua identita' "
     "di database e' in sola lettura. Proponile nel tuo esito."),

    (re.compile(r"\bsystemctl\s+(?:--\S+\s+)*(?:start|stop|restart|reload|enable|disable)\b", re.I),
     "i servizi non si toccano da un lavoratore, ne' in locale ne' via ssh. Proponilo a gov."),

    # ---- cancellazioni larghe ----
    (re.compile(r"\brm\s+(?:-\w*[rR]\w*f|-\w*f\w*[rR])\b", re.I),
     "`rm -rf` non e' consentito a un lavoratore. Se un file va tolto, si toglie per nome."),
]


# --- scritture per via di comando, che `Write` non intercetta ---------------
#
# Qui NON si vieta il verbo: si guarda il BERSAGLIO e lo si confronta col perimetro.
# Sono i cinque modi, provati uno per uno il 2026-08-09, con cui si scriveva fuori
# perimetro mentre il recinto guardava solo `Write` ed `Edit`.

REDIREZIONE = re.compile(r"(?:>>?|\btee\b(?:\s+-a)?)\s+(\"[^\"]+\"|'[^']+'|[^\s;|&]+)")
SED_IN_LOCO = re.compile(r"\b(?:sed|perl)\b[^;|&]*?\s-i\S*\s+(?:[^;|&]*?\s)??([^\s;|&]+)\s*$")
COPIA_VERSO = re.compile(r"\b(?:cp|mv|install|rsync|robocopy)\b[^;|&]*?\s([^\s;|&]+)\s*$")
RIMOZIONE = re.compile(r"\brm\b(?:\s+-\S+)*\s+([^\s;|&]+)")

# Un comando si spezza sui separatori: `git status && rm -rf /` deve essere guardato
# in due pezzi, o il secondo passa nascosto dietro il primo.
SEPARATORE = re.compile(r"\|\||&&|[;\n|]")


# I LETTERALI SI TOLGONO PRIMA DI CERCARE. E' la stessa lezione che questo progetto
# ha gia' pagato in `lab-guard` (#134): li' un `create` dentro gli apici faceva
# rifiutare una SELECT; qui una freccia `->` dentro un `echo "IDENTICI -> il file..."`
# e' stata scambiata per una redirezione, e il recinto ha rifiutato un `diff` — un
# comando che non scrive nulla. Misurato nella corsa del 2026-08-09.
#
# Sostituiti con uno SPAZIO e non con nulla, cosi' due parole separate da un
# letterale non si saldano in una terza che non esisteva.
LETTERALI = re.compile(r"'(?:[^']|'')*'" r'|"(?:[^"\\]|\\.)*"', re.DOTALL)


def senza_letterali(comando: str) -> str:
    return LETTERALI.sub(" ", comando or "")


# --- i divieti che vivono DENTRO le virgolette -------------------------------
#
# `DROP TABLE` non e' un comando di shell: e' il contenuto di `psql -c "..."`, cioe'
# sta per definizione dentro un letterale. Se lo cercassi nel testo ripulito non lo
# vedrei mai. Quindi due liste, e non e' pignoleria: cercare tutto ripulito rende
# invisibile il pericolo peggiore, cercare tutto grezzo fa rifiutare un `echo` che
# NOMINA un comando vietato. Sono i due errori opposti, e ne ho fatti entrambi oggi.


def divieto_assoluto(comando: str):
    """La prima regola violata, o None.

    I divieti sui COMANDI si cercano nel testo ripulito dai letterali — altrimenti
    `echo "non fare git push"` verrebbe rifiutato come se fosse un push. I divieti
    sul CONTENUTO si cercano nel testo grezzo, perche' li' il pericolo vive proprio
    dentro le virgolette.
    """
    for segmento in SEPARATORE.split(comando or ""):
        seg = segmento.strip()
        if not seg:
            continue
        # Il segmento si guarda in due modi: ripulito dai letterali (cio' che il
        # lavoratore esegue in prima persona) e — solo se c'e' un esecutore — anche
        # grezzo, perche' li' i letterali sono codice che sta per girare.
        da_guardare = [senza_letterali(seg)]
        codice = _codice_eseguito(seg)
        if codice:
            da_guardare.append(codice)
        for testo in da_guardare:
            for espressione, spiegazione in VIETATI:
                if espressione.search(testo):
                    return espressione.pattern, spiegazione
    return None


def bersagli_di_scrittura(comando: str) -> list[str]:
    """I percorsi che questo comando andrebbe a scrivere o cancellare.

    Volutamente GROSSOLANO e sbilanciato verso il sospetto: se un percorso finisce
    qui e non e' nel perimetro, si blocca. Preferisco un rifiuto in piu' su un
    comando innocuo che una scrittura in meno vista fuori recinto — un lavoratore
    che riceve un rifiuto puo' dirlo; una scrittura non vista, no.
    """
    fuori: list[str] = []
    for segmento in SEPARATORE.split(senza_letterali(comando)):
        seg = segmento.strip()
        if not seg:
            continue
        for espressione in (REDIREZIONE, SED_IN_LOCO, COPIA_VERSO, RIMOZIONE):
            for m in espressione.finditer(seg):
                bersaglio = m.group(1).strip("\"'")
                if bersaglio and not bersaglio.startswith("-"):
                    fuori.append(bersaglio)
    return fuori


# --- ESEGUIRE contro PROGRAMMARE --------------------------------------------
#
# Distinzione concettuale posta da Enzo il 2026-08-09, e sostituisce quella
# sbagliata che avevo scritto prima (dentro/fuori le virgolette):
#
#   «runner e worker producono risultati che non devono essere eseguiti direttamente
#    ma che passeranno alla sessione gov chiamante per l'implementazione effettiva.
#    Pertanto e' possibile che un worker PROGRAMMI attivita' che per lui sarebbero
#    vietate ma che la sessione gov sara' poi tenuta a eseguire. I controlli non
#    devono allarmarsi se trovano verbi che fanno riferimento ad attivita' vietate:
#    devono assicurare che il worker non provi a farle DIRETTAMENTE.»
#
# Quindi un lavoratore DEVE poter scrivere «gov dovra' fare merge su main» in un
# piano, in un messaggio di commit, in un esito. Cio' che non deve poter fare e'
# eseguirlo. Il criterio non e' la posizione del testo: e' se quel testo sta per
# essere ESEGUITO.
#
# Un letterale e' codice quando lo consegna un ESECUTORE — `ssh host '...'`,
# `psql -c "..."`, `bash -c '...'`. E' dato in tutti gli altri casi: `echo`,
# `git commit -m`, il corpo di un file.

ESECUTORI = re.compile(
    r"\b(?:ssh|psql|bash|sh|zsh|python3?|py|node|pwsh|powershell|docker\s+exec|"
    r"gh\s+api|eval|xargs)\b", re.I)


def _codice_eseguito(segmento: str) -> str:
    """Il testo che questo segmento fara' ESEGUIRE, o stringa vuota.

    Se c'e' un esecutore, i suoi letterali sono codice e vanno guardati. Se non c'e',
    quei letterali sono dato: un lavoratore che scrive «poi gov fara' git push» in un
    piano sta facendo il suo mestiere, non violando un divieto.
    """
    return segmento if ESECUTORI.search(segmento) else ""
