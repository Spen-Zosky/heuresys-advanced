# shellcheck shell=bash
# scripts/lib/sync-target.sh — a quale commit si allinea il sync di vm-deploy.sh (senza copia rilasciata).
#
# Perche' (23/11/2026, prova dal vivo di R1 sul linux-pc): deploy-watch decideva «deploy dello sha
# armato 450d65c8», ma vm-deploy.sh faceva `reset --hard origin/main` e andava sulla punta, che era
# avanzata. Lo sha passato dal guardiano (DEPLOY_SHA) vince su origin/<ramo>; senza DEPLOY_SHA vale
# la punta, come prima.
#
# Uso:  T="$(sync_target <repo> <ramo>)" || exit 1   (stampa un riferimento valido per `git reset --hard`)
sync_target() {
  local repo="$1" branch="$2" sha
  if [ -n "${DEPLOY_SHA:-}" ]; then
    sha="$(git -C "$repo" rev-parse --verify -q "${DEPLOY_SHA}^{commit}")" \
      || { echo "sync_target: DEPLOY_SHA ${DEPLOY_SHA} non e' un commit noto (manca il fetch?)" >&2; return 1; }
    printf '%s\n' "$sha"
  else
    printf 'origin/%s\n' "$branch"
  fi
}
