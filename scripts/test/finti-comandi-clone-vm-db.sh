#!/usr/bin/env bash
# shellcheck shell=bash disable=SC2034
# ============================================================================
# scripts/test/finti-comandi-clone-vm-db.sh — l'aggancio di prova di clone-vm-db.sh
#
# PERCHE' ESISTE (D-86, S1078). `clone-vm-db.sh` decide se DROPPARE degli schemi, e
# fino a oggi la batteria lo copriva con `bash -n` e basta: si sapeva che era sintassi
# valida e niente su cosa decide. Le sue guardie — «la VM non risponde, non tocco
# niente», «l'elenco e' vuoto, non tocco niente», «il dump si e' interrotto, il clone
# e' INCOMPLETO», «non sono riuscito a MISURARE, che NON vuol dire divergente» — sono
# i rami che in produzione non si percorrono mai. Cioe' quelli che nessuno vede
# fallire finche' non servono, che e' il momento peggiore per scoprirli rotti.
#
# COME SI USA: `clone-vm-db.sh` legge questo file (CLONE_VM_DB_STUB) DOPO aver
# definito le sue quattro funzioni di uscita, e qui le si ridefinisce. Ogni caso di
# prova si compone con le variabili qui sotto — un file solo, sei scenari, invece di
# sei copie che divergono.
#
#   TRACCIA           file dove si registra OGNI comando: le asserzioni piu'
#                     importanti sono su cosa NON e' stato eseguito
#   FINTO_VM_KO=1     la VM non risponde (ssh 255)
#   FINTO_SCHEMI_VM   elenco schemi sulla VM   (righe separate da spazio, '' = vuoto)
#   FINTO_SCHEMI_LOC  elenco schemi sul clone  (idem)
#   FINTO_DUMP_RC     exit del lato sinistro della pipe (default 0)
#   FINTO_RESTORE_RC  exit del lato destro     (default 0)
#   FINTO_CONTE_KO=1  le conte falliscono -> '?' su ENTRAMBI i lati
#   FINTO_CENS_VM     censimento oggetti lato VM
#   FINTO_CENS_LOC    censimento oggetti lato clone (se diverso -> DIFF)
# ============================================================================

_traccia() { [ -n "${TRACCIA:-}" ] && printf '%s\n' "$*" >> "$TRACCIA"; return 0; }

remote_psql() {
  local q="$1"
  _traccia "remote_psql :: $q"
  [ "${FINTO_VM_KO:-0}" = "1" ] && return 255
  # ⚠ L'ORDINE DEI RAMI E' IL PUNTO. La query del censimento contiene `string_agg`
  # MA ANCHE `nspname` e `count(`: con i rami in ordine ingenuo finiva in quello degli
  # schemi e lo stub rispondeva un elenco al posto di un censimento. Trovato dal caso
  # sano, che falliva — cioe' dalla prova che fa il suo mestiere. Dal piu' specifico.
  case "$q" in
    *string_agg*) printf '%s\n' "${FINTO_CENS_VM:-sys.tab=10 sys.idx=20}" ;;
    *nspname*)    printf '%s\n' ${FINTO_SCHEMI_VM:-} ;;
    *count*)      [ "${FINTO_CONTE_KO:-0}" = "1" ] && return 1; echo 161 ;;
    *)            echo "?" ;;
  esac
  return 0
}

pg_super() {
  _traccia "pg_super :: $*"
  case "$*" in
    *"DROP SCHEMA"*) return 0 ;;                       # registrato, non eseguito
    *nspname*)       printf '%s\n' ${FINTO_SCHEMI_LOC:-} ;;
    *)               return 0 ;;
  esac
  return 0
}

pg_app() {
  _traccia "pg_app :: $*"
  case "$*" in                                  # dal piu' specifico — vedi remote_psql
    *string_agg*) printf '%s\n' "${FINTO_CENS_LOC:-sys.tab=10 sys.idx=20}" ;;
    *count*)      [ "${FINTO_CONTE_KO:-0}" = "1" ] && return 1; echo 161 ;;
    *)            return 0 ;;
  esac
  return 0
}

stream_dump_restore() {
  _traccia "stream_dump_restore"
  dump_rc="${FINTO_DUMP_RC:-0}"
  rc="${FINTO_RESTORE_RC:-0}"
  return 0
}
